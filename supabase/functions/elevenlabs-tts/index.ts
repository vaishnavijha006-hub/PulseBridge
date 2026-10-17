/**
 * PulseBridge AI — Supabase Edge Function: ElevenLabs Text-to-Speech Proxy
 *
 * Security & Reliability Enforcement:
 * 1. Secret Isolation: The ELEVENLABS_API_KEY is retrieved exclusively from server
 *    environment secrets (Deno.env.get). Secrets are never exposed to the client.
 * 2. Rate & Abuse Protection: Enforces strict character limits (max 600 chars)
 *    to prevent cost overrun and abuse.
 * 3. Safe Language & Voice Resolution: Defaults to eleven_multilingual_v2 with
 *    curated Hindi and English voices.
 * 4. PHI Protection: Input text must only be navigation/guidance prompts; clinical
 *    or identifiable patient records are not processed or logged.
 * 5. Caching & CORS: Preflight and CORS headers are returned to allow secure web access.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_TEXT_LENGTH = 600;

// Curated high-clarity premade voices supported across Free and Paid plans
// These can be overridden via server environment variables
const DEFAULT_EN_VOICE = 'EXAVITQu4vr4xnSDxMaL'; // Sarah (Premade, Reassuring & Confident)
const DEFAULT_HI_VOICE = 'JBFqnCBsd6RMkjVDRZzb'; // George (Premade, Warm & Clear with eleven_multilingual_v2)

export interface TTSRequestBody {
  text: string;
  lang?: 'en' | 'hi';
  voiceId?: string;
}

export async function handleTTSRequest(req: Request): Promise<Response> {
  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // 2. Secret Resolution
  const g = globalThis as any;
  const apiKey = typeof g.Deno !== 'undefined'
    ? g.Deno?.env?.get('ELEVENLABS_API_KEY')
    : process.env?.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'ElevenLabs API key is not configured on the server.',
        code: 'TTS_NOT_CONFIGURED',
      }),
      {
        status: 503,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }

  // 3. Payload Extraction & Validation
  let body: TTSRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON request payload.', code: 'INVALID_JSON' }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }

  const { text, lang = 'en', voiceId } = body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'Field "text" is required and must be non-empty.', code: 'INVALID_TEXT' }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return new Response(
      JSON.stringify({
        error: `Text length (${text.length}) exceeds maximum allowable length of ${MAX_TEXT_LENGTH} characters.`,
        code: 'TEXT_TOO_LONG',
      }),
      {
        status: 413,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }

  // 4. Voice ID Selection
  const envVoiceHi = typeof g.Deno !== 'undefined'
    ? g.Deno?.env?.get('ELEVENLABS_VOICE_ID_HI')
    : process.env?.ELEVENLABS_VOICE_ID_HI;
  const envVoiceEn = typeof g.Deno !== 'undefined'
    ? g.Deno?.env?.get('ELEVENLABS_VOICE_ID_EN')
    : process.env?.ELEVENLABS_VOICE_ID_EN;

  const targetVoiceId =
    voiceId ||
    (lang === 'hi' ? envVoiceHi || DEFAULT_HI_VOICE : envVoiceEn || DEFAULT_EN_VOICE);

  // 5. Invoke ElevenLabs Text-to-Speech API
  const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(targetVoiceId)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const upstreamRes = await fetch(elevenLabsUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      let parsedErr: any = null;
      try {
        parsedErr = JSON.parse(errText);
      } catch {
        // Raw text
      }

      console.warn(`[ElevenLabs TTS] Upstream error status=${upstreamRes.status}`);

      return new Response(
        JSON.stringify({
          error: parsedErr?.detail?.message || 'ElevenLabs upstream service error.',
          code: upstreamRes.status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'UPSTREAM_TTS_ERROR',
          status: upstreamRes.status,
        }),
        {
          status: upstreamRes.status === 429 ? 429 : 502,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    // 6. Return binary audio
    const audioBuffer = await upstreamRes.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Content-Length': String(audioBuffer.byteLength),
      },
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err?.name === 'AbortError';

    return new Response(
      JSON.stringify({
        error: isTimeout ? 'ElevenLabs TTS request timed out.' : 'Failed to connect to TTS service.',
        code: isTimeout ? 'TIMEOUT' : 'SERVICE_UNAVAILABLE',
      }),
      {
        status: isTimeout ? 504 : 503,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }
}

// Default export for Deno server
const globalAny = globalThis as any;
if (typeof globalAny.Deno !== 'undefined' && globalAny.Deno?.serve) {
  globalAny.Deno.serve(handleTTSRequest);
}
