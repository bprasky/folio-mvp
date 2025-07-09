const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createSampleEvents() {
  try {
    console.log('🎉 Creating sample events data...');

    // Create NYCxDesign 2025 Signature Event
    const nycxDesign = await prisma.event.create({
      data: {
        id: 'nycx-design-2025',
        title: 'NYCxDesign 2025',
        description: 'The premier design event in New York City, showcasing the latest in furniture, lighting, and interior design from leading brands and emerging designers.',
        startDate: new Date('2025-05-15T09:00:00Z'),
        endDate: new Date('2025-05-21T18:00:00Z'),
        location: 'Various locations across NYC',
        address: 'Multiple venues',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        thumbnail: '/images/events/nycx-design-thumbnail.jpg',
        banner: '/images/events/nycx-design-banner.jpg',
        website: 'https://nycxdesign.com',
        type: 'signature',
        status: 'upcoming',
        isSignature: true,
        isPinned: true,
        capacity: 5000,
        isPublic: true,
        views: 1250,
        rsvps: 342,
      },
    });

    console.log('✅ Created NYCxDesign 2025 event');

    // Create Sub-Events for NYCxDesign
    const subEvents = [
      {
        id: 'nycx-javits-showcase',
        title: 'Javits Center Showcase',
        description: 'The main exhibition hall featuring over 200 leading furniture and lighting brands from around the world.',
        startTime: new Date('2025-05-16T10:00:00Z'),
        endTime: new Date('2025-05-18T18:00:00Z'),
        location: 'Javits Center, Hall 1A',
        type: 'booth',
        capacity: 2000,
      },
      {
        id: 'nycx-material-bank',
        title: 'Material Bank Innovation Hub',
        description: 'Explore cutting-edge materials and finishes with live demonstrations and expert consultations.',
        startTime: new Date('2025-05-17T11:00:00Z'),
        endTime: new Date('2025-05-17T17:00:00Z'),
        location: 'Material Bank Showroom',
        type: 'workshop',
        speakerName: 'Sarah Chen',
        speakerBio: 'Senior Material Specialist at Material Bank',
        speakerImage: '/images/speakers/sarah-chen.jpg',
        companyName: 'Material Bank',
        companyLogo: '/images/companies/material-bank-logo.png',
        capacity: 150,
      },
      {
        id: 'nycx-design-talks',
        title: 'Design Leadership Summit',
        description: 'Keynote presentations from industry leaders on the future of design and sustainability.',
        startTime: new Date('2025-05-18T14:00:00Z'),
        endTime: new Date('2025-05-18T16:00:00Z'),
        location: 'Cooper Hewitt Museum',
        type: 'talk',
        speakerName: 'Marcus Johnson',
        speakerBio: 'Award-winning interior designer and sustainability advocate',
        speakerImage: '/images/speakers/marcus-johnson.jpg',
        companyName: 'Johnson Design Studio',
        companyLogo: '/images/companies/johnson-design-logo.png',
        capacity: 300,
      },
      {
        id: 'nycx-brooklyn-makers',
        title: 'Brooklyn Makers Market',
        description: 'Discover unique pieces from independent designers and artisans in Brooklyn.',
        startTime: new Date('2025-05-19T12:00:00Z'),
        endTime: new Date('2025-05-19T18:00:00Z'),
        location: 'Brooklyn Navy Yard',
        type: 'booth',
        capacity: 500,
      },
      {
        id: 'nycx-networking-reception',
        title: 'Designer Networking Reception',
        description: 'An evening of networking with fellow designers, vendors, and industry professionals.',
        startTime: new Date('2025-05-20T18:00:00Z'),
        endTime: new Date('2025-05-20T21:00:00Z'),
        location: 'The Standard High Line',
        type: 'networking',
        capacity: 200,
      },
    ];

    for (const subEvent of subEvents) {
      await prisma.subEvent.create({
        data: {
          ...subEvent,
          eventId: nycxDesign.id,
        },
      });
    }

    console.log(`✅ Created ${subEvents.length} sub-events for NYCxDesign`);

    // Create additional events
    const additionalEvents = [
      {
        id: 'milan-design-week-2025',
        title: 'Milan Design Week 2025',
        description: 'The world\'s largest design fair, featuring the latest innovations in furniture and lighting design.',
        startDate: new Date('2025-04-15T09:00:00Z'),
        endDate: new Date('2025-04-21T18:00:00Z'),
        location: 'Fiera Milano, Milan, Italy',
        city: 'Milan',
        state: 'Lombardy',
        country: 'Italy',
        thumbnail: '/images/events/milan-design-thumbnail.jpg',
        type: 'signature',
        status: 'upcoming',
        isSignature: true,
        isPinned: true,
        capacity: 8000,
        views: 2100,
        rsvps: 567,
      },
      {
        id: 'high-point-market-spring-2025',
        title: 'High Point Market Spring 2025',
        description: 'The largest furnishings industry trade show in the world, featuring thousands of exhibitors.',
        startDate: new Date('2025-04-26T09:00:00Z'),
        endDate: new Date('2025-04-30T18:00:00Z'),
        location: 'High Point, North Carolina',
        city: 'High Point',
        state: 'NC',
        country: 'USA',
        thumbnail: '/images/events/high-point-thumbnail.jpg',
        type: 'trade-show',
        status: 'upcoming',
        capacity: 3000,
        views: 890,
        rsvps: 234,
      },
      {
        id: 'icff-2025',
        title: 'ICFF 2025',
        description: 'International Contemporary Furniture Fair showcasing contemporary design from around the world.',
        startDate: new Date('2025-05-18T09:00:00Z'),
        endDate: new Date('2025-05-21T18:00:00Z'),
        location: 'Javits Center, New York',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        thumbnail: '/images/events/icff-thumbnail.jpg',
        type: 'trade-show',
        status: 'upcoming',
        capacity: 2500,
        views: 756,
        rsvps: 189,
      },
    ];

    for (const event of additionalEvents) {
      await prisma.event.create({
        data: event,
      });
    }

    console.log(`✅ Created ${additionalEvents.length} additional events`);

    // Create some sample RSVPs
    const users = await prisma.user.findMany({ take: 5 });
    const events = await prisma.event.findMany();

    for (const user of users) {
      for (const event of events.slice(0, 2)) { // RSVP to first 2 events
        await prisma.eventRSVP.upsert({
          where: {
            eventId_userId: {
              eventId: event.id,
              userId: user.id,
            },
          },
          update: {},
          create: {
            eventId: event.id,
            userId: user.id,
            status: Math.random() > 0.5 ? 'going' : 'maybe',
          },
        });
      }
    }

    console.log('✅ Created sample RSVPs');

    console.log('🎉 Sample events data created successfully!');
    console.log('📊 Events created:');
    console.log(`   - NYCxDesign 2025 (Signature Event)`);
    console.log(`   - Milan Design Week 2025 (Signature Event)`);
    console.log(`   - High Point Market Spring 2025`);
    console.log(`   - ICFF 2025`);
    console.log(`   - 5 Sub-events for NYCxDesign`);

  } catch (error) {
    console.error('❌ Error creating sample events:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  createSampleEvents()
    .then(() => {
      console.log('Sample events creation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Sample events creation failed:', error);
      process.exit(1);
    });
}

module.exports = { createSampleEvents }; 