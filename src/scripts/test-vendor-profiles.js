const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testVendorProfiles() {
  try {
    console.log('🔍 Testing vendor profiles...');
    
    // Check all users with vendor profile type
    const vendorUsers = await prisma.user.findMany({
      where: { profileType: 'vendor' },
      include: {
        vendor: true
      }
    });
    
    console.log(`\n📊 Found ${vendorUsers.length} vendor users:`);
    vendorUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || user.email} (ID: ${user.id})`);
      if (user.vendor) {
        console.log(`   - Company: ${user.vendor.companyName || 'N/A'}`);
        console.log(`   - Description: ${user.vendor.description || 'N/A'}`);
      }
    });
    
    // Check vendor profiles specifically
    const vendorProfiles = await prisma.vendor.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    console.log(`\n🏢 Found ${vendorProfiles.length} vendor profiles:`);
    vendorProfiles.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.companyName || profile.user?.name || 'Unknown'} (ID: ${profile.id})`);
      console.log(`   - User: ${profile.user?.name || profile.user?.email || 'N/A'}`);
      console.log(`   - Description: ${profile.description || 'N/A'}`);
    });
    
    // Test the profiles API endpoint
    console.log('\n🌐 Testing /api/profiles?role=vendor endpoint...');
    const response = await fetch('http://localhost:3002/api/profiles?role=vendor');
    const data = await response.json();
    console.log(`API returned ${data.length} vendor profiles:`);
    data.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.name || profile.brandName || 'Unknown'} (ID: ${profile.id})`);
    });
    
  } catch (error) {
    console.error('❌ Error testing vendor profiles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testVendorProfiles(); 