const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testEventsDB() {
  try {
    console.log('Testing events database queries...');
    
    // Test 1: Check if we can connect to the database
    console.log('\n1. Testing database connection...');
    const userCount = await prisma.user.count();
    console.log(`✅ Database connected. User count: ${userCount}`);
    
    // Test 2: Check if events table exists and has data
    console.log('\n2. Testing events table...');
    const eventCount = await prisma.event.count();
    console.log(`✅ Events table accessible. Event count: ${eventCount}`);
    
    // Test 3: Try to fetch events with the same query as the page
    console.log('\n3. Testing events query...');
    const baseWhere = {
      NOT: {
        eventTypes: {
          has: 'FESTIVAL'
        }
      },
      startDate: {
        gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14), // 14 days ago
      },
      OR: [
        { isPublic: true },
      ],
    };

    const events = await prisma.event.findMany({
      where: baseWhere,
      orderBy: { startDate: 'asc' },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            companyName: true,
            role: true,
          },
        },
        parentFestival: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
          },
        },
        rsvps: true,
      },
    });
    
    console.log(`✅ Events query successful. Found ${events.length} events`);
    
    // Test 4: Check festivals query
    console.log('\n4. Testing festivals query...');
    const festivals = await prisma.event.findMany({
      where: {
        eventTypes: {
          has: 'FESTIVAL'
        },
        isApproved: true,
        endDate: { gte: new Date() }, // Only future or ongoing festivals
      },
      orderBy: {
        startDate: 'asc',
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
        subevents: {
          select: {
            id: true,
          },
        },
        rsvps: true,
      },
    });
    
    console.log(`✅ Festivals query successful. Found ${festivals.length} festivals`);
    
    // Test 5: Check if there are any events with issues
    console.log('\n5. Checking for potential data issues...');
    const allEvents = await prisma.event.findMany({
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        eventTypes: true,
        isPublic: true,
        isApproved: true,
      }
    });
    
    console.log('Sample events:');
    allEvents.slice(0, 3).forEach(event => {
      console.log(`  - ${event.title} (${event.eventTypes.join(', ')}) - Public: ${event.isPublic}, Approved: ${event.isApproved}`);
    });
    
    console.log('\n✅ All database tests passed!');
    
  } catch (error) {
    console.error('❌ Error testing events database:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
  } finally {
    await prisma.$disconnect();
  }
}

testEventsDB(); 