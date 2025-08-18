const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env' });

const prisma = new PrismaClient();

async function setAdminPassword() {
  try {
    console.log('🔐 Setting admin password...');
    
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const updatedUser = await prisma.user.update({
      where: { email: 'admin@folio.com' },
      data: { password: hashedPassword }
    });
    
    console.log('✅ Admin password set successfully!');
    console.log('📧 Email:', updatedUser.email);
    console.log('🔑 Password: admin123');
    console.log('👤 Role:', updatedUser.role);
    
    console.log('\n🎯 You can now sign in at: http://localhost:3000/auth/signin');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

setAdminPassword(); 