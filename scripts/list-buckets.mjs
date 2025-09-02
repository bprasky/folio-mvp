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

console.log(`[bucket-list] using ${envPath} | url ok=`, url.includes('.supabase.co'), 'serviceKey length=', key.length);

const supa = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

try {
  const { data: buckets, error } = await supa.storage.listBuckets();
  
  if (error) {
    console.error('❌ Failed to list buckets:', error.message);
    process.exit(1);
  }

  if (!buckets || buckets.length === 0) {
    console.log('📦 No storage buckets found');
    console.log('💡 Create a bucket with: npm run bucket:create');
  } else {
    console.log('📦 Available buckets:');
    buckets.forEach(bucket => {
      console.log(`  - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });
  }

  // Test fallback buckets from upload helper
  const fallbacks = ['events', 'event-images', 'images', 'public'];
  console.log('\n🔍 Testing fallback buckets:');
  
  for (const bucketName of fallbacks) {
    try {
      const { data, error } = await supa.storage.from(bucketName).list('', { limit: 1 });
      if (error) {
        console.log(`  ❌ ${bucketName}: ${error.message}`);
      } else {
        console.log(`  ✅ ${bucketName}: accessible`);
      }
    } catch (e) {
      console.log(`  ❌ ${bucketName}: ${e.message}`);
    }
  }

} catch (error) {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
}


