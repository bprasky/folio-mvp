const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env' });

const prisma = new PrismaClient();

async function updateUserRole() {
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    
    console.log('Updating user role to ADMIN...');
    const updatedUser = await prisma.user.update({
      where: {
        email: 'admin@folio.com'
      },
      data: {
        role: 'ADMIN'
      }
    });
    
    console.log('✅ User updated successfully:', {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role
    });
    
  } catch (error) {
    if (error.code === 'P2025') {
      console.log('❌ User not found. Creating new admin user...');
      
      const newUser = await prisma.user.create({
        data: {
          email: 'admin@folio.com',
          name: 'Admin User',
          role: 'ADMIN',
          passwordHash: '$2a$10$dummy.hash.for.admin.user'
        }
      });
      
      console.log('✅ Admin user created:', {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role
      });
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

updateUserRole(); 