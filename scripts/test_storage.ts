import { supabase } from '../src/lib/supabase';

async function testStorage() {
  if (!supabase) {
    console.error('No supabase client');
    return;
  }

  console.log('Testing storage upload to prescriptions bucket...');
  const testFile = new Blob(['fake image bytes for test'], { type: 'image/jpeg' });
  const fileName = `test/verify_${Date.now()}.jpg`;

  const { data: upData, error: upError } = await supabase.storage
    .from('prescriptions')
    .upload(fileName, testFile, { contentType: 'image/jpeg' });

  if (upError) {
    console.log('Upload Error:', upError.message);
  } else {
    console.log('Upload SUCCESS! Path:', upData?.path);

    // Test signed URL
    const { data: urlData, error: urlError } = await supabase.storage
      .from('prescriptions')
      .createSignedUrl(fileName, 60);

    if (urlError) {
      console.log('Signed URL Error:', urlError.message);
    } else {
      console.log('Signed URL SUCCESS:', urlData?.signedUrl ? 'Valid URL generated' : 'No URL');
    }

    // Cleanup
    await supabase.storage.from('prescriptions').remove([fileName]);
    console.log('Cleaned up test file.');
  }
}

testStorage().catch(console.error);
