// scripts/debug-designer-user.mjs
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from .env file
config({ path: '.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const email = 'designer.demo@folioad.com';

async function main() {
  console.log('🔍 Debugging designer user in Supabase...');
  console.log('Supabase URL:', SUPABASE_URL);
  console.log('Service Role Key exists:', !!SERVICE_ROLE);
  console.log('Email to check:', email);
  
  try {
    // List all users
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }
    
    console.log(`\n📊 Total users in Supabase: ${users.users.length}`);
    
    // Find our specific user
    const designerUser = users.users.find(user => user.email === email);
    
    if (designerUser) {
      console.log('\n✅ Found designer user:');
      console.log('  ID:', designerUser.id);
      console.log('  Email:', designerUser.email);
      console.log('  Email Confirmed:', designerUser.email_confirmed_at);
      console.log('  Created At:', designerUser.created_at);
      console.log('  Last Sign In:', designerUser.last_sign_in_at);
      console.log('  User Metadata:', designerUser.user_metadata);
      console.log('  App Metadata:', designerUser.app_metadata);
      
      // Try to test the password by attempting to sign in
      console.log('\n🔐 Testing password authentication...');
      
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: 'design123'
      });
      
      if (signInError) {
        console.log('❌ Password test failed:', signInError.message);
      } else {
        console.log('✅ Password test successful!');
        console.log('  User ID from sign in:', signInData.user.id);
      }
      
    } else {
      console.log('\n❌ Designer user not found in Supabase!');
      console.log('Available users:');
      users.users.forEach(user => {
        console.log(`  - ${user.email} (${user.id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

main()
  .catch(async (e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  }); 