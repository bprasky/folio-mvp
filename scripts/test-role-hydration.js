const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testRoleHydration() {
  try {
    console.log('Testing role hydration...');
    
    // Find a user to test with
    const user = await prisma.user.findFirst({
      select: { id: true, email: true, role: true }
    });
    
    if (!user) {
      console.log('No users found in database');
      return;
    }
    
    console.log('Found user:', {
      id: user.id,
      email: user.email,
      role: user.role
    });
    
    // Test role update
    const newRole = user.role === 'ADMIN' ? 'DESIGNER' : 'ADMIN';
    console.log(`Updating role from ${user.role} to ${newRole}...`);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { role: newRole }
    });
    
    console.log('Role updated successfully!');
    console.log('Now try logging in again - your session should reflect the new role immediately.');
    
  } catch (error) {
    console.error('Error testing role hydration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRoleHydration(); 