import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting minimal seed...');

  // 1) Ensure one ADMIN user exists (NextAuth-compatible)
  const adminEmail = 'admin@folio.com';
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN' },
    create: { 
      email: adminEmail, 
      name: 'Admin User', 
      role: 'ADMIN',
      passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8j8qKqK' // 'admin123'
    }
  });
  console.log('✅ Admin user ensured:', admin.email);

  // 2) Ensure one VENDOR user exists
  const vendorEmail = 'vendor@folio.com';
  const vendor = await prisma.user.upsert({
    where: { email: vendorEmail },
    update: { role: 'VENDOR' },
    create: { 
      email: vendorEmail, 
      name: 'Vendor User', 
      role: 'VENDOR',
      passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8j8qKqK' // 'password123'
    }
  });
  console.log('✅ Vendor user ensured:', vendor.email);

  // 3) Ensure one DESIGNER user exists
  const designerEmail = 'designer@folio.com';
  const designer = await prisma.user.upsert({
    where: { email: designerEmail },
    update: { role: 'DESIGNER' },
    create: { 
      email: designerEmail, 
      name: 'Designer User', 
      role: 'DESIGNER',
      passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8j8qKqK' // 'password123'
    }
  });
  console.log('✅ Designer user ensured:', designer.email);

  // 4) Ensure one festival exists
  const festival = await prisma.event.upsert({
    where: { id: 'default-festival-2025' },
          update: { 
        title: 'Default Festival 2025'
      },
          create: {
        id: 'default-festival-2025',
        title: 'Default Festival 2025',
        description: 'A default festival for testing',
        location: 'Default Location',
        startDate: new Date('2025-12-01T09:00:00Z'),
        endDate: new Date('2025-12-07T18:00:00Z'),
        eventTypes: ['FESTIVAL'],
        isPublic: true,
        isApproved: true,
        requiresApproval: false,
        createdById: admin.id,
        imageUrl: null
      }
  });
  console.log('✅ Default festival ensured:', festival.title);

  // 5) Two child events under the festival
  await prisma.event.upsert({
    where: { id: 'design-panel-2025' },
    update: { 
      parentFestivalId: festival.id
    },
          create: {
        id: 'design-panel-2025',
        title: 'Design Leadership Panel',
        description: 'A panel discussion on design leadership',
        location: 'Panel Room A',
        startDate: new Date('2025-12-02T14:00:00Z'),
        endDate: new Date('2025-12-02T16:00:00Z'),
        eventTypes: ['PANEL'],
        isPublic: true,
        isApproved: true,
        requiresApproval: false,
        createdById: admin.id,
        parentFestivalId: festival.id,
        imageUrl: null,
      }
  });

  await prisma.event.upsert({
    where: { id: 'product-launch-2025' },
    update: { 
      parentFestivalId: festival.id
    },
          create: {
        id: 'product-launch-2025',
        title: 'Product Launch Party',
        description: 'Celebrating new product releases',
        location: 'Main Hall',
        startDate: new Date('2025-12-03T18:00:00Z'),
        endDate: new Date('2025-12-03T22:00:00Z'),
        eventTypes: ['PRODUCT_REVEAL'],
        isPublic: true,
        isApproved: true,
        requiresApproval: false,
        createdById: admin.id,
        parentFestivalId: festival.id,
        imageUrl: null,
      }
  });

  console.log('✅ Child events ensured');

  console.log('✅ Minimal seed complete.');
  console.log('\n📋 Available users:');
  console.log(`   Admin: ${admin.email} / admin123`);
  console.log(`   Vendor: ${vendor.email} / password123`);
  console.log(`   Designer: ${designer.email} / password123`);
}

main().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
