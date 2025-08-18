const { createClient } = require('@supabase/supabase-js');

// Your exact credentials from .env
const supabaseUrl = 'https://gwdkhgejsyvynqzolyau.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3ZGtoZ2Vqc3l2eW5xem9seWF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDk1NzkyOCwiZXhwIjoyMDY2NTMzOTI4fQ.WF2C0RgkvUxg89Q_Zu-bllspNuUC8NDSLw5N3i67ypo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupStoragePolicies() {
  try {
    console.log('Setting up storage policies...');
    
    // For now, let's try to upload a test file to see if the bucket is accessible
    const testBucket = 'festival-images';
    console.log(`Testing upload to ${testBucket}...`);
    
    // Create a simple test file
    const testContent = 'test';
    const testFile = new Blob([testContent], { type: 'text/plain' });
    
    const { data, error } = await supabase.storage
      .from(testBucket)
      .upload('test.txt', testFile);
    
    if (error) {
      console.error('Upload test failed:', error.message);
      
      // Try to get bucket info
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      if (listError) {
        console.error('Error listing buckets:', listError.message);
      } else {
        console.log('Available buckets:', buckets.map(b => b.name));
      }
    } else {
      console.log('✅ Test upload successful!');
      
      // Clean up test file
      await supabase.storage.from(testBucket).remove(['test.txt']);
      console.log('✅ Test file cleaned up');
    }
    
  } catch (error) {
    console.error('Error setting up storage policies:', error.message);
  }
}

setupStoragePolicies(); 