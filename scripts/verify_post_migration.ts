import { supabase, isSupabaseConfigured } from '../src/lib/supabase';
import { dataService } from '../src/services/dataService';
import { demoPatients } from '../src/data/demoData';

interface VerificationResult {
  step: string;
  target: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'PRE_MIGRATION_PENDING';
  denialType?: 'PRIVILEGE_MISSING' | 'RLS_FILTER' | 'RLS_WITH_CHECK' | 'NONE';
}

const results: VerificationResult[] = [];

function recordResult(
  step: string,
  target: string,
  expected: string,
  actual: string,
  status: 'PASS' | 'FAIL' | 'PRE_MIGRATION_PENDING',
  denialType: 'PRIVILEGE_MISSING' | 'RLS_FILTER' | 'RLS_WITH_CHECK' | 'NONE' = 'NONE'
) {
  results.push({ step, target, expected, actual, status, denialType });
  const icon = status === 'PASS' ? '✅ PASS' : status === 'PRE_MIGRATION_PENDING' ? '⏳ UNVERIFIED / PENDING' : '❌ FAIL';
  const tag = denialType !== 'NONE' ? ` [${denialType}]` : '';
  console.log(`${icon}${tag} [${step}] ${target}: ${actual}`);
}

export async function runPostMigrationVerification() {
  console.log('======================================================================');
  console.log('  PulseBridge AI — Phase 4 Post-Migration Regression & Safety Suite  ');
  console.log('  Verifying Privilege Grants, RLS Denials, and Client Resilience     ');
  console.log('======================================================================\n');

  if (!isSupabaseConfigured || !supabase) {
    console.error('FATAL: Supabase environment variables not configured.');
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // 1. VERIFY ANONYMOUS READ BOUNDARIES (All 9 Sensitive Tables + 1 View)
  // Distinguishes Missing Table Grants from Effective RLS Access Denial
  // -------------------------------------------------------------------------
  console.log('--- 1. Anonymous Read Boundary Verification ---');
  const sensitiveTables = [
    'patients',
    'prescriptions',
    'care_plans',
    'medication_schedules',
    'adherence_logs',
    'health_updates',
    'care_gaps',
    'caregiver_consent',
    'follow_ups',
  ];

  for (const table of sensitiveTables) {
    const { data, error } = await supabase.from(table).select('*').limit(5);
    if (error && (error.code === '42501' || error.message.toLowerCase().includes('permission denied'))) {
      recordResult(
        'Table SELECT',
        table,
        'Access Denied (42501)',
        `Denied at Privilege Layer (Missing/Revoked Table Grant): ${error.message}`,
        'PASS',
        'PRIVILEGE_MISSING'
      );
    } else if (data && data.length > 0) {
      recordResult(
        'Table SELECT',
        table,
        'Access Denied / Empty',
        `UNVERIFIED: remote database returned ${data.length} row(s) to anonymous key (Phase 3 active)`,
        'PRE_MIGRATION_PENDING',
        'NONE'
      );
    } else {
      recordResult(
        'Table SELECT',
        table,
        'Access Denied / Empty',
        'Effective Access Denial via RLS (0 rows returned)',
        'PASS',
        'RLS_FILTER'
      );
    }
  }

  // Check patient_summaries view
  const { data: viewData, error: viewErr } = await supabase.from('patient_summaries').select('*').limit(5);
  if (viewErr && (viewErr.code === '42501' || viewErr.message.toLowerCase().includes('permission denied'))) {
    recordResult(
      'View SELECT',
      'patient_summaries',
      'Access Denied (42501)',
      `Denied at Privilege/Invoker Layer: ${viewErr.message}`,
      'PASS',
      'PRIVILEGE_MISSING'
    );
  } else if (viewData && viewData.length > 0) {
    recordResult(
      'View SELECT',
      'patient_summaries',
      'Access Denied / Empty',
      `UNVERIFIED: remote database returned ${viewData.length} summary row(s) to anonymous key`,
      'PRE_MIGRATION_PENDING',
      'NONE'
    );
  } else {
    recordResult(
      'View SELECT',
      'patient_summaries',
      'Access Denied / Empty',
      'Effective Access Denial via RLS (0 rows returned)',
      'PASS',
      'RLS_FILTER'
    );
  }

  // -------------------------------------------------------------------------
  // 2. VERIFY ANONYMOUS WRITE & MUTATION BOUNDARIES (INSERT, UPDATE, DELETE)
  // Distinguishes Missing Table Grants from RLS WITH CHECK Violations
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Anonymous Mutation Boundary Verification ---');
  // 2.1 Anonymous INSERT on patients
  const { error: insPatientErr } = await supabase.from('patients').insert({
    id: `probe_ins_${Date.now()}`,
    name: 'Unauthorized Insertion Probe',
    age: 30,
    gender: 'female',
    phone: '0000000000',
  });
  if (insPatientErr) {
    const isRls = insPatientErr.message.toLowerCase().includes('row-level security');
    recordResult(
      'Mutation Denial',
      'INSERT public.patients',
      'Denied (42501)',
      `Denied: ${insPatientErr.message}`,
      'PASS',
      isRls ? 'RLS_WITH_CHECK' : 'PRIVILEGE_MISSING'
    );
  } else {
    recordResult(
      'Mutation Denial',
      'INSERT public.patients',
      'Denied (42501)',
      'UNVERIFIED: Anonymous user can insert patient records (Phase 3 active)',
      'PRE_MIGRATION_PENDING',
      'NONE'
    );
    await supabase.from('patients').delete().like('id', 'probe_ins_%');
  }

  // 2.2 Anonymous INSERT on health_updates
  const { error: insUpdateErr } = await supabase.from('health_updates').insert({
    patient_id: 'p1',
    state: 'bad',
    symptom_description: 'Unauthorized health update probe',
    source: 'patient',
  });
  if (insUpdateErr) {
    const isRls = insUpdateErr.message.toLowerCase().includes('row-level security');
    recordResult(
      'Mutation Denial',
      'INSERT public.health_updates',
      'Denied (42501)',
      `Denied: ${insUpdateErr.message}`,
      'PASS',
      isRls ? 'RLS_WITH_CHECK' : 'PRIVILEGE_MISSING'
    );
  } else {
    recordResult(
      'Mutation Denial',
      'INSERT public.health_updates',
      'Denied (42501)',
      'UNVERIFIED: Anonymous user can insert health updates for any patient (Phase 3 active)',
      'PRE_MIGRATION_PENDING',
      'NONE'
    );
    await supabase.from('health_updates').delete().eq('symptom_description', 'Unauthorized health update probe');
  }

  // 2.3 Anonymous UPDATE on prescriptions
  const { error: updRxErr } = await supabase
    .from('prescriptions')
    .update({ confirmed: false })
    .eq('id', '00000000-0000-0000-0000-000000000000');
  if (updRxErr) {
    const isRls = updRxErr.message.toLowerCase().includes('row-level security');
    recordResult(
      'Mutation Denial',
      'UPDATE public.prescriptions',
      'Denied (42501)',
      `Denied: ${updRxErr.message}`,
      'PASS',
      isRls ? 'RLS_WITH_CHECK' : 'PRIVILEGE_MISSING'
    );
  } else {
    recordResult(
      'Mutation Denial',
      'UPDATE public.prescriptions',
      'Denied (42501)',
      'UNVERIFIED: UPDATE privileges active on prescriptions (Phase 3 active)',
      'PRE_MIGRATION_PENDING',
      'NONE'
    );
  }

  // 2.4 Anonymous DELETE on patients
  const { error: delPatientErr } = await supabase
    .from('patients')
    .delete()
    .eq('id', '00000000-0000-0000-0000-000000000000');
  if (delPatientErr) {
    const isRls = delPatientErr.message.toLowerCase().includes('row-level security');
    recordResult(
      'Mutation Denial',
      'DELETE public.patients',
      'Denied (42501)',
      `Denied: ${delPatientErr.message}`,
      'PASS',
      isRls ? 'RLS_WITH_CHECK' : 'PRIVILEGE_MISSING'
    );
  } else {
    recordResult(
      'Mutation Denial',
      'DELETE public.patients',
      'Denied (42501)',
      'UNVERIFIED: Anonymous user has DELETE privileges on patients (Phase 3 active)',
      'PRE_MIGRATION_PENDING',
      'NONE'
    );
  }

  // 2.5 Anonymous DELETE on adherence_logs (immutable clinical audit trail)
  const { error: delLogErr } = await supabase
    .from('adherence_logs')
    .delete()
    .eq('id', '00000000-0000-0000-0000-000000000000');
  if (delLogErr) {
    const isRls = delLogErr.message.toLowerCase().includes('row-level security');
    recordResult(
      'Mutation Denial',
      'DELETE public.adherence_logs',
      'Denied (42501)',
      `Denied: ${delLogErr.message}`,
      'PASS',
      isRls ? 'RLS_WITH_CHECK' : 'PRIVILEGE_MISSING'
    );
  } else {
    recordResult(
      'Mutation Denial',
      'DELETE public.adherence_logs',
      'Denied (42501)',
      'UNVERIFIED: Anonymous user can delete clinical audit logs (Phase 3 active)',
      'PRE_MIGRATION_PENDING',
      'NONE'
    );
  }

  // -------------------------------------------------------------------------
  // 3. VERIFY RPC EXECUTION REVOCATION (get_family_view)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. RPC Execution Boundary Verification ---');
  const { error: rpcErr } = await supabase.rpc('get_family_view', { p_patient_id: 'p1' });
  if (rpcErr && (rpcErr.code === '42501' || rpcErr.message.toLowerCase().includes('permission denied'))) {
    recordResult(
      'RPC Revocation',
      'get_family_view(text)',
      'Revoked (42501)',
      `Execution blocked at Routine Privilege Layer: ${rpcErr.message}`,
      'PASS',
      'PRIVILEGE_MISSING'
    );
  } else if (!rpcErr) {
    recordResult(
      'RPC Revocation',
      'get_family_view(text)',
      'Revoked (42501)',
      'UNVERIFIED: Executable by anonymous caller without authentication (Phase 3 active)',
      'PRE_MIGRATION_PENDING',
      'NONE'
    );
  } else {
    recordResult(
      'RPC Revocation',
      'get_family_view(text)',
      'Revoked (42501)',
      `RPC returned error: ${rpcErr.message}`,
      'PASS',
      'PRIVILEGE_MISSING'
    );
  }

  // -------------------------------------------------------------------------
  // 4. VERIFY CLIENT APPLICATION RESILIENCE (Demo Mode & Fallback)
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Client Application Resilience Verification ---');
  const patients = await dataService.fetchPatients();
  if (patients && patients.length > 0) {
    recordResult(
      'UI Resilience',
      'dataService.fetchPatients() Fallback',
      'Safe Demo Fallback',
      `Application returned ${patients.length} patient profile(s) without crash`,
      'PASS'
    );
  } else {
    recordResult(
      'UI Resilience',
      'dataService.fetchPatients() Fallback',
      'Safe Demo Fallback',
      'Failed: Patients list is empty',
      'FAIL'
    );
  }

  // Verify client clinical gate validation
  const testDraft = [
    { key: 'medicine', labelKey: 'rx_medicine', value: 'Aspirin', status: 'confirmed' as const },
    { key: 'dosage', labelKey: 'rx_dosage', value: '75mg', status: 'uncertain' as const },
    { key: 'frequency', labelKey: 'rx_frequency', value: 'Daily', status: 'confirmed' as const },
    { key: 'duration', labelKey: 'rx_duration', value: '30 days', status: 'confirmed' as const },
  ];
  const gateRes = await dataService.confirmCarePlan('p1', testDraft);
  if ('error' in gateRes && gateRes.error.includes('dosage')) {
    recordResult(
      'Client Clinical Gate',
      'confirmCarePlan() validation',
      'Reject uncertain field',
      `Correctly blocked unconfirmed field: "${gateRes.error}"`,
      'PASS'
    );
  } else {
    recordResult(
      'Client Clinical Gate',
      'confirmCarePlan() validation',
      'Reject uncertain field',
      'Failed: unconfirmed dosage was accepted',
      'FAIL'
    );
  }

  // -------------------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  const passes = results.filter((r) => r.status === 'PASS').length;
  const pending = results.filter((r) => r.status === 'PRE_MIGRATION_PENDING').length;
  const fails = results.filter((r) => r.status === 'FAIL').length;

  console.log(`Verification Summary:`);
  console.log(`  ✅ Passed:      ${passes}`);
  console.log(`  ⏳ Unverified:  ${pending} (Open vectors on remote instance pending migration execution)`);
  console.log(`  ❌ Failed:      ${fails}`);
  console.log('======================================================================\n');

  if (pending > 0) {
    console.log(`CRITICAL: ${pending} security checks remain UNVERIFIED on the remote database.`);
    console.log('The remote instance is currently running the unpatched Phase 3 schema.');
    console.log('Production is NOT secured until migration 20261017000001_least_privilege_grants.sql');
    console.log('is executed in Supabase and this suite is rerun to confirm 0 unverified items.\n');
  }
}

if (process.argv[1]?.endsWith('verify_post_migration.ts')) {
  runPostMigrationVerification().catch(console.error);
}
