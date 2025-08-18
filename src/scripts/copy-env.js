const fs = require('fs');
const path = require('path');

console.log('📋 Copying environment variables from project root...\n');

// Paths
const rootEnvPath = path.join(__dirname, '..', '..', '.env');
const srcEnvPath = path.join(__dirname, '..', '.env');

console.log('1. Checking root .env file:');
console.log(`   Root .env path: ${rootEnvPath}`);
console.log(`   Root .env exists: ${fs.existsSync(rootEnvPath) ? '✅' : '❌'}`);

if (!fs.existsSync(rootEnvPath)) {
  console.log('\n❌ Root .env file not found!');
  console.log('   Please ensure you have a .env file in the project root directory.');
  process.exit(1);
}

console.log('\n2. Reading root .env file...');
const rootEnvContent = fs.readFileSync(rootEnvPath, 'utf8');

console.log('\n3. Checking for required variables:');
const requiredVars = ['NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
const missingVars = [];

requiredVars.forEach(varName => {
  const hasVar = rootEnvContent.includes(`${varName}=`);
  console.log(`   ${varName}: ${hasVar ? '✅' : '❌'}`);
  if (!hasVar) {
    missingVars.push(varName);
  }
});

if (missingVars.length > 0) {
  console.log(`\n⚠️  Missing required variables: ${missingVars.join(', ')}`);
  console.log('   Please add these to your root .env file.');
}

console.log('\n4. Environment setup complete!');
console.log('   📝 NextAuth should now be able to read the environment variables from root .env file.');
console.log('   🔄 Restart your development server if needed.'); 