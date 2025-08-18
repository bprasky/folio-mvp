const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🔧 Setting up NextAuth environment variables...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '..', '.env');
const envExists = fs.existsSync(envPath);

console.log('1. Environment file check:');
console.log(`   .env file exists: ${envExists ? '✅' : '❌'}`);

if (!envExists) {
  console.log('\n2. Creating .env file...');
  
  // Generate a secure secret
  const secret = crypto.randomBytes(32).toString('hex');
  
  const envContent = `# NextAuth Configuration
NEXTAUTH_SECRET=${secret}
NEXTAUTH_URL=http://localhost:3000

# Supabase Configuration (update these with your actual values)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Database
DATABASE_URL=your_database_url_here
`;

  fs.writeFileSync(envPath, envContent);
  console.log('   ✅ Created .env file with NextAuth configuration');
  console.log(`   🔑 Generated secure NEXTAUTH_SECRET: ${secret.substring(0, 16)}...`);
} else {
  console.log('\n2. Checking existing .env file...');
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check for NEXTAUTH_SECRET
  const hasSecret = envContent.includes('NEXTAUTH_SECRET=');
  console.log(`   NEXTAUTH_SECRET configured: ${hasSecret ? '✅' : '❌'}`);
  
  // Check for NEXTAUTH_URL
  const hasUrl = envContent.includes('NEXTAUTH_URL=');
  console.log(`   NEXTAUTH_URL configured: ${hasUrl ? '✅' : '❌'}`);
  
  if (!hasSecret) {
    console.log('\n3. Adding missing NEXTAUTH_SECRET...');
    const secret = crypto.randomBytes(32).toString('hex');
    const newEnvContent = envContent + `\n# NextAuth Configuration\nNEXTAUTH_SECRET=${secret}\n`;
    fs.writeFileSync(envPath, newEnvContent);
    console.log('   ✅ Added NEXTAUTH_SECRET to .env file');
    console.log(`   🔑 Generated secure NEXTAUTH_SECRET: ${secret.substring(0, 16)}...`);
  }
  
  if (!hasUrl) {
    console.log('\n4. Adding missing NEXTAUTH_URL...');
    const newEnvContent = envContent + `\nNEXTAUTH_URL=http://localhost:3000\n`;
    fs.writeFileSync(envPath, newEnvContent);
    console.log('   ✅ Added NEXTAUTH_URL to .env file');
  }
}

console.log('\n5. Environment setup complete!');
console.log('   📝 Please restart your development server for changes to take effect.');
console.log('   🔄 Run: npm run dev'); 