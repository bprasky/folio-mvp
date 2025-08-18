const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRoleAssignment() {
  console.log('🔍 Testing Role Assignment...\n');

  try {
    // Test 1: Check Prisma users
    console.log('1. Checking Prisma users:');
    const prismaUsers = await prisma.user.findMany({
      select: { id: true, email: true, role: true, name: true }
    });
    
    console.log(`Found ${prismaUsers.length} users in Prisma:`);
    prismaUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.name}): ${user.role}`);
    });

    // Test 2: Check Supabase users
    console.log('\n2. Checking Supabase users:');
    const { data: supabaseUsers, error } = await supabase
      .from('users')
      .select('id, email, role, name');

    if (error) {
      console.error('Error fetching from Supabase:', error);
    } else {
      console.log(`Found ${supabaseUsers.length} users in Supabase:`);
      supabaseUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.name}): ${user.role}`);
      });
    }

    // Test 3: Compare roles between Prisma and Supabase
    console.log('\n3. Comparing roles between Prisma and Supabase:');
    const roleMismatches = [];
    
    for (const prismaUser of prismaUsers) {
      const supabaseUser = supabaseUsers?.find(su => su.email === prismaUser.email);
      
      if (supabaseUser) {
        if (prismaUser.role !== supabaseUser.role) {
          roleMismatches.push({
            email: prismaUser.email,
            prismaRole: prismaUser.role,
            supabaseRole: supabaseUser.role
          });
        }
      } else {
        console.log(`  ⚠️  User ${prismaUser.email} exists in Prisma but not in Supabase`);
      }
    }

    if (roleMismatches.length > 0) {
      console.log('  ❌ Role mismatches found:');
      roleMismatches.forEach(mismatch => {
        console.log(`    - ${mismatch.email}: Prisma=${mismatch.prismaRole}, Supabase=${mismatch.supabaseRole}`);
      });
    } else {
      console.log('  ✅ All roles match between Prisma and Supabase');
    }

    // Test 4: Check for users without roles
    console.log('\n4. Checking for users without roles:');
    const usersWithoutRoles = prismaUsers.filter(user => !user.role);
    
    if (usersWithoutRoles.length > 0) {
      console.log('  ⚠️  Users without roles:');
      usersWithoutRoles.forEach(user => {
        console.log(`    - ${user.email} (${user.name})`);
      });
    } else {
      console.log('  ✅ All users have roles assigned');
    }

    // Test 5: Check for ADMIN role fallback issues
    console.log('\n5. Checking for ADMIN role fallback issues:');
    const adminUsers = prismaUsers.filter(user => user.role === 'ADMIN');
    
    if (adminUsers.length > 0) {
      console.log('  ⚠️  Users with ADMIN role (potential fallback issue):');
      adminUsers.forEach(user => {
        console.log(`    - ${user.email} (${user.name})`);
      });
    } else {
      console.log('  ✅ No users with ADMIN role (good!)');
    }

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testRoleAssignment(); 