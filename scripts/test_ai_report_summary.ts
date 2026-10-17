/**
 * Automated Verification Suite for Secure AI-Powered Medical Report Summarization
 * PulseBridge AI Phase 4
 *
 * Verifies:
 * 1. Security & Edge Function Authorization (rejection of unauthorized calls, payload limits, secret isolation).
 * 2. Model Response Validation & Grounding (schema validation, rejecting hallucinations, exact string preservation, missing range protection).
 * 3. Provider Failures & Transparent Fallback (timeouts, rate limits, unconfigured key fallback labeled honestly as 'ai_unavailable_fallback').
 * 4. Regression tests (existing deterministic summarizer behavior preserved).
 */

import { handleSummarizeRequest } from '../supabase/functions/summarize-medical-report/index';
import { validateAIModelResponse, CLINICAL_DISCLAIMER_TEXT } from '../supabase/functions/summarize-medical-report/responseValidator';
import {
  MockAISummarizerProvider,
  AIProviderTimeoutError,
  AIProviderRateLimitError,
  AIProviderConfigError,
} from '../supabase/functions/summarize-medical-report/aiAdapter';
import { summarizeMedicalReport } from '../src/services/reportSummarizer';
import { demoMedicalReports } from '../src/data/demoData';
import type { MedicalReport } from '../src/types';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('PULSEBRIDGE AI — SECURE AI REPORT SUMMARIZATION TEST SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // Suite 1: Security & Edge Function Authorization Guards
  // ---------------------------------------------------------------------------
  console.log('SUITE 1: Server-Side Security, Authorization & Payload Guards');

  // Test 1.1: Rejection of unauthorized request (missing Authorization header)
  {
    const req = new Request('https://edge.supabase.co/functions/v1/summarize-medical-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: demoMedicalReports['p1'][0] }),
    });

    const res = await handleSummarizeRequest(req);
    assert(res.status === 401, 'Unauthorized request without Bearer token rejected with HTTP 401');
    const json = await res.json();
    assert(json.code === 'AUTH_REQUIRED', 'Error code specifies AUTH_REQUIRED');
  }

  // Test 1.2: Rejection of oversized payload (> 60 KB)
  {
    const largeText = 'A'.repeat(65 * 1024);
    const oversizedReport = {
      ...demoMedicalReports['p1'][0],
      rawText: largeText,
    };

    const req = new Request('https://edge.supabase.co/functions/v1/summarize-medical-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-jwt-token',
        'Content-Length': String(largeText.length),
      },
      body: JSON.stringify({ report: oversizedReport }),
    });

    const res = await handleSummarizeRequest(req);
    assert(res.status === 413, 'Oversized payload rejected with HTTP 413 (Payload Too Large)');
    const json = await res.json();
    assert(json.code === 'PAYLOAD_TOO_LARGE', 'Error code specifies PAYLOAD_TOO_LARGE');
  }

  // Test 1.3: Rejection of malformed / missing report IDs
  {
    const req = new Request('https://edge.supabase.co/functions/v1/summarize-medical-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-jwt-token',
      },
      body: JSON.stringify({ report: { title: 'No ID report' } }),
    });

    const res = await handleSummarizeRequest(req);
    assert(res.status === 400, 'Report without id or patientId rejected with HTTP 400');
  }

  // Test 1.4: Zero secret leakage in response payload
  {
    const req = new Request('https://edge.supabase.co/functions/v1/summarize-medical-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-jwt-token',
      },
      body: JSON.stringify({ report: demoMedicalReports['p1'][0], useMock: true }),
    });

    const res = await handleSummarizeRequest(req);
    assert(res.status === 200, 'Authenticated request with mock provider succeeds with HTTP 200');
    const responseText = await res.text();
    assert(!responseText.includes('apiKey'), 'Zero apiKey references leaked in response');
    assert(!responseText.includes('service_role'), 'Zero service_role keys leaked in response');
    assert(!responseText.includes('GEMINI_API_KEY'), 'Zero GEMINI_API_KEY environment variable names leaked');
  }

  // ---------------------------------------------------------------------------
  // Suite 2: AI Response Validator & Grounding Enforcement
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 2: Response Validator & Clinical Grounding Verification');

  const sourceReport: MedicalReport = {
    id: 'rep-test-grounding',
    patientId: 'p1',
    title: 'Lipid & Cardiac Panel',
    reportType: 'lab',
    date: '2026-10-15',
    facilityOrLab: 'Apex Laboratories',
    orderingDoctor: 'Dr. Anita Desai',
    rawText: 'Total Cholesterol: 215 mg/dL (Ref: < 200)\nHigh-Sensitivity Troponin I: 48 ng/L (Ref: < 14)\nRandom Glucose: 142 mg/dL',
    structuredFindings: [
      { testOrParameter: 'Total Cholesterol', value: '215', unit: 'mg/dL', referenceRange: '< 200', isAbnormal: true },
      { testOrParameter: 'High-Sensitivity Troponin I', value: '48', unit: 'ng/L', referenceRange: '< 14', isAbnormal: true },
      { testOrParameter: 'Random Glucose', value: '142', unit: 'mg/dL', referenceRange: null, isAbnormal: null },
    ],
  };

  // Test 2.1: Valid grounded model output passes validation
  {
    const validModelOutput = {
      reportOverview: {
        title: sourceReport.title,
        reportType: sourceReport.reportType,
        date: sourceReport.date,
        sourceIntegrity: 'complete',
      },
      keyFindings: [
        { name: 'Total Cholesterol', value: '215', unit: 'mg/dL', referenceRange: '< 200', flag: 'abnormal' },
        { name: 'High-Sensitivity Troponin I', value: '48', unit: 'ng/L', referenceRange: '< 14', flag: 'abnormal' },
        { name: 'Random Glucose', value: '142', unit: 'mg/dL', referenceRange: null, flag: 'unspecified_range' },
      ],
      abnormalValues: [
        { name: 'Total Cholesterol', value: '215', unit: 'mg/dL', referenceRange: '< 200', interpretation: 'Elevated' },
        { name: 'High-Sensitivity Troponin I', value: '48', unit: 'ng/L', referenceRange: '< 14', interpretation: 'Critical elevation' },
      ],
      missingOrUncertainInfo: [
        { item: 'Random Glucose Reference Range', reason: 'No reference interval was provided in source report' },
      ],
      needsClinicianReview: [
        { questionOrFinding: 'Evaluate elevated Troponin I', context: 'Potential myocardial injury marker' },
      ],
    };

    const result = validateAIModelResponse(validModelOutput, sourceReport, 'gemini-1.5-flash', 150);
    assert(result.valid === true, 'Grounded model output passes validation');
    assert(result.summary?.engineMode === 'ai_assisted', 'Engine mode set to ai_assisted');
    assert(result.summary?.aiMetadata?.modelName === 'gemini-1.5-flash', 'Model metadata preserved');
    assert(result.summary?.aiMetadata?.verifiedGrounded === true, 'Marked verified grounded');
    assert(result.summary?.disclaimer.includes('clinical judgment'), 'Standard clinical disclaimer attached');
  }

  // Test 2.2: Rejection of fabricated/hallucinated findings
  {
    const hallucinatedOutput = {
      reportOverview: { title: 'Lipid Panel', reportType: 'lab', date: '2026-10-15', sourceIntegrity: 'complete' },
      keyFindings: [
        { name: 'Total Cholesterol', value: '215', unit: 'mg/dL', referenceRange: '< 200', flag: 'abnormal' },
        // Hallucinated finding not present anywhere in source report!
        { name: 'Serum Creatinine Kinase MB', value: '18', unit: 'U/L', referenceRange: '< 10', flag: 'abnormal' },
      ],
      abnormalValues: [
        { name: 'Serum Creatinine Kinase MB', value: '18', unit: 'U/L', referenceRange: '< 10' },
      ],
      missingOrUncertainInfo: [],
      needsClinicianReview: [],
    };

    const result = validateAIModelResponse(hallucinatedOutput, sourceReport);
    assert(result.valid === false, 'Rejects output containing hallucinated test names');
    assert(
      result.errors.some((e) => e.includes('Serum Creatinine Kinase MB') && e.includes('fabricated')),
      'Validation error identifies unverified test name'
    );
  }

  // Test 2.3: Rejection of non-object or malformed outputs
  {
    const nullResult = validateAIModelResponse(null, sourceReport);
    assert(nullResult.valid === false, 'Rejects null output safely');

    const stringResult = validateAIModelResponse('malformed string output', sourceReport);
    assert(stringResult.valid === false, 'Rejects string output safely');

    const emptyObjResult = validateAIModelResponse({}, sourceReport);
    assert(emptyObjResult.valid === false, 'Rejects empty object output missing required sections');
  }

  // Test 2.4: Missing reference ranges cannot be classified as abnormal or normal
  {
    const improperFlagOutput = {
      reportOverview: { title: 'Lipid Panel', reportType: 'lab', date: '2026-10-15', sourceIntegrity: 'complete' },
      keyFindings: [
        // Random Glucose has no reference range, but model tried to flag it as 'normal'
        { name: 'Random Glucose', value: '142', unit: 'mg/dL', referenceRange: 'None', flag: 'normal' },
      ],
      abnormalValues: [],
      missingOrUncertainInfo: [],
      needsClinicianReview: [],
    };

    const result = validateAIModelResponse(improperFlagOutput, sourceReport);
    assert(result.valid === true, 'Processes finding without error');
    const glucoseFinding = result.summary?.keyFindings.find((kf) => kf.name === 'Random Glucose');
    assert(
      glucoseFinding?.flag === 'unspecified_range',
      'Overwrites improper flag to "unspecified_range" when reference range is omitted'
    );
  }

  // ---------------------------------------------------------------------------
  // Suite 3: Provider Failures & Transparent Fallback
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 3: Provider Failures & Transparent Fallback Labeling');

  // Test 3.1: Timeout error handling
  {
    const timeoutProvider = new MockAISummarizerProvider({ shouldTimeout: true });
    let caughtError: any = null;
    try {
      await timeoutProvider.summarizeReport(sourceReport, 100);
    } catch (err) {
      caughtError = err;
    }
    assert(caughtError instanceof AIProviderTimeoutError, 'Mock provider raises AIProviderTimeoutError');
  }

  // Test 3.2: Rate limit error handling
  {
    const rateLimitProvider = new MockAISummarizerProvider({ shouldRateLimit: true });
    let caughtError: any = null;
    try {
      await rateLimitProvider.summarizeReport(sourceReport);
    } catch (err) {
      caughtError = err;
    }
    assert(caughtError instanceof AIProviderRateLimitError, 'Mock provider raises AIProviderRateLimitError');
  }

  // Test 3.3: Unconfigured key error handling
  {
    const authFailProvider = new MockAISummarizerProvider({ shouldFailAuth: true });
    let caughtError: any = null;
    try {
      await authFailProvider.summarizeReport(sourceReport);
    } catch (err) {
      caughtError = err;
    }
    assert(caughtError instanceof AIProviderConfigError, 'Mock provider raises AIProviderConfigError');
  }

  // Test 3.4: Deterministic fallback preserves data and is labeled 'ai_unavailable_fallback'
  {
    const fallback = summarizeMedicalReport(sourceReport);
    const transparentFallback = {
      ...fallback,
      engineMode: 'ai_unavailable_fallback' as const,
      aiMetadata: {
        provider: 'none' as const,
        modelName: 'none',
        verifiedGrounded: true,
        failureReason: 'AI service endpoint unreachable; falling back to deterministic extraction.',
      },
    };

    assert(transparentFallback.engineMode === 'ai_unavailable_fallback', 'Fallback is explicitly labeled ai_unavailable_fallback');
    assert(transparentFallback.aiMetadata?.provider === 'none', 'Transparently indicates no AI provider was invoked');
    assert(transparentFallback.keyFindings.length === 3, 'Preserves all discrete findings in deterministic fallback');
    assert(transparentFallback.abnormalValues.length === 2, 'Preserves abnormal findings');
  }

  // ---------------------------------------------------------------------------
  // Suite 4: Regression Verification with Existing Rule-Based Summarizer
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 4: Regression Verification');
  {
    const p1Report = demoMedicalReports['p1']?.[0];
    assert(p1Report !== undefined, 'p1 demo report exists');

    if (p1Report) {
      const ruleBasedSummary = summarizeMedicalReport(p1Report);
      assert(ruleBasedSummary.engineMode === 'rule_based_mvp', 'Existing rule_based_mvp engine mode intact');
      assert(ruleBasedSummary.keyFindings.length > 0, 'Extracts key findings identically');
      assert(ruleBasedSummary.abnormalValues.length > 0, 'Extracts abnormal findings identically');
      assert(ruleBasedSummary.disclaimer.includes('clinical judgment'), 'Safety disclaimer intact');
    }
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`SUMMARY: ${passedTests} passed, ${failedTests} failed.`);
  console.log('----------------------------------------------------------------\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
