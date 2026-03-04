const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

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