import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 Checking database connection...');
    
    const result = await prisma.$queryRaw`select now() as now`;
    console.log('✅ Database connection successful!');
    console.log('📅 Current database time:', result);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase(); 