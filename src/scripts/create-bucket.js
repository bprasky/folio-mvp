const { createClient } = require('@supabase/supabase-js');

// Your exact credentials from .env
const supabaseUrl = 'https://gwdkhgejsyvynqzolyau.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3ZGtoZ2Vqc3l2eW5xem9seWF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDk1NzkyOCwiZXhwIjoyMDY2NTMzOTI4fQ.WF2C0RgkvUxg89Q_Zu-bllspNuUC8NDSLw5N3i67ypo';

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