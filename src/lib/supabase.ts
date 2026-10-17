import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Retrieve credentials safely from Vite environment
const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const rawKey = (
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
)?.trim();

/**
 * Validates whether the Supabase URL is well-formed and non-placeholder.
 */
function isValidSupabaseUrl(url: string | undefined): url is string {
  if (!url) return false;
  // Guard against template / placeholder values
  if (
    url.includes('placeholder') ||
    url.includes('your-project') ||
    url.includes('<') ||
    url.includes('>') ||
    url.includes('example.com')
  ) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Validates whether the Supabase key is non-placeholder and sufficiently long.
 */
function isValidSupabaseKey(key: string | undefined): key is string {
  if (!key) return false;
  if (
    key.includes('placeholder') ||
    key.includes('your-anon-key') ||
    key.includes('<') ||
    key.includes('>')
  ) {
    return false;
  }
  return key.length >= 20;
}

const hasValidUrl = isValidSupabaseUrl(rawUrl);
const hasValidKey = isValidSupabaseKey(rawKey);

let clientInstance: SupabaseClient | null = null;
let configError: string | null = null;

if (hasValidUrl && hasValidKey) {
  try {
    clientInstance = createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (err) {
    configError = err instanceof Error ? err.message : 'Failed to initialize Supabase client';
    console.warn('[PulseBridge] Supabase client initialization failed:', configError);
    clientInstance = null;
  }
} else if (rawUrl || rawKey) {
  configError = 'Supabase credentials are incomplete or invalid placeholders.';
  console.warn('[PulseBridge] Running in Demo Mode:', configError);
}

export const isSupabaseConfigured = Boolean(clientInstance);
export const isDemoMode = !isSupabaseConfigured;
export const supabase: SupabaseClient | null = clientInstance;
export const supabaseConfigError: string | null = configError;

