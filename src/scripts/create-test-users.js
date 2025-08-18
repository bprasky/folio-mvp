const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    console.log('Creating test users...');

    const users = [
      {
        email: 'admin@folio.com',
        name: 'Admin User',
        password: 'admin123',
        role: 'ADMIN'
      },
      {
        email: 'newadmin@folio.com',
        name: 'New Admin User',
        password: 'admin123',
        role: 'ADMIN'
      },
      {
        email: 'designer@folio.com',
        name: 'Designer User',
        password: 'password123',
        role: 'DESIGNER'
      },
      {
        email: 'vendor@folio.com',
        name: 'Vendor User',
        password: 'password123',
        role: 'VENDOR'
      },
      {
        email: 'homeowner@folio.com',
        name: 'Homeowner User',
        password: 'password123',
        role: 'HOMEOWNER'
      },
      {
        email: 'student@folio.com',
        name: 'Student User',
        password: 'password123',
        role: 'DESIGNER' // Students are designers
      }
    ];

    for (const userData of users) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existingUser) {
        console.log(`User ${userData.email} already exists, updating password...`);
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        await prisma.user.update({
          where: { email: userData.email },
          data: { password: hashedPassword }
        });
      } else {
        console.log(`Creating user ${userData.email}...`);
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        await prisma.user.create({
          data: {
            email: userData.email,
            name: userData.name,
            password: hashedPassword,
            role: userData.role
          }
        });
      }
    }

    console.log('Test users created successfully!');
    console.log('\nLogin credentials:');
    console.log('Admin: admin@folio.com / admin123');
    console.log('New Admin: newadmin@folio.com / admin123');
    console.log('Designer: designer@folio.com / password123');
    console.log('Vendor: vendor@folio.com / password123');
    console.log('Homeowner: homeowner@folio.com / password123');
    console.log('Student: student@folio.com / password123');

  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers(); 