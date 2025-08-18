// scripts/reset-designer-password.mjs
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from .env file
config({ path: '.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY; // NEVER commit this

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const email = 'designer.demo@folioad.com';
const newPassword = 'design123';

async function main() {
  console.log('Resetting password for demo designer user...');
  
  // Find the user by email
  const { data: existingUser, error: getUserError } = await supabase.auth.admin.listUsers();
  if (getUserError) throw getUserError;
  
  const existingUserData = existingUser.users.find(user => user.email === email);
  
  if (!existingUserData) {
    console.error('❌ User not found:', email);
    process.exit(1);
  }
  
  console.log('Found user:', existingUserData.id);
  
  // Update the password
  const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
    existingUserData.id,
    { password: newPassword }
  );
  
  if (updateError) throw updateError;
  
  console.log('\n✅ Password reset successfully!');
  console.log('Email:', email);
  console.log('New Password:', newPassword);
  console.log('\nYou can now use these credentials to log in to the application.');
}

main()
  .catch(async (e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  }); 