const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testEventsPage() {
  try {
    console.log('Testing events page data flow...');
    
    // Simulate the events page data fetching
    const userRole = 'ADMIN'; // Test with admin role
    const userId = null; // No specific user for this test
    
    // 1. Test fetchEvents
    console.log('\n1. Testing fetchEvents...');
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
        ...(userId ? [{ createdById: userId }] : []),
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
    
    console.log(`✅ Found ${events.length} events`);
    
    // 2. Test fetchFestivals
    console.log('\n2. Testing fetchFestivals...');
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
    
    console.log(`✅ Found ${festivals.length} festivals`);
    
    // 3. Test data mapping
    console.log('\n3. Testing data mapping...');
    
    // Simulate the mapEventsToFeedItems function
    function mapEventToFeedItem(event) {
      return {
        id: event.id,
        slug: event.slug || event.id,
        title: event.title || 'Untitled Event',
        city: event.city || event.location || 'TBD',
        venue: event.venue || event.location || 'TBD',
        eventTypes: event.eventTypes || ['OTHER'],
        heroImage: event.heroImage || event.imageUrl || event.coverImage,
        coverImage: event.coverImage || event.imageUrl || event.heroImage,
        startsAt: event.startDate || event.startsAt || new Date().toISOString(),
        endsAt: event.endDate || event.endsAt
      };
    }
    
    function mapEventsToFeedItems(events) {
      return events.map(mapEventToFeedItem);
    }
    
    const feedItems = mapEventsToFeedItems(events);
    console.log(`✅ Mapped ${feedItems.length} events to feed items`);
    
    // 4. Check for any data issues
    console.log('\n4. Checking for data issues...');
    
    if (events.length > 0) {
      const sampleEvent = events[0];
      console.log('Sample event data:');
      console.log('  - ID:', sampleEvent.id);
      console.log('  - Title:', sampleEvent.title);
      console.log('  - Event Types:', sampleEvent.eventTypes);
      console.log('  - Is Public:', sampleEvent.isPublic);
      console.log('  - Is Approved:', sampleEvent.isApproved);
      console.log('  - Start Date:', sampleEvent.startDate);
      console.log('  - Created By:', sampleEvent.createdBy?.name);
    }
    
    if (festivals.length > 0) {
      const sampleFestival = festivals[0];
      console.log('\nSample festival data:');
      console.log('  - ID:', sampleFestival.id);
      console.log('  - Title:', sampleFestival.title);
      console.log('  - Event Types:', sampleFestival.eventTypes);
      console.log('  - Is Public:', sampleFestival.isPublic);
      console.log('  - Is Approved:', sampleFestival.isApproved);
      console.log('  - Subevents count:', sampleFestival.subevents.length);
    }
    
    console.log('\n✅ Events page data flow test completed successfully!');
    console.log('The page should be working correctly now.');
    
  } catch (error) {
    console.error('❌ Error testing events page:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
  } finally {
    await prisma.$disconnect();
  }
}

testEventsPage(); 