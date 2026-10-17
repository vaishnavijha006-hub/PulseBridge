import { supabase, isSupabaseConfigured, supabaseConfigError } from '../src/lib/supabase';

async function main() {
  console.log('=== PulseBridge Supabase Remote Probe ===');
  console.log('isSupabaseConfigured:', isSupabaseConfigured);
  if (supabaseConfigError) {
    console.log('Config error:', supabaseConfigError);
  }

  if (!supabase) {
    console.error('Supabase client is null!');
    process.exit(1);
  }

  const tables = [
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

  console.log('\n--- Checking Remote Tables & Seed Data ---');
  for (const table of tables) {
    const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' });
    if (error) {
      console.log(`Table [${table}]: ERROR - ${error.code}: ${error.message}`);
    } else {
      console.log(`Table [${table}]: EXISTS (${count ?? data?.length} rows)`);
      if (table === 'patients' && data && data.length > 0) {
        console.log(`  Sample Patient: ${data[0].name} (ID: ${data[0].id})`);
      }
    }
  }

  console.log('\n--- Checking Storage Buckets ---');
  let { data: bData, error: bGetError } = await supabase.storage.getBucket('prescriptions');
  if (bGetError) {
    console.log("Bucket 'prescriptions': not found, attempting to create...");
    const { data: createData, error: createError } = await supabase.storage.createBucket('prescriptions', { public: false });
    if (createError) {
      console.log('Create Bucket Error:', createError.message);
    } else {
      console.log('Create Bucket SUCCESS:', createData);
    }
  } else {
    console.log("Bucket 'prescriptions': EXISTS! (public:", bData?.public, ")");
  }

  const { data: buckets, error: bError } = await supabase.storage.listBuckets();
  if (bError) {
    console.log('List Buckets: ERROR -', bError.message);
  } else {
    console.log('Storage Buckets:', buckets?.map((b) => b.name) ?? 'None found');
  }
}

main().catch(console.error);
