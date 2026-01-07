/* eslint-disable no-console */
import { PrismaClient, EventType, Role } from '@prisma/client';
import { config } from 'dotenv';

// Load environment variables - try root first, then src/.env
config({ path: '.env' });
config({ path: 'src/.env', override: false });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Miami local community events...');

  // Ensure we have an admin user to create events
  const admin = await prisma.user.upsert({
    where: { email: 'admin@folio.com' },
    update: {},
    create: {
      email: 'admin@folio.com',
      name: 'Admin User',
      role: Role.ADMIN,
      passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8j8qKqK', // placeholder hash
    },
  });

  const events = [
    {
      title: 'Ornare Lunch & Learn: Integrated Kitchens',
      description:
        'Join Ornare for an exclusive lunch and learn session featuring their latest integrated kitchen solutions. Learn about innovative storage systems, premium finishes, and design-forward cabinetry. CEU credits available.',
      type: 'community' as const,
      host: 'Ornare',
      venueName: 'Ornare Miami Showroom',
      address: '4040 NE 2nd Ave, Miami, FL 33137',
      startDate: new Date('2025-11-06T12:00:00-05:00'),
      endDate: new Date('2025-11-06T13:30:00-05:00'),
      imageUrl: 'https://images.unsplash.com/photo-1600585154340-1a8b5acae9a1?w=1200&h=630&fit=crop',
      rsvpUrl: 'https://ornare.example/rsvp',
      eventTypes: [EventType.LUNCH_AND_LEARN],
      eventTags: ['Community', 'Trade', 'Miami'],
      city: 'Miami',
      state: 'FL',
      country: 'USA',
      includesFood: true,
    },
    {
      title: 'Artefacto Designer Happy Hour',
      description:
        'Network with fellow designers and explore Artefacto\'s curated collection of luxury furniture and home accessories. Enjoy cocktails and light bites while discovering the latest trends in contemporary design.',
      type: 'community' as const,
      host: 'Artefacto',
      venueName: 'Artefacto Coral Gables',
      address: '101 S Dixie Hwy, Coral Gables, FL 33133',
      startDate: new Date('2025-11-08T17:30:00-05:00'),
      endDate: new Date('2025-11-08T19:30:00-05:00'),
      imageUrl: 'https://images.unsplash.com/photo-1600607687920-4e1d8e95b4a2?w=1200&h=630&fit=crop',
      rsvpUrl: 'https://artefacto.example/rsvp',
      eventTypes: [EventType.HAPPY_HOUR],
      eventTags: ['Community', 'Networking', 'Miami'],
      city: 'Miami',
      state: 'FL',
      country: 'USA',
      includesFood: true,
    },
    {
      title: 'ARCA Padel Tournament',
      description:
        'Get active with ARCA at our annual padel tournament for the design community. Open to all skill levels. Come compete, network, and enjoy refreshments after the matches. Paddles provided.',
      type: 'community' as const,
      host: 'ARCA',
      venueName: 'Reserve Padel Doral',
      address: '5775 NW 84th Ave, Doral, FL 33166',
      startDate: new Date('2025-11-10T09:00:00-05:00'),
      endDate: new Date('2025-11-10T12:00:00-05:00'),
      imageUrl: 'https://images.unsplash.com/photo-1600185365681-954d5b7fdc4d?w=1200&h=630&fit=crop',
      rsvpUrl: 'https://arca.example/padel',
      eventTypes: [EventType.OTHER],
      eventTags: ['Sports', 'Community', 'Miami'],
      city: 'Miami',
      state: 'FL',
      country: 'USA',
    },
    {
      title: 'Cosentino Pasta-Making Class',
      description:
        'Join Cosentino for a hands-on pasta-making workshop using their Dekton surfaces as your workspace. Learn traditional techniques while exploring the durability and beauty of Dekton in culinary applications.',
      type: 'community' as const,
      host: 'Cosentino',
      venueName: 'Cosentino City Miami',
      address: '3898 Biscayne Blvd, Miami, FL 33137',
      startDate: new Date('2025-11-13T18:00:00-05:00'),
      endDate: new Date('2025-11-13T20:00:00-05:00'),
      imageUrl: 'https://images.unsplash.com/photo-1528715471579-d1bcf0b80d3d?w=1200&h=630&fit=crop',
      rsvpUrl: 'https://cosentino.example/rsvp',
      eventTypes: [EventType.WORKSHOP],
      eventTags: ['Hands-on', 'Community', 'Miami'],
      city: 'Miami',
      state: 'FL',
      country: 'USA',
      includesFood: true,
    },
    {
      title: 'Poliform Brunch & Learn: Wardrobe Systems',
      description:
        'Discover Poliform\'s innovative wardrobe systems over a relaxed brunch. Explore customizable storage solutions, premium finishes, and smart design features that maximize space and style.',
      type: 'community' as const,
      host: 'Poliform',
      venueName: 'Poliform Miami',
      address: '4100 NE 2nd Ave, Miami, FL 33137',
      startDate: new Date('2025-11-15T11:00:00-05:00'),
      endDate: new Date('2025-11-15T12:30:00-05:00'),
      imageUrl: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&h=630&fit=crop',
      rsvpUrl: 'https://poliform.example/rsvp',
      eventTypes: [EventType.LUNCH_AND_LEARN],
      eventTags: ['Brunch', 'Community', 'Miami'],
      city: 'Miami',
      state: 'FL',
      country: 'USA',
      includesFood: true,
    },
    {
      title: 'Porcelanosa CEU: Large-Format Installation',
      description:
        'Earn CEU credits while learning about large-format tile installation best practices from Porcelanosa\'s technical experts. Covers substrate preparation, adhesive selection, and finishing techniques.',
      type: 'community' as const,
      host: 'Porcelanosa',
      venueName: 'Porcelanosa Miami',
      address: '3700 Biscayne Blvd, Miami, FL 33137',
      startDate: new Date('2025-12-04T09:00:00-05:00'),
      endDate: new Date('2025-12-04T10:30:00-05:00'),
      imageUrl: 'https://images.unsplash.com/photo-1623079741451-03d12e3b6f4c?w=1200&h=630&fit=crop',
      rsvpUrl: 'https://porcelanosa.example/rsvp',
      eventTypes: [EventType.CEU],
      eventTags: ['CEU', 'Technical', 'Community'],
      city: 'Miami',
      state: 'FL',
      country: 'USA',
    },
    {
      title: 'Cambria Coffee & New Quartz Launch',
      description:
        'Be among the first to see Cambria\'s newest quartz collection while enjoying artisanal coffee. Learn about the latest colorways, patterns, and technical innovations in premium quartz surfaces.',
      type: 'community' as const,
      host: 'Cambria',
      venueName: 'Cambria Gallery Miami',
      address: 'Design District, Miami, FL',
      startDate: new Date('2025-12-05T08:30:00-05:00'),
      endDate: new Date('2025-12-05T10:00:00-05:00'),
      imageUrl: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=1200&h=630&fit=crop',
      rsvpUrl: 'https://cambria.example/rsvp',
      eventTypes: [EventType.LAUNCH],
      eventTags: ['Launch', 'Community', 'Miami'],
      city: 'Miami',
      state: 'FL',
      country: 'USA',
    },
    {
      title: 'Design District Showroom Crawl (Holiday Edition)',
      description:
        'Join the Folio community for a festive holiday crawl through Miami Design District showrooms. Discover new collections, meet fellow designers, and celebrate the season with drinks and light bites at multiple stops.',
      type: 'community' as const,
      host: 'Folio Community',
      venueName: 'Miami Design District',
      address: '3841 NE 2nd Ave, Miami, FL 33137',
      startDate: new Date('2025-12-12T16:30:00-05:00'),
      endDate: new Date('2025-12-12T20:30:00-05:00'),
      imageUrl: 'https://images.unsplash.com/photo-1601047028155-761cbd7e7be2?w=1200&h=630&fit=crop',
      rsvpUrl: 'https://folio.example/rsvp',
      eventTypes: [EventType.TOUR],
      eventTags: ['Networking', 'Community', 'Miami'],
      city: 'Miami',
      state: 'FL',
      country: 'USA',
      includesFood: true,
    },
    {
      title: 'Farrow & Ball Color Talk: Holiday Palette',
      description:
        'Explore Farrow & Ball\'s curated holiday color palette with expert color consultants. Learn how to create sophisticated seasonal schemes and discover the stories behind their iconic paint colors.',
      type: 'community' as const,
      host: 'Farrow & Ball',
      venueName: 'Farrow & Ball Miami',
      address: 'Miami Design District, Miami, FL',
      startDate: new Date('2025-11-20T14:00:00-05:00'),
      endDate: new Date('2025-11-20T15:30:00-05:00'),
      imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&h=630&fit=crop',
      rsvpUrl: 'https://farrow-ball.example/rsvp',
      eventTypes: [EventType.PRODUCT_KNOWLEDGE],
      eventTags: ['Color', 'Community', 'Miami'],
      city: 'Miami',
      state: 'FL',
      country: 'USA',
    },
    {
      title: 'B&B Italia Open House: New Collections',
      description:
        'Experience B&B Italia\'s latest furniture collections in an open house setting. Meet the design team, learn about the craftsmanship and materials, and see pieces in curated room settings.',
      type: 'community' as const,
      host: 'B&B Italia',
      venueName: 'B&B Italia Miami',
      address: 'Miami Design District, Miami, FL',
      startDate: new Date('2025-11-18T16:00:00-05:00'),
      endDate: new Date('2025-11-18T18:00:00-05:00'),
      imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&h=630&fit=crop',
      rsvpUrl: 'https://bbitalia.example/rsvp',
      eventTypes: [EventType.EXHIBITION],
      eventTags: ['Showroom', 'Community', 'Miami'],
      city: 'Miami',
      state: 'FL',
      country: 'USA',
    },
  ];

  const createdEvents: string[] = [];

  for (const eventData of events) {
    // Check if event already exists by title and parentFestivalId null
    const existing = await prisma.event.findFirst({
      where: {
        title: eventData.title,
        parentFestivalId: null,
      },
      select: {
        id: true,
        title: true,
      },
    });

    // Combine venue name and address into location field
    const locationText = eventData.venueName
      ? `${eventData.venueName}, ${eventData.address}`
      : eventData.address;

    // Use fields that exist in the database
    const eventDataToSave: any = {
      description: eventData.description,
      location: locationText, // Includes venue and address info
      startDate: eventData.startDate,
      endDate: eventData.endDate,
      imageUrl: eventData.imageUrl,
      isPublic: true,
      isApproved: true,
      parentFestivalId: null,
      city: eventData.city,
      state: eventData.state,
      country: eventData.country,
    };

    // Add optional fields if they exist
    if (eventData.rsvpUrl) {
      eventDataToSave.mapLink = eventData.rsvpUrl;
    }
    if (eventData.eventTypes && eventData.eventTypes.length > 0) {
      eventDataToSave.eventTypes = eventData.eventTypes;
    }
    if (eventData.eventTags && eventData.eventTags.length > 0) {
      eventDataToSave.eventTags = eventData.eventTags;
    }
    if (eventData.includesFood !== undefined) {
      eventDataToSave.includesFood = eventData.includesFood;
    }

    if (existing) {
      // Update existing event
      await prisma.event.update({
        where: { id: existing.id },
        data: eventDataToSave,
      });
      createdEvents.push(eventData.title);
      console.log(`  ✓ Updated: ${eventData.title}`);
    } else {
      // Create new event
      const event = await prisma.event.create({
        data: {
          title: eventData.title,
          ...eventDataToSave,
          createdById: admin.id,
        },
      });
      createdEvents.push(eventData.title);
      console.log(`  ✓ Created: ${eventData.title}`);
    }
  }

  console.log(`\n✅ Seeded ${createdEvents.length} Miami community events`);
  console.log('\n📋 Created events:');
  createdEvents.forEach((title) => console.log(`   • ${title}`));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

