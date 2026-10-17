/**
 * PulseBridge AI — Vendor-Agnostic Server-Side AI Adapter
 *
 * Implements Google Gemini 1.5 Flash structured output and mock test adapter.
 * Provider secrets are NEVER passed from or exposed to the client browser.
 */

import type { MedicalReport } from '../../../src/types';

export class AIProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIProviderConfigError';
  }
}

export class AIProviderTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIProviderTimeoutError';
  }
}

export class AIProviderRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIProviderRateLimitError';
  }
}

export interface AISummarizerProvider {
  readonly providerName: string;
  readonly modelName: string;
  summarizeReport(report: Readonly<MedicalReport>, timeoutMs?: number): Promise<{ rawOutput: unknown; latencyMs: number }>;
}

/**
 * System prompt instructing the model to adhere to clinical grounding and safety.
 */
export const CLINICAL_SUMMARIZATION_SYSTEM_PROMPT = `
You are PulseBridge AI, an automated clinical laboratory and diagnostic report extraction assistant.
Your task is to analyze the supplied medical report and extract a strictly grounded structured summary formatted as a valid JSON object.

CRITICAL CLINICAL SAFETY RULES:
1. Grounding: Every extracted finding must strictly exist in the report. Never invent tests, numbers, units, or clinical diagnoses.
2. Literal Preservation: Preserve the exact value and unit strings verbatim (e.g. "48", "ng/L", "8.4", "%"). Do not convert units, normalize decimals, or alter text.
3. Reference Ranges: If a reference range is not stated in the report, set flag to "unspecified_range" and referenceRange to "Reference range not provided". NEVER assume a missing reference range is normal or abnormal.
4. Abnormal Findings: Include in "abnormalValues" ONLY tests where the result falls outside the explicitly stated reference range or where the laboratory explicitly labeled it abnormal/elevated/low.
5. Unreadable Content: If any portion of the report is smudged, illegible, or incomplete, record it in "missingOrUncertainInfo" and flag it for clinician review.
6. Zero Autonomous Actions: Do not recommend starting, stopping, or altering medications or care plans.

OUTPUT JSON SCHEMA:
{
  "reportOverview": {
    "title": "string",
    "reportType": "lab",
    "date": "string",
    "facility": "string | null",
    "orderingDoctor": "string | null",
    "sourceIntegrity": "complete" | "incomplete" | "unreadable" | "empty"
  },
  "keyFindings": [
    {
      "name": "string",
      "value": "string",
      "unit": "string | null",
      "referenceRange": "string",
      "flag": "normal" | "abnormal" | "unspecified_range",
      "sourceEvidence": "string"
    }
  ],
  "abnormalValues": [
    {
      "name": "string",
      "value": "string",
      "unit": "string | null",
      "referenceRange": "string",
      "interpretation": "string",
      "sourceEvidence": "string"
    }
  ],
  "missingOrUncertainInfo": [
    {
      "item": "string",
      "reason": "string"
    }
  ],
  "needsClinicianReview": [
    {
      "questionOrFinding": "string",
      "context": "string"
    }
  ]
}
`;

/**
 * Google Gemini 1.5 Flash Provider Adapter
 */
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

export class GroqSummarizerProvider implements AISummarizerProvider {
  public readonly providerName = 'groq';
  public readonly modelName: string;
  private apiKey: string;

  constructor(apiKey?: string, modelName?: string) {
    const key = apiKey || getServerEnv('GROQ_API_KEY') || getServerEnv('AI_PROVIDER_API_KEY');
    if (!key) {
      throw new AIProviderConfigError('GROQ_API_KEY or AI_PROVIDER_API_KEY is not configured on the server.');
    }
    this.apiKey = key;
    this.modelName = modelName || getServerEnv('GROQ_MODEL') || 'qwen/qwen3.8-27b';
  }

  public async summarizeReport(
    report: Readonly<MedicalReport>,
    timeoutMs: number = 10000
  ): Promise<{ rawOutput: unknown; latencyMs: number }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();

