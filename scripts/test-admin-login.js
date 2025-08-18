const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env' });

const prisma = new PrismaClient();

async function testAdminLogin() {
  try {
    console.log('🔍 Testing admin login...');
    
    // First, let's check if the admin user exists and has the correct role
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@folio.com' }
    });
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }
    
    console.log('✅ Admin user found:', {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      name: adminUser.name
    });
    
    // Test password hashing (you'll need to set a proper password)
    const testPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    console.log('🔐 Password hash generated for testing');
    console.log('📝 To set this password, run:');
    console.log(`UPDATE "User" SET "passwordHash" = '${hashedPassword}' WHERE email = 'admin@folio.com';`);
    
    console.log('\n🎯 Next steps:');
    console.log('1. Go to http://localhost:3000/auth/signin');
    console.log('2. Sign in with: admin@folio.com / admin123');
    console.log('3. Check if you have admin privileges');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAdminLogin(); 