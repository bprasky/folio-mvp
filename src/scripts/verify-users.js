const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyUsers() {
  try {
    console.log('Verifying test users...\n');

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (users.length === 0) {
      console.log('No users found in the database.');
      return;
    }

    console.log(`Found ${users.length} users:\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Password: ${user.password ? 'Set' : 'Not set'}`);
      console.log(`   Created: ${user.createdAt.toLocaleDateString()}`);
      console.log('');
    });

    // Check for specific test users
    const testEmails = [
      'admin@folio.com',
      'designer@folio.com', 
      'vendor@folio.com',
      'homeowner@folio.com',
      'student@folio.com'
    ];

    console.log('Checking for required test users:');
    testEmails.forEach(email => {
      const user = users.find(u => u.email === email);
      if (user) {
        console.log(`✅ ${email} - ${user.role}`);
      } else {
        console.log(`❌ ${email} - Not found`);
      }
    });

  } catch (error) {
    console.error('Error verifying users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyUsers(); 