    const userPrompt = `Please summarize this medical report according to the clinical safety guidelines:

Title: ${report.title}
Report Type: ${report.reportType}
Date: ${report.date}
Facility: ${report.facilityOrLab || 'Not specified'}
Doctor: ${report.orderingDoctor || 'Not specified'}

RAW REPORT CONTENT:
${report.rawText || ''}

STRUCTURED FINDINGS ON FILE:
${JSON.stringify(report.structuredFindings || [], null, 2)}`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: CLINICAL_SUMMARIZATION_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 800,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (response.status === 429) {
        const retryAfterSec = parseFloat(response.headers.get('retry-after') || '2.5');
        const waitMs = Math.min(Math.max(retryAfterSec * 1000, 2000), 4000);
        if (Date.now() - startTime + waitMs < timeoutMs - 1000) {
          await new Promise((r) => setTimeout(r, waitMs));
          const retryRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: this.modelName,
              messages: [
                { role: 'system', content: CLINICAL_SUMMARIZATION_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.1,
              max_tokens: 800,
            }),
            signal: controller.signal,
          });
          if (retryRes.ok) {
            clearTimeout(timeoutId);
            const latencyMs = Date.now() - startTime;
            const data = await retryRes.json();
            const textContent = data.choices?.[0]?.message?.content;
            if (!textContent) {
              throw new Error('Groq model returned an empty choice payload on retry.');
            }
            try {
              const parsed = JSON.parse(textContent);
              return { rawOutput: parsed, latencyMs };
            } catch {
              return { rawOutput: textContent, latencyMs };
            }
          }
        }
        throw new AIProviderRateLimitError('Groq API rate limit exceeded. Please retry shortly.');
      }

      if (response.status === 401 || response.status === 403) {
        throw new AIProviderConfigError('Groq API authentication rejected. Verify server-side API key.');
      }

      if (!response.ok) {
        throw new Error(`Groq API returned HTTP error ${response.status}.`);
      }

      const responseData = await response.json();
      const content = responseData?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Groq API returned an empty completion content.');
      }

      const parsedJSON = JSON.parse(content);
      return { rawOutput: parsedJSON, latencyMs };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new AIProviderTimeoutError(`AI provider timed out after ${timeoutMs}ms.`);
      }
      throw err;
    }
  }
}

export class GeminiSummarizerProvider implements AISummarizerProvider {
  public readonly providerName = 'gemini';
  public readonly modelName: string;
  private apiKey: string;

  constructor(apiKey?: string, modelName: string = 'gemini-1.5-flash') {
    const key = apiKey || getServerEnv('GEMINI_API_KEY') || getServerEnv('AI_PROVIDER_API_KEY');
    if (!key) {
      throw new AIProviderConfigError('GEMINI_API_KEY or AI_PROVIDER_API_KEY is not configured on the server.');
    }
    this.apiKey = key;
    this.modelName = modelName;
  }

  public async summarizeReport(
    report: Readonly<MedicalReport>,
    timeoutMs: number = 10000
  ): Promise<{ rawOutput: unknown; latencyMs: number }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const promptPayload = {
      systemInstruction: {
        parts: [{ text: CLINICAL_SUMMARIZATION_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Please summarize this medical report according to the clinical safety guidelines:\n\nTitle: ${report.title}\nReport Type: ${report.reportType}\nDate: ${report.date}\nFacility: ${report.facilityOrLab || 'Not specified'}\nDoctor: ${report.orderingDoctor || 'Not specified'}\n\nRAW REPORT CONTENT:\n${report.rawText || ''}\n\nSTRUCTURED FINDINGS ON FILE:\n${JSON.stringify(report.structuredFindings || [], null, 2)}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1, // Low temperature for deterministic clinical extraction
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(promptPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (response.status === 429) {
        throw new AIProviderRateLimitError('Google Gemini rate limit exceeded. Please retry shortly.');
      }

      if (response.status === 401 || response.status === 403) {
        throw new AIProviderConfigError('Google Gemini API authentication rejected. Verify server-side API key.');
      }

      if (!response.ok) {
        throw new Error(`Google Gemini API returned HTTP error ${response.status}.`);
      }

      const responseData = await response.json();
      const candidateText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText) {
        throw new Error('Google Gemini API returned an empty candidate payload.');
      }

      const parsedJSON = JSON.parse(candidateText);
      return { rawOutput: parsedJSON, latencyMs };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new AIProviderTimeoutError(`AI provider timed out after ${timeoutMs}ms.`);
      }
      throw err;
    }
  }
}

/**
 * Mock AI Provider for local testing, offline development, and regression verification
 */
export class MockAISummarizerProvider implements AISummarizerProvider {
  public readonly providerName = 'mock_test_provider';
  public readonly modelName = 'mock-clinical-v1';
  private shouldTimeout: boolean;
  private shouldFailAuth: boolean;
  private shouldRateLimit: boolean;

  constructor(options: { shouldTimeout?: boolean; shouldFailAuth?: boolean; shouldRateLimit?: boolean } = {}) {
    this.shouldTimeout = Boolean(options.shouldTimeout);
    this.shouldFailAuth = Boolean(options.shouldFailAuth);
    this.shouldRateLimit = Boolean(options.shouldRateLimit);
  }

