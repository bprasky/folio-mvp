const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testEventCreation() {
  try {
    console.log('🔍 Testing event creation...');
    
    // Check if admin user exists
    const adminUser = await prisma.user.findFirst({
      where: { profileType: 'admin' }
    });
    
    if (!adminUser) {
      console.log('❌ No admin user found, creating one...');
      const newAdmin = await prisma.user.create({
        data: {
          name: 'Admin User',
          email: 'admin@folioad.com',
          profileType: 'admin',
          location: 'New York, NY'
        }
      });
      console.log('✅ Created admin user:', newAdmin.id);
    } else {
      console.log('✅ Found admin user:', adminUser.id);
    }
    
    // Test event data
    const eventData = {
      title: 'Test Event 2025',
      description: 'A test event for debugging',
      startDate: new Date('2025-06-01T10:00:00Z'),
      endDate: new Date('2025-06-03T18:00:00Z'),
      location: 'Test Location',
      capacity: 100,
      isPublic: true,
      eventType: 'festival'
    };
    
    console.log('📝 Event data:', eventData);
    
    // Try to create event
    const event = await prisma.event.create({
      data: {
        ...eventData,
        createdById: adminUser?.id || 'admin-user-id',
        organizerId: adminUser?.id || 'admin-user-id',
        type: eventData.eventType,
        status: 'upcoming'
      }
    });
    
    console.log('✅ Event created successfully:', event.id);
    
    // Check if event appears in main events API
    const events = await prisma.event.findMany({
      include: {
        organizer: true,
        createdBy: true
      }
    });
    
    console.log('📊 Total events in database:', events.length);
    events.forEach(e => {
      console.log(`- ${e.title} (ID: ${e.id})`);
      console.log(`  Organizer: ${e.organizer?.name || 'None'}`);
      console.log(`  Created by: ${e.createdBy?.name || 'None'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEventCreation(); 