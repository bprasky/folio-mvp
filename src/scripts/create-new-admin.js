const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });

const prisma = new PrismaClient();

async function createNewAdmin() {
  try {
    console.log('Creating new admin user...');

    const adminData = {
      email: 'newadmin@folio.com',
      name: 'New Admin User',
      password: 'admin123',
      role: 'ADMIN'
    };

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminData.email }
    });

    if (existingUser) {
      console.log(`User ${adminData.email} already exists, updating password...`);
      const hashedPassword = await bcrypt.hash(adminData.password, 10);
      await prisma.user.update({
        where: { email: adminData.email },
        data: { 
          password: hashedPassword,
          role: 'ADMIN'
        }
      });
    } else {
      console.log(`Creating new admin user ${adminData.email}...`);
      const hashedPassword = await bcrypt.hash(adminData.password, 10);
      await prisma.user.create({
        data: {
          email: adminData.email,
          name: adminData.name,
          password: hashedPassword,
          role: adminData.role
        }
      });
    }

    console.log('✅ New admin user created successfully!');
    console.log('\n📋 Login credentials:');
    console.log(`Email: ${adminData.email}`);
    console.log(`Password: ${adminData.password}`);
    console.log(`Role: ${adminData.role}`);
    console.log('\n🔗 Login at: http://localhost:3000/auth/signin');

  } catch (error) {
    console.error('❌ Error creating new admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createNewAdmin(); 