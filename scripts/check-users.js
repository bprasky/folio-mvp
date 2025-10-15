const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('Checking for test users...');
    
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: ['admin@folio.com', 'vendor@folio.com', 'designer@folio.com', 'homeowner@folio.com', 'student@folio.com']
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true
      }
    });

    console.log(`Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`- ${user.email} (${user.role}): ${user.passwordHash ? 'Has passwordHash' : 'No passwordHash'}`);
    });

  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();








