const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestVendors() {
  try {
    console.log('🔧 Creating test vendor profiles...');
    
    // Check if vendors already exist
    const existingVendors = await prisma.vendor.findMany();
    console.log(`Found ${existingVendors.length} existing vendors`);
    
    if (existingVendors.length >= 3) {
      console.log('✅ Sufficient vendors already exist');
      return;
    }
    
    // Create test vendor users and profiles
    const testVendors = [
      {
        user: {
          name: 'Benjamin Moore',
          email: 'contact@benjaminmoore.com',
          profileType: 'vendor',
          location: 'New York, NY'
        },
        vendor: {
          companyName: 'Benjamin Moore',
          description: 'Premium paint and coatings manufacturer',
          website: 'https://www.benjaminmoore.com',
          logo: 'https://via.placeholder.com/150x50/1e40af/ffffff?text=Benjamin+Moore'
        }
      },
      {
        user: {
          name: 'Caesarstone',
          email: 'info@caesarstone.com',
          profileType: 'vendor',
          location: 'Los Angeles, CA'
        },
        vendor: {
          companyName: 'Caesarstone',
          description: 'Premium quartz surfaces and countertops',
          website: 'https://www.caesarstone.com',
          logo: 'https://via.placeholder.com/150x50/374151/ffffff?text=Caesarstone'
        }
      },
      {
        user: {
          name: 'Flos Lighting',
          email: 'hello@flos.com',
          profileType: 'vendor',
          location: 'Milan, Italy'
        },
        vendor: {
          companyName: 'Flos',
          description: 'Design lighting and contemporary furniture',
          website: 'https://www.flos.com',
          logo: 'https://via.placeholder.com/150x50/059669/ffffff?text=Flos'
        }
      }
    ];
    
    for (const testVendor of testVendors) {
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: { email: testVendor.user.email }
      });
      
      if (existingUser) {
        console.log(`⚠️  User ${testVendor.user.email} already exists`);
        continue;
      }
      
      // Create user and vendor profile
      const user = await prisma.user.create({
        data: {
          ...testVendor.user,
          vendor: {
            create: testVendor.vendor
          }
        },
        include: {
          vendor: true
        }
      });
      
      console.log(`✅ Created vendor: ${user.vendor?.companyName} (${user.email})`);
    }
    
    // Verify all vendors
    const allVendors = await prisma.vendor.findMany({
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
    
    console.log(`\n📊 Total vendors in database: ${allVendors.length}`);
    allVendors.forEach((vendor, index) => {
      console.log(`${index + 1}. ${vendor.companyName} (${vendor.user?.email})`);
    });
    
  } catch (error) {
    console.error('❌ Error creating test vendors:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestVendors(); 