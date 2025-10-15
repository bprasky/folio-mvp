import fs from 'node:fs';
import { config } from 'dotenv';
const envPath = fs.existsSync('.env.local') ? '.env.local' : '.env';
config({ path: envPath });

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!url || !key) {
  console.error(`Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (loaded from ${envPath})`);
  process.exit(1);
}

console.log(`[bucket-create] using ${envPath} | url ok=`, url.includes('.supabase.co'), 'serviceKey length=', key.length);

const supa = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Get bucket name from args or use default
const bucketName = process.argv[2] || 'events';
const isPublic = process.argv[3] === 'public';

console.log(`🎯 Creating bucket: ${bucketName} (${isPublic ? 'public' : 'private'})`);

try {
  // Check if bucket already exists
  const { data: existingBuckets, error: listError } = await supa.storage.listBuckets();
  
  if (listError) {
    console.error('❌ Failed to check existing buckets:', listError.message);
    process.exit(1);
  }

  const bucketExists = existingBuckets?.some(bucket => bucket.name === bucketName);
  
  if (bucketExists) {
    console.log(`✅ Bucket '${bucketName}' already exists`);
    
    // Test upload to verify it works
    const testBytes = Buffer.from('test');
    const testPath = `test/${Date.now()}-test.txt`;
    
    const { error: uploadError } = await supa.storage
      .from(bucketName)
      .upload(testPath, testBytes, { contentType: 'text/plain', upsert: false });
    
    if (uploadError) {
      console.error(`❌ Bucket exists but upload failed: ${uploadError.message}`);
      process.exit(1);
    }
    
    console.log(`✅ Bucket '${bucketName}' is working correctly`);
    
    // Clean up test file
    await supa.storage.from(bucketName).remove([testPath]);
    console.log(`🧹 Cleaned up test file: ${testPath}`);
    
  } else {
    // Create new bucket
    const { data, error } = await supa.storage.createBucket(bucketName, {
      public: isPublic,
      allowedMimeTypes: ['image/*', 'video/*', 'application/pdf'],
      fileSizeLimit: 52428800 // 50MB
    });
    
    if (error) {
      console.error('❌ Failed to create bucket:', error.message);
      process.exit(1);
    }
    
    console.log(`✅ Bucket '${bucketName}' created successfully`);
    console.log(`📋 Bucket ID: ${data.id}`);
    console.log(`🌐 Public: ${isPublic}`);
    
    // Test upload
    const testBytes = Buffer.from('test');
    const testPath = `test/${Date.now()}-test.txt`;
    
    const { error: uploadError } = await supa.storage
      .from(bucketName)
      .upload(testPath, testBytes, { contentType: 'text/plain', upsert: false });
    
    if (uploadError) {
      console.error(`❌ Test upload failed: ${uploadError.message}`);
      process.exit(1);
    }
    
    console.log(`✅ Test upload successful: ${testPath}`);
    
    // Clean up test file
    await supa.storage.from(bucketName).remove([testPath]);
    console.log(`🧹 Cleaned up test file: ${testPath}`);
  }

  console.log(`\n🎉 Bucket '${bucketName}' is ready for use!`);
  console.log(`💡 Use with: $env:FOLIO_STORAGE_BUCKET='${bucketName}'; npm run dev`);

} catch (error) {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
}








