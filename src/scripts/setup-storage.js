const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

console.log('DEBUG: NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('DEBUG: SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupStorage() {
  console.log('🚀 Setting up Supabase storage buckets...');

  const buckets = [
    {
      name: 'festival-images',
      public: true,
      description: 'Storage for festival images'
    },
    {
      name: 'event-images', 
      public: true,
      description: 'Storage for event images'
    },
    {
      name: 'project-images',
      public: true,
      description: 'Storage for project images'
    },
    {
      name: 'product-images',
      public: true,
      description: 'Storage for product images'
    },
    {
      name: 'user-avatars',
      public: true,
      description: 'Storage for user profile images'
    }
  ];

  for (const bucket of buckets) {
    try {
      console.log(`📦 Creating bucket: ${bucket.name}`);
      
      // Check if bucket already exists
      const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
      if (listError) {
        console.error(`❌ Error listing buckets:`, listError);
        continue;
      }

      const bucketExists = existingBuckets.some(b => b.name === bucket.name);
      
      if (bucketExists) {
        console.log(`✅ Bucket ${bucket.name} already exists`);
        continue;
      }

      // Create the bucket
      const { data, error } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public,
        allowedMimeTypes: ['image/*'],
        fileSizeLimit: 5242880 // 5MB limit
      });

      if (error) {
        console.error(`❌ Error creating bucket ${bucket.name}:`, error);
      } else {
        console.log(`✅ Successfully created bucket: ${bucket.name}`);
      }
    } catch (error) {
      console.error(`❌ Unexpected error creating bucket ${bucket.name}:`, error);
    }
  }

  console.log('🎉 Storage setup complete!');
}

setupStorage().catch(console.error); 