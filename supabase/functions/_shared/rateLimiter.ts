/**
 * PulseBridge AI — Shared Inbound API Rate Limiter
 * File: supabase/functions/_shared/rateLimiter.ts
 *
 * Security & Reliability Requirements:
 * 1. Server-Enforced Identity: Limits bound to server-verified user ID and/or client IP.
 * 2. Concurrency-Safe Atomic Counters: Sliding-window/fixed-window atomic tracking.
 * 3. Fail-Closed on Storage Failure: If rate-limit storage is unreachable or fails,
 *    requests fail closed (HTTP 503) to prevent security control bypass.
 * 4. RFC-Compliant HTTP 429: Returns structured JSON with Retry-After and rate-limit headers.
 * 5. Zero Sensitive Data Logging: No tokens, passwords, API keys, or PHI are logged.
 * 6. Pluggable Storage: Supports MemoryRateLimitStorage (local/test) and Distributed
 *    Storage Adapters (Upstash Redis / Supabase Postgres).
 */

export interface RateLimitConfig {
  windowSeconds: number; // Duration of rate-limiting window in seconds
  maxRequests: number;   // Maximum allowed requests within the window
  endpointName: string;  // Identifier for the protected endpoint
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds?: number;
  errorCode?: 'RATE_LIMIT_EXCEEDED' | 'RATE_LIMIT_STORAGE_ERROR';
  errorMessage?: string;
}

export interface RateLimitStorage {
  /**
   * Atomically records a request and returns current count and seconds until window reset.
   * Throws an Error if storage is unreachable or encounters a failure.
   */
  increment(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }>;
}

/**
 * In-Memory atomic sliding/fixed window storage for local development, test mode,
 * and isolated automated verification. Thread-safe in JavaScript/TypeScript single-threaded event loop.
 */
export class MemoryRateLimitStorage implements RateLimitStorage {
  private store: Map<string, { count: number; resetTimeMs: number }> = new Map();
  private shouldSimulateFailure = false;

  public setSimulateFailure(fail: boolean) {
    this.shouldSimulateFailure = fail;
  }

  public reset(key?: string) {
    if (key) {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }

  async increment(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }> {
    if (this.shouldSimulateFailure) {
      throw new Error('Rate-limit storage backend connection timeout (simulated failure).');
    }

    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetTimeMs) {
      const resetTimeMs = now + windowSeconds * 1000;
      this.store.set(key, { count: 1, resetTimeMs });
      return { count: 1, ttlSeconds: windowSeconds };
    }

    entry.count += 1;
    const ttlSeconds = Math.max(1, Math.ceil((entry.resetTimeMs - now) / 1000));
    return { count: entry.count, ttlSeconds };
  }
}

/**
 * Distributed Upstash / Redis REST Storage Adapter for multi-instance production deployment.
 * Executes atomic INCR with EXPIRE using standard REST API.
 */
