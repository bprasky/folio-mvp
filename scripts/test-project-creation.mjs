// scripts/test-project-creation.mjs
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from .env file
config({ path: '.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const email = 'designer.demo@folioad.com';
const password = 'design123';

async function main() {
  console.log('🧪 Testing project creation flow...');
  
  try {
    // 1. Sign in as designer
    console.log('1. Signing in as designer...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      return;
    }
    
    console.log('✅ Signed in successfully');
    console.log('  User ID:', signInData.user.id);
    console.log('  Session:', !!signInData.session);
    
    // 2. Test project creation API
    console.log('\n2. Testing project creation API...');
    
    const projectData = {
      name: 'Test Project from Script',
      description: 'This is a test project created by the verification script'
    };
    
    const response = await fetch('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token=${signInData.session.access_token}`
      },
      body: JSON.stringify(projectData)
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Project created successfully!');
      console.log('  Project ID:', result.id);
      console.log('  Redirect URL: /projects/' + result.id);
    } else {
      const error = await response.json().catch(() => ({}));
      console.error('❌ Project creation failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

main()
  .catch(async (e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  }); 