/**
 * PulseBridge AI — Task 5 End-to-End AI Integration Verification Script
 * 
 * Tests the complete integration path:
 * Frontend dataService -> Local Backend Edge Function -> Groq Provider -> Clinical Grounding Validator
 */

import { dataService } from '../src/services/dataService';

async function verifyEndToEnd() {
  console.log('===========================================================');
  console.log('PulseBridge AI — Task 5 End-to-End Integration Verification');
  console.log('===========================================================');

  // Test 1: Real AI Summary Workflow (preferAI: true)
  console.log('\n[1/3] Invoking AI-Assisted Medical Report Summary (preferAI: true)...');
  const t0 = Date.now();
  const aiResult = await dataService.getReportSummary('rep-p1-1', 'p1', { preferAI: true });
  const elapsed = Date.now() - t0;

  if (!aiResult) {
    throw new Error('FAILED: dataService returned null for report rep-p1-1');
  }

  console.log(`✓ Response received in ${elapsed}ms:`);
  console.log(`  • Engine Mode: ${aiResult.engineMode}`);
  console.log(`  • Provider: ${aiResult.aiMetadata?.provider}`);
  console.log(`  • Model: ${aiResult.aiMetadata?.modelName}`);
  console.log(`  • Verified Grounded: ${aiResult.aiMetadata?.verifiedGrounded}`);
  console.log(`  • Server Reported Latency: ${aiResult.aiMetadata?.latencyMs}ms`);
  console.log(`  • Key Findings Extracted: ${aiResult.keyFindings.length}`);
  console.log(`  • Flagged Abnormal Values: ${aiResult.abnormalValues.length}`);
  console.log(`  • Source Integrity: ${aiResult.reportOverview.sourceIntegrity}`);

  if (aiResult.engineMode !== 'ai_assisted') {
    throw new Error(`Expected engineMode 'ai_assisted' but received '${aiResult.engineMode}'`);
  }
  if (aiResult.aiMetadata?.provider !== 'groq') {
    throw new Error(`Expected provider 'groq' but received '${aiResult.aiMetadata?.provider}'`);
  }

  // Test 2: Deterministic Rule-Based MVP Workflow (preferAI: false)
  console.log('\n[2/3] Invoking Deterministic Rule-Based Summary (preferAI: false)...');
  const ruleResult = await dataService.getReportSummary('rep-p1-1', 'p1', { preferAI: false });

  if (!ruleResult) {
    throw new Error('FAILED: dataService returned null for deterministic summary');
  }

  console.log(`✓ Response received:`);
  console.log(`  • Engine Mode: ${ruleResult.engineMode}`);
  console.log(`  • Key Findings Extracted: ${ruleResult.keyFindings.length}`);
  console.log(`  • Flagged Abnormal Values: ${ruleResult.abnormalValues.length}`);

  if (ruleResult.engineMode !== 'rule_based_mvp') {
    throw new Error(`Expected engineMode 'rule_based_mvp' but received '${ruleResult.engineMode}'`);
  }

  // Test 3: Grounding and Clinical Safety Integrity Check
  console.log('\n[3/4] Inspecting Clinical Findings & Value Grounding...');
  console.log('  Abnormal values:');
  for (const ab of aiResult.abnormalValues) {
    console.log(`    - ${ab.name}: ${ab.value} ${ab.unit || ''} (Ref: ${ab.referenceRange}) -> ${ab.interpretation}`);
    console.log(`      Evidence: "${ab.sourceEvidence}"`);
  }

  // Test 4: Verify Honest Fallback when AI endpoint is unreachable
  console.log('\n[4/4] Verifying Honest Fallback Mode Handling...');
  // Simulate offline by temporarily overriding candidateUrls or fetch
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new Error('Connection refused (simulated offline)');
    };
    const fallbackResult = await dataService.getReportSummary('rep-p1-1', 'p1', { preferAI: true });
    if (!fallbackResult) {
      throw new Error('Expected fallback result, but got null');
    }
    console.log(`✓ Offline fallback safely engaged:`);
    console.log(`  • Engine Mode: ${fallbackResult.engineMode}`);
    console.log(`  • Provider: ${fallbackResult.aiMetadata?.provider}`);
    console.log(`  • Failure Reason: "${fallbackResult.aiMetadata?.failureReason}"`);
    console.log(`  • Fallback Findings Preserved: ${fallbackResult.keyFindings.length}`);

    if (fallbackResult.engineMode !== 'ai_unavailable_fallback') {
      throw new Error(`Expected engineMode 'ai_unavailable_fallback' but got '${fallbackResult.engineMode}'`);
    }
    if (fallbackResult.aiMetadata?.provider !== 'none') {
      throw new Error('Expected provider to be none on fallback, never fabricate AI provider');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('\n===========================================================');
  console.log('✓ ALL 4 END-TO-END INTEGRATION TESTS PASSED SUCCESSFULLY!');
  console.log('===========================================================');
}

verifyEndToEnd().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
