const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '../.env' });

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    console.log('Creating default admin user...');
    
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@folio.com',
        name: 'Admin User',
        role: 'ADMIN',
        password: null // No password for now
      }
    });
    
    console.log('✅ Admin user created successfully!');
    console.log('User ID:', adminUser.id);
    console.log('Email:', adminUser.email);
    console.log('Role:', adminUser.role);
    
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('✅ Admin user already exists');
    } else {
      console.error('❌ Error creating admin user:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser(); 