  public async summarizeReport(
    report: Readonly<MedicalReport>,
    timeoutMs: number = 5000
  ): Promise<{ rawOutput: unknown; latencyMs: number }> {
    if (this.shouldFailAuth) {
      throw new AIProviderConfigError('Mock AI Provider authentication failure: Invalid server secret.');
    }
    if (this.shouldRateLimit) {
      throw new AIProviderRateLimitError('Mock AI Provider rate limit exceeded (HTTP 429).');
    }
    if (this.shouldTimeout) {
      throw new AIProviderTimeoutError(`Mock AI Provider timed out after ${timeoutMs}ms.`);
    }

    const latencyMs = 120;

    // Build grounded mock output directly from source report findings
    const keyFindings = (report.structuredFindings || []).map((f) => ({
      name: f.testOrParameter,
      value: f.value,
      unit: f.unit || null,
      referenceRange: f.referenceRange || 'Reference range not provided',
      flag: f.isAbnormal === true ? 'abnormal' : (f.isAbnormal === false ? 'normal' : 'unspecified_range'),
      sourceEvidence: `${f.testOrParameter}: ${f.value} ${f.unit || ''}`.trim(),
    }));

    const abnormalValues = (report.structuredFindings || [])
      .filter((f) => f.isAbnormal === true && f.referenceRange)
      .map((f) => ({
        name: f.testOrParameter,
        value: f.value,
        unit: f.unit || null,
        referenceRange: f.referenceRange || '',
        interpretation: f.clinicalNotes || 'Elevated above reference limit',
        sourceEvidence: `${f.testOrParameter}: ${f.value} ${f.unit || ''} (Ref: ${f.referenceRange})`,
      }));

    const missingOrUncertainInfo: { item: string; reason: string }[] = [];
    const needsClinicianReview: { questionOrFinding: string; context: string }[] = [];

    // Check missing reference ranges
    for (const f of report.structuredFindings || []) {
      if (!f.referenceRange) {
        missingOrUncertainInfo.push({
          item: `${f.testOrParameter} Reference Range`,
          reason: 'No clinical reference standard was provided in the report.',
        });
        needsClinicianReview.push({
          questionOrFinding: `Verify reference range standard for ${f.testOrParameter}`,
          context: 'Omitted range must not be assumed normal.',
        });
      }
    }

    // Check unreadable text
    if (/\b(unreadable|smudge)\b/i.test(report.rawText || '')) {
      missingOrUncertainInfo.push({
        item: 'Source Document Legibility',
        reason: 'Carbon copy print artifact or unreadable value detected in report.',
      });
      needsClinicianReview.push({
        questionOrFinding: 'Re-inspect physical source document',
        context: 'Illegible value requires direct manual intake.',
      });
    }

    const rawOutput = {
      reportOverview: {
        title: report.title,
        reportType: report.reportType,
        date: report.date,
        facility: report.facilityOrLab,
        orderingDoctor: report.orderingDoctor,
        sourceIntegrity: missingOrUncertainInfo.some((m) => m.reason.includes('unreadable')) ? 'unreadable' : 'complete',
      },
      keyFindings,
      abnormalValues,
      missingOrUncertainInfo,
      needsClinicianReview,
    };

    return { rawOutput, latencyMs };
  }
}

/**
 * AI Provider Factory with automatic environment detection
 */
export function createAIProvider(options?: {
  useMock?: boolean;
  providerPreference?: 'groq' | 'gemini' | 'mock_test_provider';
  apiKey?: string;
  modelName?: string;
  mockOptions?: { shouldTimeout?: boolean; shouldFailAuth?: boolean; shouldRateLimit?: boolean };
}): AISummarizerProvider {
  if (options?.useMock) {
    return new MockAISummarizerProvider(options.mockOptions);
  }

  const groqKey = options?.apiKey || getServerEnv('GROQ_API_KEY');
  const geminiKey = options?.apiKey || getServerEnv('GEMINI_API_KEY') || getServerEnv('AI_PROVIDER_API_KEY');

  if (options?.providerPreference === 'groq' && groqKey) {
    return new GroqSummarizerProvider(groqKey, options.modelName);
  }
  if (options?.providerPreference === 'gemini' && geminiKey) {
    return new GeminiSummarizerProvider(geminiKey, options.modelName);
  }

  // Auto-detect based on configured server secrets
  if (groqKey) {
    return new GroqSummarizerProvider(groqKey, options?.modelName);
  }
  if (geminiKey) {
    return new GeminiSummarizerProvider(geminiKey, options?.modelName);
  }

  throw new AIProviderConfigError(
    'No supported AI provider secret found on server. Configure GROQ_API_KEY or GEMINI_API_KEY.'
  );
}

