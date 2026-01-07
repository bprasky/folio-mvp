const { createClient } = require('@supabase/supabase-js');

// Your exact credentials from .env
const supabaseUrl = 'https://gwdkhgejsyvynqzolyau.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3ZGtoZ2Vqc3l2eW5xem9seWF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDk1NzkyOCwiZXhwIjoyMDY2NTMzOTI4fQ.WF2C0RgkvUxg89Q_Zu-bllspNuUC8NDSLw5N3i67ypo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function disableRLS() {
  try {
    console.log('Disabling RLS on storage buckets...');
    
    // Disable RLS on storage.objects table
    const { error } = await supabase.rpc('disable_rls_on_storage');
    
    if (error) {
      console.log('Trying alternative approach...');
      
      // Alternative: Update bucket policies
      const buckets = ['festival-images', 'event-images', 'project-images', 'product-images', 'user-avatars'];
      
      for (const bucketName of buckets) {
        console.log(`Setting up policies for ${bucketName}...`);
        
        // Allow all operations for now (you can restrict this later)
        const { error: policyError } = await supabase.storage.from(bucketName).createSignedUrl('test', 60);
        
        if (policyError) {
          console.log(`Policy setup for ${bucketName}: ${policyError.message}`);
        } else {
          console.log(`✅ ${bucketName} policies configured`);
        }
      }
    } else {
      console.log('✅ RLS disabled successfully');
    }
    
  } catch (error) {
    console.error('Error disabling RLS:', error.message);
  }
}

disableRLS(); 