/**
 * PulseBridge AI — Gemini Multimodal Vision Prescription Adapter
 * File: supabase/functions/scan-prescription/geminiVisionAdapter.ts
 *
 * Requirements:
 * 1. Multimodal image input via Gemini API generateContent (inlineData: { mimeType, data }).
 * 2. Configurable model via server-side GEMINI_MODEL (default: 'gemini-3.8-flash').
 * 3. Request structured JSON containing fields supported by existing PrescriptionDraft/PrescriptionField.
 * 4. Grounding: Extract only visibly present information, preserve original wording, mark missing/illegible as uncertain.
 * 5. Secret Isolation: GEMINI_API_KEY read exclusively from server environment; never logged or leaked.
 * 6. Resilient handling: AbortController timeout, rate-limit retry/error, sanitized messages.
 */

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiConfigError';
  }
}

export class GeminiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiTimeoutError';
  }
}

export class GeminiRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiRateLimitError';
  }
}

export class GeminiAPIError extends Error {
  public readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'GeminiAPIError';
    this.status = status;
  }
}

export interface PrescriptionVisionAdapter {
  readonly providerName: string;
  readonly modelName: string;
  scanPrescription(
    imageBase64: string,
    mimeType: string,
    timeoutMs?: number
  ): Promise<{ rawOutput: unknown; latencyMs: number }>;
}

export const PRESCRIPTION_VISION_SYSTEM_PROMPT = `
You are PulseBridge AI, an automated clinical prescription parameter extraction assistant.
Analyze the supplied prescription image and extract structured medication parameters formatted strictly as a JSON object.

CRITICAL CLINICAL SAFETY RULES:
1. Grounding: Extract ONLY parameters that are visibly and legibly written on the prescription image.
2. Never Guess: If a medication name, dosage strength, frequency, duration, or instruction is cut off, smudged, or illegible, leave the value empty ("") and mark its status as "uncertain".
3. Literal Preservation: Preserve the exact medication spelling, units, and instructions verbatim from the prescription.
4. No Fabrication: Never invent missing parameters, schedules, or dates.
5. Non-Diagnostic: Do not validate appropriateness, add unprescribed medications, or alter dosages.

OUTPUT JSON SCHEMA:
{
  "fields": [
    {
      "key": "medicine",
      "labelKey": "rx_field_medicine",
      "value": "string (name of medication or empty string if illegible)",
      "status": "confirmed" | "uncertain"
    },
    {
      "key": "dosage",
      "labelKey": "rx_field_dosage",
      "value": "string (e.g. 500mg, 10mg, or empty string)",
      "status": "confirmed" | "uncertain"
    },
    {
      "key": "frequency",
      "labelKey": "rx_field_frequency",
      "value": "string (e.g. Once daily, Twice daily, or empty string)",
      "status": "confirmed" | "uncertain"
    },
    {
      "key": "duration",
      "labelKey": "rx_field_duration",
      "value": "string (e.g. 7 days, 14 days, or empty string)",
      "status": "confirmed" | "uncertain"
    },
    {
      "key": "instructions",
      "labelKey": "rx_field_instructions",
      "value": "string (e.g. After meals with water, or empty string)",
      "status": "confirmed" | "uncertain"
    }
  ],
  "rawTranscription": "string (literal transcript of visible prescription text)"
}
`;

function getServerEnv(name: string): string | undefined {
  const g = globalThis as any;
  if (typeof g.Deno !== 'undefined' && g.Deno?.env?.get) {
    return g.Deno.env.get(name);
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[name];
  }
  return undefined;
}

export class GeminiVisionAdapter implements PrescriptionVisionAdapter {
  public readonly providerName = 'gemini_vision';
  public readonly modelName: string;
  private apiKey: string;

  constructor(apiKey?: string, modelName?: string) {
    const key = apiKey || getServerEnv('GEMINI_API_KEY') || getServerEnv('AI_PROVIDER_API_KEY');
    if (!key) {
      throw new GeminiConfigError('GEMINI_API_KEY is not configured on the server.');
    }
    this.apiKey = key;
    this.modelName = modelName || getServerEnv('GEMINI_MODEL') || 'gemini-3.8-flash';
  }

  public async scanPrescription(
    imageBase64: string,
    mimeType: string,
    timeoutMs: number = 15000
  ): Promise<{ rawOutput: unknown; latencyMs: number }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();

    // Clean base64 string if data URL prefix was supplied
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const payload = {
      systemInstruction: {
        parts: [{ text: PRESCRIPTION_VISION_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: 'Please extract all visible prescription parameters from this image in structured JSON format.',
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (response.status === 429) {
        throw new GeminiRateLimitError('Google Gemini rate limit exceeded. Please retry shortly.');
      }

      if (response.status === 401 || response.status === 403) {
        throw new GeminiConfigError('Google Gemini API authentication rejected. Verify server-side credentials.');
      }

      if (!response.ok) {
        throw new GeminiAPIError(`Gemini API returned HTTP ${response.status}.`, response.status);
      }

      const responseData = await response.json();
      const textContent = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) {
        throw new Error('Gemini API returned an empty completion.');
      }

      const parsedJSON = JSON.parse(textContent);
      return { rawOutput: parsedJSON, latencyMs };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new GeminiTimeoutError(`Gemini vision provider timed out after ${timeoutMs}ms.`);
      }
      throw err;
    }
  }
}

/**
 * Mock adapter for deterministic automated tests and offline simulation.
 */
export class MockGeminiVisionAdapter implements PrescriptionVisionAdapter {
  public readonly providerName = 'mock_gemini_vision';
  public readonly modelName = 'mock-gemini-vision-v1';
  private mockOutput?: unknown;

  constructor(customOutput?: unknown) {
    this.mockOutput = customOutput;
  }

  public async scanPrescription(
    _imageBase64: string,
    _mimeType: string,
    _timeoutMs: number = 5000
  ): Promise<{ rawOutput: unknown; latencyMs: number }> {
    if (this.mockOutput) {
      return { rawOutput: this.mockOutput, latencyMs: 5 };
    }

    return {
      rawOutput: {
        fields: [
          { key: 'medicine', labelKey: 'rx_field_medicine', value: 'Amoxicillin', status: 'confirmed' },
          { key: 'dosage', labelKey: 'rx_field_dosage', value: '500mg', status: 'confirmed' },
          { key: 'frequency', labelKey: 'rx_field_frequency', value: 'Thrice daily (08:00, 14:00, 20:00)', status: 'confirmed' },
          { key: 'duration', labelKey: 'rx_field_duration', value: '7 days', status: 'confirmed' },
          { key: 'instructions', labelKey: 'rx_field_instructions', value: 'Take after meals with plenty of water', status: 'confirmed' },
        ],
        rawTranscription: 'Rx:\nTab Amoxicillin 500mg\nTake thrice daily after meals for 7 days\nTake with plenty of water',
      },
      latencyMs: 10,
    };
  }
}
