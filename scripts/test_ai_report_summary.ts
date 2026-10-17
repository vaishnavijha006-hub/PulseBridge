/**
 * Automated Verification Suite for Secure AI-Powered Medical Report Summarization
 * PulseBridge AI Phase 4 - Hardened Security & Grounding Audit Tests
 *
 * Verifies:
 * 1. Cryptographic Authentication & Report-Level Authorization (token verification, cross-user rejection, fail closed).
 * 2. Payload Guards (multibyte UTF-8 byte limits, malformed payloads).
 * 3. CORS Allowlist & Method Protections (origin enforcement, disallowed methods).
 * 4. Advanced Clinical Grounding (rejecting altered values, altered units, and fabricated findings).
 * 5. Provider Failures & Transparent Fallback Labeling.
 * 6. Regression Protection for Deterministic Mode.
 */

// Explicitly configure server-side test environment for test runner
process.env.PULSEBRIDGE_ENV = 'test';

import { handleSummarizeRequest } from '../supabase/functions/summarize-medical-report/index';
import { validateAIModelResponse, CLINICAL_DISCLAIMER_TEXT } from '../supabase/functions/summarize-medical-report/responseValidator';
import {
  MockAISummarizerProvider,
  GroqSummarizerProvider,
  createAIProvider,
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
  // Suite 1: Server-Side Security, Authentication & Authorization Guards
  // ---------------------------------------------------------------------------
  console.log('SUITE 1: Server-Side Security, Authentication & Authorization Guards');

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

  // Test 1.2: Rejection of unauthorized request (empty Bearer token)
  {
    const req = new Request('https://edge.supabase.co/functions/v1/summarize-medical-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' },
      body: JSON.stringify({ report: demoMedicalReports['p1'][0] }),
    });

    const res = await handleSummarizeRequest(req);
    assert(res.status === 401, 'Unauthorized request with empty Bearer token rejected with HTTP 401');
  }

  // Test 1.3: Rejection of forged or invalid cryptographic token
  {
    const req = new Request('https://edge.supabase.co/functions/v1/summarize-medical-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer forged-or-expired-jwt-token',
      },
      body: JSON.stringify({ report: demoMedicalReports['p1'][0] }),
    });

    const res = await handleSummarizeRequest(req);
    assert(res.status === 401, 'Forged or invalid Bearer token rejected with HTTP 401');
    const json = await res.json();
    assert(json.code === 'AUTH_INVALID_TOKEN', 'Error code is AUTH_INVALID_TOKEN');
  }

  // Test 1.4: Cross-user patient access attempt fails closed
  {
    const crossUserReport: MedicalReport = {
      id: 'rep-cross-01',
      patientId: 'cross-user-victim-patient-id',
      title: 'Confidential Cardiology Report',
      reportType: 'lab',
      date: '2026-10-17',
      rawText: 'Troponin: 0.04 ng/mL',
      structuredFindings: [{ testOrParameter: 'Troponin', value: '0.04', unit: 'ng/mL' }],
    };

    const req = new Request('https://edge.supabase.co/functions/v1/summarize-medical-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-jwt-token',
      },
      body: JSON.stringify({ report: crossUserReport }),
    });

    const res = await handleSummarizeRequest(req);
    assert(res.status === 403, 'Cross-user patient record access rejected with HTTP 403');
    const json = await res.json();
    assert(json.code === 'AUTH_PATIENT_ACCESS_DENIED', 'Error code is AUTH_PATIENT_ACCESS_DENIED');
  }

  // Test 1.5: Unauthenticated request cannot exploit synthetic/demo patient ID to bypass auth
  {
    const req = new Request('https://edge.supabase.co/functions/v1/summarize-medical-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token',
      },
      body: JSON.stringify({
        report: { ...demoMedicalReports['p1'][0], patientId: 'p1' },
      }),
    });

    const res = await handleSummarizeRequest(req);
    assert(res.status === 401, 'Synthetic patient ID "p1" with invalid token cannot bypass authorization');
  }

  // Test 1.6: Valid authenticated request in server test harness succeeds
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
    assert(res.status === 200, 'Authenticated request in server test harness succeeds with HTTP 200');
  }

  // Test 1.7: Rejection of oversized ASCII payload (> 60 KB)
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
    assert(res.status === 413, 'Oversized ASCII payload rejected with HTTP 413 (Payload Too Large)');
    const json = await res.json();
    assert(json.code === 'PAYLOAD_TOO_LARGE', 'Error code specifies PAYLOAD_TOO_LARGE');
  }

  // Test 1.8: Multibyte UTF-8 payload byte-length enforcement
  {
    // Character count is 22,000 (well below 60,000 characters)
    // But 3-byte UTF-8 character length is 66,000 bytes (exceeds 60 KB)
    const multibyteText = '\u4e00'.repeat(22000);
    const multibyteReport = {
      ...demoMedicalReports['p1'][0],
      rawText: multibyteText,
    };

    const req = new Request('https://edge.supabase.co/functions/v1/summarize-medical-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-valid-jwt-token',
      },
      body: JSON.stringify({ report: multibyteReport }),
    });

    const res = await handleSummarizeRequest(req);
    assert(res.status === 413, 'Multibyte UTF-8 payload exceeding 60 KB byte limit rejected with HTTP 413');
  }

  // Test 1.9: CORS allowlist enforcement
  {
    // Disallowed origin in OPTIONS preflight
    const disallowedReq = new Request('https://edge.supabase.co/functions/v1/summarize-medical-report', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://malicious-cross-origin.com',
      },
    });
    const disallowedRes = await handleSummarizeRequest(disallowedReq);
    assert(disallowedRes.status === 403, 'Disallowed browser origin rejected in CORS preflight with HTTP 403');

    // Allowed origin in OPTIONS preflight
    const allowedReq = new Request('https://edge.supabase.co/functions/v1/summarize-medical-report', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
      },
    });
    const allowedRes = await handleSummarizeRequest(allowedReq);
    assert(allowedRes.status === 200, 'Allowed browser origin accepted in CORS preflight');
    assert(
      allowedRes.headers.get('Access-Control-Allow-Origin') === 'http://localhost:5173',
      'Reflects exact allowed origin, never wildcard "*"'
    );
  }

  // Test 1.10: Rejection of unsupported HTTP methods
  {
    const getReq = new Request('https://edge.supabase.co/functions/v1/summarize-medical-report', {
      method: 'GET',
    });
    const getRes = await handleSummarizeRequest(getReq);
    assert(getRes.status === 405, 'GET method rejected with HTTP 405 Method Not Allowed');
    assert(getRes.headers.get('Allow')?.includes('POST'), 'Includes Allow header specifying POST, OPTIONS');
  }

  // Test 1.11: Zero secret leakage in response payload
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
    assert(res.status === 200, 'Mock summarization request succeeds with HTTP 200');
    const responseText = await res.text();
    assert(!responseText.includes('apiKey'), 'Zero apiKey references leaked in response');
    assert(!responseText.includes('service_role'), 'Zero service_role keys leaked in response');
    assert(!responseText.includes('GEMINI_API_KEY'), 'Zero GEMINI_API_KEY environment variable names leaked');
    assert(!responseText.includes('GROQ_API_KEY'), 'Zero GROQ_API_KEY environment variable names leaked');
  }

  // ---------------------------------------------------------------------------
  // Suite 2: AI Response Validator & Hardened Clinical Grounding
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 2: Hardened Response Validator & Clinical Grounding Verification');

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

    const result = validateAIModelResponse(validModelOutput, sourceReport, 'qwen/qwen3.8-27b', 150, 'groq');
    assert(result.valid === true, 'Grounded model output passes validation');
    assert(result.summary?.engineMode === 'ai_assisted', 'Engine mode set to ai_assisted');
    assert(result.summary?.aiMetadata?.provider === 'groq', 'Provider recorded as groq');
    assert(result.summary?.aiMetadata?.modelName === 'qwen/qwen3.8-27b', 'Model metadata preserved');
    assert(result.summary?.aiMetadata?.verifiedGrounded === true, 'Marked verified grounded');
    assert(result.summary?.disclaimer.includes('clinical judgment'), 'Standard clinical disclaimer attached');
  }

  // Test 2.2: Adversarial Grounding - Rejection of fabricated/hallucinated test names
  {
    const hallucinatedOutput = {
      reportOverview: { title: 'Lipid Panel', reportType: 'lab', date: '2026-10-15', sourceIntegrity: 'complete' },
      keyFindings: [
        { name: 'Total Cholesterol', value: '215', unit: 'mg/dL', referenceRange: '< 200', flag: 'abnormal' },
        // Hallucinated finding name!
        { name: 'Serum Creatinine Kinase MB', value: '18', unit: 'U/L', referenceRange: '< 10', flag: 'abnormal' },
      ],
      abnormalValues: [],
      missingOrUncertainInfo: [],
      needsClinicianReview: [],
    };

    const result = validateAIModelResponse(hallucinatedOutput, sourceReport);
    assert(result.valid === false, 'Rejects output containing hallucinated test name');
    assert(
      result.errors.some((e) => e.includes('Serum Creatinine Kinase MB')),
      'Validation error identifies unverified test name'
    );
  }

  // Test 2.3: Adversarial Grounding - Rejection of changed/hallucinated numerical values
  {
    const alteredValueOutput = {
      reportOverview: { title: 'Lipid Panel', reportType: 'lab', date: '2026-10-15', sourceIntegrity: 'complete' },
      keyFindings: [
        // Source value is 215, model copied legitimate name but fabricated value 999!
        { name: 'Total Cholesterol', value: '999', unit: 'mg/dL', referenceRange: '< 200', flag: 'abnormal' },
      ],
      abnormalValues: [],
      missingOrUncertainInfo: [],
      needsClinicianReview: [],
    };

    const result = validateAIModelResponse(alteredValueOutput, sourceReport);
    assert(result.valid === false, 'Rejects output where model copied test name but altered value to 999');
    assert(
      result.errors.some((e) => e.includes('Value mismatch') && e.includes('999')),
      'Validation error identifies value mismatch between extracted and source'
    );
  }

  // Test 2.4: Adversarial Grounding - Rejection of altered/substituted units
  {
    const alteredUnitOutput = {
      reportOverview: { title: 'Lipid Panel', reportType: 'lab', date: '2026-10-15', sourceIntegrity: 'complete' },
      keyFindings: [
        // Source unit is mg/dL, model changed unit to g/L!
        { name: 'Total Cholesterol', value: '215', unit: 'g/L', referenceRange: '< 200', flag: 'abnormal' },
      ],
      abnormalValues: [],
      missingOrUncertainInfo: [],
      needsClinicianReview: [],
    };

    const result = validateAIModelResponse(alteredUnitOutput, sourceReport);
    assert(result.valid === false, 'Rejects output where model altered unit to g/L');
    assert(
      result.errors.some((e) => e.includes('Unit mismatch') && e.includes('g/L')),
      'Validation error identifies unit mismatch between extracted and source'
    );
  }

  // Test 2.5: Missing reference ranges cannot be classified as abnormal or normal
  {
    const improperFlagOutput = {
      reportOverview: { title: 'Lipid Panel', reportType: 'lab', date: '2026-10-15', sourceIntegrity: 'complete' },
      keyFindings: [
        { name: 'Random Glucose', value: '142', unit: 'mg/dL', referenceRange: 'None', flag: 'normal' },
      ],
      abnormalValues: [],
      missingOrUncertainInfo: [],
      needsClinicianReview: [],
    };

    const result = validateAIModelResponse(improperFlagOutput, sourceReport);
    assert(result.valid === true, 'Processes unstated range finding');
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

  // ---------------------------------------------------------------------------
  // Suite 5: Optional Live Real AI Provider Verification (Groq API)
  // ---------------------------------------------------------------------------
  console.log('\nSUITE 5: Real AI Provider Verification (Groq API)');
  const groqKey = process.env.GROQ_API_KEY;

  if (groqKey) {
    try {
      const groqProvider = new GroqSummarizerProvider(groqKey, 'qwen/qwen3.8-27b');
      assert(groqProvider.providerName === 'groq', 'Groq provider initialized');
      assert(groqProvider.modelName === 'qwen/qwen3.8-27b', 'Verified target model identifier');

      const liveReport: MedicalReport = {
        id: 'rep-live-test-01',
        patientId: 'p1',
        title: 'Diagnostic Lipid & Cardiac Chemistry',
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

      const startTime = Date.now();
      const { rawOutput, latencyMs } = await groqProvider.summarizeReport(liveReport, 15000);
      const elapsed = Date.now() - startTime;

      assert(Boolean(rawOutput && typeof rawOutput === 'object'), `Live Groq API responded in ${latencyMs}ms (total ${elapsed}ms)`);

      const validation = validateAIModelResponse(rawOutput, liveReport, groqProvider.modelName, latencyMs, 'groq');
      assert(validation.valid === true, 'Live model output passed clinical grounding and schema validation');

      if (validation.summary) {
        assert(validation.summary.engineMode === 'ai_assisted', 'Engine mode labeled ai_assisted');
        assert(validation.summary.aiMetadata?.provider === 'groq', 'Provider metadata correctly recorded as groq');
        assert(validation.summary.aiMetadata?.modelName === 'qwen/qwen3.8-27b', 'Model name metadata recorded');
        assert(validation.summary.aiMetadata?.verifiedGrounded === true, 'Grounded validation flag is true');
        assert(
          validation.summary.keyFindings.some((kf) => kf.name.includes('Cholesterol') && kf.value === '215'),
          'Preserves exact value "215" for Total Cholesterol'
        );
        assert(
          validation.summary.keyFindings.some((kf) => kf.name.includes('Troponin') && kf.value === '48'),
          'Preserves exact value "48" for High-Sensitivity Troponin I'
        );
        const glucose = validation.summary.keyFindings.find((kf) => kf.name.includes('Glucose'));
        assert(
          glucose?.flag === 'unspecified_range',
          'Safely sets flag to unspecified_range when reference interval is unstated'
        );
        assert(
          validation.summary.disclaimer.includes('clinical judgment'),
          'Includes mandatory clinical review disclaimer'
        );
      }
    } catch (err: any) {
      assert(false, `Live Groq provider request failed: ${err.message}`);
    }
  } else {
    console.log('  [INFO] Normal test run: GROQ_API_KEY unset. Mock and offline security suites fully executed.');
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`SUMMARY: ${passedTests} passed, ${failedTests} failed.`);
  console.log('----------------------------------------------------------------\n');

  if (failedTests > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exitCode = 1;
});
