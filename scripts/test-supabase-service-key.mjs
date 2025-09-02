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

console.log(`[smoke] using ${envPath} | url ok=`, url.includes('.supabase.co'), 'serviceKey length=', key.length);

const supa = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Create a minimal test image (1x1 pixel PNG)
const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const pngChunk = Buffer.from([0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE]);
const bytes = Buffer.concat([pngHeader, pngChunk]);
const name = `sanity/${Date.now()}-test.png`;

// Use bucket fallback logic like the upload helper
const PREFERRED = process.env.FOLIO_STORAGE_BUCKET;
const FALLBACKS = ['events', 'event-images', 'images', 'public'];
const candidates = Array.from(new Set([PREFERRED, ...FALLBACKS])).filter(Boolean);

console.log(`🔍 Testing buckets: ${candidates.join(', ')}`);

let uploadSuccess = false;
const errors = [];

for (const bucket of candidates) {
  try {
    const { error } = await supa.storage.from(bucket).upload(name, bytes, { contentType: 'image/png', upsert: false });
    if (error) {
      errors.push(`${bucket}: ${error.message}`);
      continue;
    }
    
    const { data: pub } = supa.storage.from(bucket).getPublicUrl(name);
    console.log(`✅ Service-role upload OK: ${bucket}/${name}`);
    console.log('Public URL:', pub?.publicUrl || '(bucket may be private)');
    
    // Clean up test file
    await supa.storage.from(bucket).remove([name]);
    console.log(`🧹 Cleaned up test file: ${bucket}/${name}`);
    
    uploadSuccess = true;
    break;
  } catch (e) {
    errors.push(`${bucket}: ${e.message}`);
  }
}

if (!uploadSuccess) {
  console.error('❌ Service-role upload FAILED for all buckets:');
  errors.forEach(error => console.error(`  ${error}`));
  process.exit(1);
}

process.exit(0);
