// scripts/check-prisma-user.mjs
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

// Load environment variables from .env file
config({ path: '.env' });

const prisma = new PrismaClient();

const email = 'designer.demo@folioad.com';
const userId = '83b37665-c92c-4a50-a693-c6278a0e6af4'; // From Supabase

async function main() {
  console.log('🔍 Checking designer user in Prisma database...');
  console.log('Email to check:', email);
  console.log('User ID to check:', userId);
  
  try {
    // Check by email
    const userByEmail = await prisma.user.findUnique({
      where: { email: email }
    });
    
    console.log('\n📧 User found by email:', !!userByEmail);
    if (userByEmail) {
      console.log('  ID:', userByEmail.id);
      console.log('  Name:', userByEmail.name);
      console.log('  Role:', userByEmail.role);
      console.log('  Created At:', userByEmail.createdAt);
    }
    
    // Check by ID
    const userById = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    console.log('\n🆔 User found by ID:', !!userById);
    if (userById) {
      console.log('  ID:', userById.id);
      console.log('  Email:', userById.email);
      console.log('  Name:', userById.name);
      console.log('  Role:', userById.role);
      console.log('  Created At:', userById.createdAt);
    }
    
    // List all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\n📊 Total users in Prisma database: ${allUsers.length}`);
    console.log('All users:');
    allUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.name}) - ${user.role} - ${user.id}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch(async (e) => {
    console.error('❌ Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  }); 