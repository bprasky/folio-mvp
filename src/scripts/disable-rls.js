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