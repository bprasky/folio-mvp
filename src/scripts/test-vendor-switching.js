const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testVendorSwitching() {
  try {
    console.log('🔍 Testing vendor profile switching...');
    
    // Get all vendor profiles
    const vendorProfiles = await prisma.user.findMany({
      where: { profileType: 'vendor' },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        bio: true,
        profileImage: true
      }
    });
    
    console.log(`\n📊 Found ${vendorProfiles.length} vendor profiles:`);
    vendorProfiles.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.companyName || profile.name} (${profile.email})`);
      console.log(`   - ID: ${profile.id}`);
      console.log(`   - Description: ${profile.bio || 'N/A'}`);
    });
    
    // Test the profiles API
    console.log('\n🌐 Testing profiles API...');
    const response = await fetch('http://localhost:3002/api/profiles?role=vendor');
    const apiProfiles = await response.json();
    
    console.log(`API returned ${apiProfiles.length} vendor profiles:`);
    apiProfiles.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.brandName || profile.name} (ID: ${profile.id})`);
      console.log(`   - Description: ${profile.description || profile.bio || 'N/A'}`);
    });
    
    console.log('\n✅ Vendor switching test completed!');
    console.log('\n📋 How to test vendor switching:');
    console.log('1. Go to http://localhost:3002');
    console.log('2. Click the profile switcher in the top navigation');
    console.log('3. Select "Vendor" role');
    console.log('4. You should see "Select Vendor Account" with 3 available vendors');
    console.log('5. Click on different vendors to switch between them');
    console.log('6. Each vendor can create subevents for the festival');
    
  } catch (error) {
    console.error('❌ Error testing vendor switching:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testVendorSwitching(); 