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

const buckets = [
  'festival-images',
  'event-images', 
  'project-images',
  'product-images',
  'user-avatars'
];

async function createBuckets() {
  for (const bucketName of buckets) {
    try {
      console.log(`Creating ${bucketName} bucket...`);
      
      const { data, error } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/*'],
        fileSizeLimit: 5242880 // 5MB
      });

      if (error) {
        if (error.message.includes('already exists')) {
          console.log(`✅ ${bucketName} bucket already exists`);
        } else {
          console.error(`❌ Error creating ${bucketName} bucket:`, error.message);
        }
      } else {
        console.log(`✅ ${bucketName} bucket created successfully!`);
      }
    } catch (error) {
      console.error(`❌ Unexpected error creating ${bucketName}:`, error.message);
    }
  }
  
  console.log('🎉 All buckets setup complete!');
}

createBuckets(); 