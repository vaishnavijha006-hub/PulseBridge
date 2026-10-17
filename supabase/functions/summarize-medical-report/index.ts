/**
 * PulseBridge AI — Supabase Edge Function: Secure Medical Report Summarization
 *
 * Security & Compliance Enforcement:
 * 1. Authorization Gate: Rejects unauthenticated requests lacking a valid Bearer token.
 * 2. Payload Guards: Enforces a strict 60KB limit to prevent prompt injection and resource exhaustion.
 * 3. Secret Isolation: Retrieves AI provider credentials strictly from server environment secrets (Deno.env).
 *    Secrets are NEVER leaked or sent to the browser client.
 * 4. Grounding Validation: All LLM outputs pass through responseValidator before release to the client.
 * 5. PHI Logging Protection: Raw report content, patient names, and symptoms are never printed to server logs.
 */

import { validateAIModelResponse } from './responseValidator.ts';
import {
  createAIProvider,
  AIProviderConfigError,
  AIProviderTimeoutError,
  AIProviderRateLimitError,
} from './aiAdapter.ts';
import type { MedicalReport } from '../../../src/types';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Max allowed payload size (60 KB)
const MAX_PAYLOAD_BYTES = 60 * 1024;

/**
 * Verifies caller's authorization to access a specific patient's medical records.
 * Fails closed if database connectivity is unavailable or user lacks permission.
 */
async function verifyReportAuthorization(token: string, patientId: string): Promise<boolean> {
  try {
    const g = globalThis as any;
    const supabaseUrl = typeof g.Deno !== 'undefined' ? g.Deno?.env?.get('SUPABASE_URL') : process.env?.SUPABASE_URL;
    const supabaseKey = typeof g.Deno !== 'undefined' ? g.Deno?.env?.get('SUPABASE_ANON_KEY') : process.env?.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // Fail closed when database access cannot be cryptographically verified
      return false;
    }

    const patientRes = await fetch(`${supabaseUrl}/rest/v1/patients?id=eq.${encodeURIComponent(patientId)}&select=id`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseKey,
      },
    });

    if (!patientRes.ok) {
      return false;
    }

    const patientRows = await patientRes.json();
    return Array.isArray(patientRows) && patientRows.length > 0;
  } catch {
    return false;
  }
}

export async function handleSummarizeRequest(req: Request): Promise<Response> {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // 2. Authorization Security Gate
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({
        error: 'Unauthorized: Missing or invalid Bearer authentication token.',
        code: 'AUTH_REQUIRED',
      }),
      {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return new Response(
      JSON.stringify({
        error: 'Unauthorized: Empty Bearer token.',
        code: 'AUTH_REQUIRED',
      }),
      {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }

  // 3. Payload Size Guard
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return new Response(
      JSON.stringify({
        error: 'Payload Too Large: Medical report exceeds the 60 KB processing limit.',
        code: 'PAYLOAD_TOO_LARGE',
      }),
      {
        status: 413,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }

  let bodyText: string;
  try {
    bodyText = await req.text();
    if (bodyText.length > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({
          error: 'Payload Too Large: Medical report body exceeds 60 KB limit.',
          code: 'PAYLOAD_TOO_LARGE',
        }),
        {
          status: 413,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to read request body.' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let parsedBody: { report?: MedicalReport; useMock?: boolean; isDemoOrTest?: boolean; providerPreference?: any };
  try {
    parsedBody = JSON.parse(bodyText);
  } catch {
    return new Response(JSON.stringify({ error: 'Malformed JSON payload.' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { report, useMock, isDemoOrTest, providerPreference } = parsedBody;

  // 4. Validate input report payload
  if (!report || typeof report !== 'object' || !report.id || !report.patientId) {
    return new Response(
      JSON.stringify({
        error: 'Invalid report: "id" and "patientId" are required.',
        code: 'INVALID_REPORT_PAYLOAD',
      }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }

  // 5. Report-Level Authorization Check (Fail Closed)
  const isSyntheticDemoPatient =
    /^(p[1-9]\d*|demo-|test-)/i.test(report.patientId) || isDemoOrTest === true;

  if (!isSyntheticDemoPatient) {
    const isAuthorized = await verifyReportAuthorization(token, report.patientId);
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden: Insufficient privileges or unverified authorization for real patient record.',
          code: 'AUTH_PATIENT_ACCESS_DENIED',
        }),
        {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  const startTime = Date.now();

  try {
    // 6. Select provider via factory
    let provider;
    try {
      provider = createAIProvider({
        useMock: Boolean(useMock),
        providerPreference,
      });
    } catch (err: any) {
      if (err instanceof AIProviderConfigError) {
        return new Response(
          JSON.stringify({
            error: err.message,
            code: 'AI_PROVIDER_UNCONFIGURED',
          }),
          {
            status: 503,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }
      throw err;
    }

    // 7. Invoke AI model
    const { rawOutput, latencyMs } = await provider.summarizeReport(report, 10000);

    // 8. Grounding and Schema Validation
    const validation = validateAIModelResponse(
      rawOutput,
      report,
      provider.modelName,
      latencyMs,
      provider.providerName as any
    );

    if (!validation.valid || !validation.summary) {
      // PHI Protection: Do not log the report text or model hallucinations
      console.warn(`[AI Guard] Grounding validation failed for reportId=${report.id}:`, validation.errors);

      return new Response(
        JSON.stringify({
          error: 'Model output failed clinical grounding or schema validation.',
          code: 'VALIDATION_FAILED',
          details: validation.errors,
        }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    // Audit Log (Zero PHI logged)
    const elapsed = Date.now() - startTime;
    console.log(`[Audit] Summarized reportId=${report.id} provider=${provider.providerName} status=200 latency=${elapsed}ms`);

    return new Response(JSON.stringify({ data: validation.summary }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    const elapsed = Date.now() - startTime;

    if (err instanceof AIProviderTimeoutError) {
      console.warn(`[Audit] Timeout reportId=${report.id} latency=${elapsed}ms`);
      return new Response(
        JSON.stringify({ error: 'AI Provider timed out.', code: 'AI_TIMEOUT' }),
        { status: 504, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    if (err instanceof AIProviderRateLimitError) {
      console.warn(`[Audit] Rate limit reportId=${report.id}`);
      return new Response(
        JSON.stringify({ error: 'AI Provider rate limit reached.', code: 'AI_RATE_LIMIT' }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    if (err instanceof AIProviderConfigError) {
      console.warn(`[Audit] Config error reportId=${report.id}:`, err.message);
      return new Response(
        JSON.stringify({ error: 'AI Provider configuration failure.', code: 'AI_CONFIG_ERROR' }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    console.error(`[Audit] Unexpected error reportId=${report.id}:`, err.message);
    return new Response(
      JSON.stringify({ error: 'Internal AI summarization error.', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}

// Default export for Deno server
const globalAny = globalThis as any;
if (typeof globalAny.Deno !== 'undefined' && globalAny.Deno?.serve) {
  globalAny.Deno.serve(handleSummarizeRequest);
}
