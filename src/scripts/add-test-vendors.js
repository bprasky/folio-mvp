const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addTestVendors() {
  try {
    console.log('🔧 Adding test vendor profiles...');
    
    const testVendors = [
      {
        name: 'Benjamin Moore',
        email: 'contact@benjaminmoore.com',
        profileType: 'vendor',
        companyName: 'Benjamin Moore',
        bio: 'Premium paint and coatings manufacturer',
        location: 'New York, NY',
        profileImage: 'https://via.placeholder.com/150x50/1e40af/ffffff?text=Benjamin+Moore'
      },
      {
        name: 'Caesarstone',
        email: 'info@caesarstone.com',
        profileType: 'vendor',
        companyName: 'Caesarstone',
        bio: 'Premium quartz surfaces and countertops',
        location: 'Los Angeles, CA',
        profileImage: 'https://via.placeholder.com/150x50/374151/ffffff?text=Caesarstone'
      },
      {
        name: 'Flos Lighting',
        email: 'hello@flos.com',
        profileType: 'vendor',
        companyName: 'Flos',
        bio: 'Design lighting and contemporary furniture',
        location: 'Milan, Italy',
        profileImage: 'https://via.placeholder.com/150x50/059669/ffffff?text=Flos'
      }
    ];
    
    for (const vendor of testVendors) {
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: { email: vendor.email }
      });
      
      if (existingUser) {
        console.log(`⚠️  Vendor ${vendor.email} already exists`);
        continue;
      }
      
      // Create vendor user
      const newVendor = await prisma.user.create({
        data: vendor
      });
      
      console.log(`✅ Created vendor: ${newVendor.companyName} (${newVendor.email})`);
    }
    
    // Check all vendor profiles
    const allVendors = await prisma.user.findMany({
      where: { profileType: 'vendor' },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        bio: true
      }
    });
    
    console.log(`\n📊 Total vendor profiles: ${allVendors.length}`);
    allVendors.forEach((vendor, index) => {
      console.log(`${index + 1}. ${vendor.companyName || vendor.name} (${vendor.email})`);
    });
    
  } catch (error) {
    console.error('❌ Error adding test vendors:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestVendors(); 