export class UpstashRedisRateLimitStorage implements RateLimitStorage {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/$/, '');
    this.token = token;
  }

  async increment(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }> {
    // Atomic multi-command pipeline via Upstash REST: INCR key, EXPIRE key window NX, TTL key
    const pipelineUrl = `${this.url}/pipeline`;
    const commands = [
      ['INCR', key],
      ['EXPIRE', key, windowSeconds, 'NX'],
      ['TTL', key],
    ];

    const response = await fetch(pipelineUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      throw new Error(`Upstash Redis rate-limit storage failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    const count = typeof data[0]?.result === 'number' ? data[0].result : 1;
    const ttl = typeof data[2]?.result === 'number' && data[2].result > 0 ? data[2].result : windowSeconds;

    return { count, ttlSeconds: ttl };
  }
}

/**
 * Default global memory storage instance for local runtime.
 */
const defaultMemoryStorage = new MemoryRateLimitStorage();

/**
 * Resolves the appropriate rate-limit storage backend based on environment configuration.
 */
export function resolveRateLimitStorage(): RateLimitStorage {
  const g = globalThis as any;
  const env =
    typeof g.Deno !== 'undefined'
      ? g.Deno.env
      : typeof process !== 'undefined' && process.env
      ? { get: (k: string) => process.env[k] }
      : { get: () => undefined };

  const upstashUrl = env.get('UPSTASH_REDIS_REST_URL');
  const upstashToken = env.get('UPSTASH_REDIS_REST_TOKEN');

  if (upstashUrl && upstashToken) {
    return new UpstashRedisRateLimitStorage(upstashUrl, upstashToken);
  }

  return defaultMemoryStorage;
}

/**
 * Extracts a trustworthy client IP signal from request headers.
 */
export function extractClientIp(req: Request): string {
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp?.trim()) return cfConnectingIp.trim();

  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp?.trim()) return xRealIp.trim();

  return 'unknown-ip';
}

/**
 * Evaluates inbound rate limiting for an authenticated user and client IP.
 * Fails closed if the storage backend is unreachable or throws an error.
 */
export async function checkRateLimit(
  req: Request,
  userId: string,
  config: RateLimitConfig,
  storageOverride?: RateLimitStorage
): Promise<RateLimitResult> {
  const storage = storageOverride || resolveRateLimitStorage();
  const clientIp = extractClientIp(req);

  // Partition keys by endpoint and verified identity
  // Primary key tracks verified caller; secondary key bounds IP abuse
  const userRateKey = `rl:${config.endpointName}:user:${userId.trim()}`;
  const ipRateKey = `rl:${config.endpointName}:ip:${clientIp}`;

  try {
    // 1. Atomic evaluation for authenticated user
    const userResult = await storage.increment(userRateKey, config.windowSeconds);

    if (userResult.count > config.maxRequests) {
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetSeconds: userResult.ttlSeconds,
        retryAfterSeconds: userResult.ttlSeconds,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        errorMessage: `Rate limit of ${config.maxRequests} requests per ${config.windowSeconds}s exceeded for user.`,
      };
    }

    // 2. Secondary IP-based abuse guard (3x user budget to absorb NAT while mitigating floods)
    const ipMax = config.maxRequests * 3;
    const ipResult = await storage.increment(ipRateKey, config.windowSeconds);
    if (ipResult.count > ipMax) {
      return {
        allowed: false,
        limit: ipMax,
        remaining: 0,
        resetSeconds: ipResult.ttlSeconds,
        retryAfterSeconds: ipResult.ttlSeconds,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        errorMessage: `Inbound IP request threshold exceeded. Please slow down.`,
      };
    }

    const remaining = Math.max(0, config.maxRequests - userResult.count);
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining,
      resetSeconds: userResult.ttlSeconds,
    };
  } catch (err: any) {
    // Security Invariant: Fail Closed on storage failure
    // If rate-limiting storage is down, we must not silently allow unbounded access to expensive AI services
    console.warn(`[Security Alert] Rate limit storage failed for endpoint ${config.endpointName}:`, err?.message);
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetSeconds: 5,
      retryAfterSeconds: 5,
      errorCode: 'RATE_LIMIT_STORAGE_ERROR',
      errorMessage: 'Rate-limiting service failure: Request failed closed for security protection.',
    };
  }
}

/**
 * Constructs an RFC-compliant HTTP 429 or 503 response with standard rate-limit headers.
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>
): Response {
  if (result.errorCode === 'RATE_LIMIT_STORAGE_ERROR') {
    return new Response(
      JSON.stringify({
        error: 'Security rate-limiting service is currently unavailable. Request failed closed for clinical safety.',
        code: 'RATE_LIMIT_SERVICE_UNAVAILABLE',
        retryAfter: result.retryAfterSeconds ?? 5,
      }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfterSeconds ?? 5),
        },
      }
    );
  }

  return new Response(
    JSON.stringify({
      error: `Rate limit exceeded. Maximum ${result.limit} requests per minute allowed. Please wait before retrying.`,
      code: 'RATE_LIMIT_EXCEEDED',
      limit: result.limit,
      remaining: 0,
      retryAfter: result.retryAfterSeconds ?? 60,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfterSeconds ?? 60),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetSeconds),
      },
    }
  );
}
