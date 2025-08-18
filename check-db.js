const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 DATABASE STATE AFTER MIGRATION RESET');
    console.log('========================================');
    
    const users = await prisma.user.count();
    const events = await prisma.event.count();
    const products = await prisma.product.count();
    const projects = await prisma.project.count();
    
    console.log(`📊 Users: ${users}`);
    console.log(`📊 Events: ${events}`);
    console.log(`📊 Products: ${products}`);
    console.log(`📊 Projects: ${projects}`);
    
    if (users > 0) {
      const userList = await prisma.user.findMany({
        select: { email: true, name: true, role: true }
      });
      console.log('\n👥 Users found:');
      userList.forEach(user => {
        console.log(`   - ${user.email} (${user.name}): ${user.role}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase(); 