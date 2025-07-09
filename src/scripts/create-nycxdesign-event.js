const { PrismaClient } = require('@prisma/client');
const QRCode = require('qrcode');

const prisma = new PrismaClient();

async function createNYCxDesignEvent() {
  try {
    console.log('🎉 Creating NYCxDesign 2025 Signature Event...');

    // Create Material Bank-style vendors
    const vendors = [
      {
        id: 'caesarstone',
        name: 'Caesarstone',
        bio: 'Premium quartz surfaces for kitchen and bathroom design',
        profileImage: '/images/vendors/caesarstone-logo.png',
        website: 'https://caesarstone.com',
        profileType: 'vendor',
        companyName: 'Caesarstone',
      },
      {
        id: 'flos',
        name: 'Flos',
        bio: 'Italian lighting design company known for innovative fixtures',
        profileImage: '/images/vendors/flos-logo.png',
        website: 'https://flos.com',
        profileType: 'vendor',
        companyName: 'Flos',
      },
      {
        id: 'muuto',
        name: 'Muuto',
        bio: 'Contemporary Scandinavian furniture and lighting',
        profileImage: '/images/vendors/muuto-logo.png',
        website: 'https://muuto.com',
        profileType: 'vendor',
        companyName: 'Muuto',
      },
      {
        id: 'benjamin-moore',
        name: 'Benjamin Moore',
        bio: 'Premium paint and color solutions for every space',
        profileImage: '/images/vendors/benjamin-moore-logo.png',
        website: 'https://benjaminmoore.com',
        profileType: 'vendor',
        companyName: 'Benjamin Moore',
      },
      {
        id: 'gantri',
        name: 'Gantri',
        bio: '3D printed lighting and home accessories',
        profileImage: '/images/vendors/gantri-logo.png',
        website: 'https://gantri.com',
        profileType: 'vendor',
        companyName: 'Gantri',
      },
    ];

    // Create vendors
    for (const vendor of vendors) {
      await prisma.user.upsert({
        where: { id: vendor.id },
        update: vendor,
        create: vendor,
      });
    }

    console.log('✅ Created Material Bank vendors');

    // Create products for each vendor
    const products = [
      // Caesarstone products
      {
        id: 'caesarstone-1',
        name: 'Aria 2.0 Quartz Countertop',
        description: 'Premium quartz surface with subtle veining',
        price: 85.00,
        imageUrl: '/images/products/caesarstone-aria.jpg',
        category: 'Countertops',
        brand: 'Caesarstone',
        url: 'https://caesarstone.com/aria-2-0',
        vendorId: 'caesarstone',
      },
      {
        id: 'caesarstone-2',
        name: 'Cloudburst Concrete Countertop',
        description: 'Industrial concrete look with modern appeal',
        price: 95.00,
        imageUrl: '/images/products/caesarstone-cloudburst.jpg',
        category: 'Countertops',
        brand: 'Caesarstone',
        url: 'https://caesarstone.com/cloudburst',
        vendorId: 'caesarstone',
      },
      // Flos products
      {
        id: 'flos-1',
        name: 'IC Light Pendant',
        description: 'Minimalist pendant light with adjustable height',
        price: 450.00,
        imageUrl: '/images/products/flos-ic-light.jpg',
        category: 'Lighting',
        brand: 'Flos',
        url: 'https://flos.com/ic-light',
        vendorId: 'flos',
      },
      {
        id: 'flos-2',
        name: 'Gatto Table Lamp',
        description: 'Iconic table lamp with soft, diffused light',
        price: 380.00,
        imageUrl: '/images/products/flos-gatto.jpg',
        category: 'Lighting',
        brand: 'Flos',
        url: 'https://flos.com/gatto',
        vendorId: 'flos',
      },
      // Muuto products
      {
        id: 'muuto-1',
        name: 'E27 Pendant Light',
        description: 'Scandinavian design pendant with warm glow',
        price: 220.00,
        imageUrl: '/images/products/muuto-e27.jpg',
        category: 'Lighting',
        brand: 'Muuto',
        url: 'https://muuto.com/e27-pendant',
        vendorId: 'muuto',
      },
      {
        id: 'muuto-2',
        name: 'Unfold Side Table',
        description: 'Modular side table with storage',
        price: 180.00,
        imageUrl: '/images/products/muuto-unfold.jpg',
        category: 'Furniture',
        brand: 'Muuto',
        url: 'https://muuto.com/unfold-side-table',
        vendorId: 'muuto',
      },
      // Benjamin Moore products
      {
        id: 'benjamin-moore-1',
        name: 'Simply White Paint',
        description: 'Pure white paint for clean, modern spaces',
        price: 45.00,
        imageUrl: '/images/products/benjamin-moore-simply-white.jpg',
        category: 'Paint',
        brand: 'Benjamin Moore',
        url: 'https://benjaminmoore.com/simply-white',
        vendorId: 'benjamin-moore',
      },
      {
        id: 'benjamin-moore-2',
        name: 'Hale Navy Paint',
        description: 'Deep navy blue for dramatic accents',
        price: 48.00,
        imageUrl: '/images/products/benjamin-moore-hale-navy.jpg',
        category: 'Paint',
        brand: 'Benjamin Moore',
        url: 'https://benjaminmoore.com/hale-navy',
        vendorId: 'benjamin-moore',
      },
      // Gantri products
      {
        id: 'gantri-1',
        name: 'Digital Light 1',
        description: '3D printed LED table lamp',
        price: 120.00,
        imageUrl: '/images/products/gantri-digital-light.jpg',
        category: 'Lighting',
        brand: 'Gantri',
        url: 'https://gantri.com/digital-light-1',
        vendorId: 'gantri',
      },
      {
        id: 'gantri-2',
        name: 'Planter Vase',
        description: '3D printed ceramic planter with geometric design',
        price: 85.00,
        imageUrl: '/images/products/gantri-planter.jpg',
        category: 'Accessories',
        brand: 'Gantri',
        url: 'https://gantri.com/planter-vase',
        vendorId: 'gantri',
      },
    ];

    // Create products
    for (const product of products) {
      await prisma.product.upsert({
        where: { id: product.id },
        update: product,
        create: product,
      });
    }

    console.log('✅ Created vendor products');

    // Create NYCxDesign 2025 main event
    const nycxDesign = await prisma.event.upsert({
      where: { id: 'nycxdesign-2025' },
      update: {
        title: 'NYCxDesign 2025',
        description: 'Citywide celebration of design across all five boroughs. Experience the latest in furniture, lighting, materials, and innovative design solutions from leading brands and emerging designers.',
        startDate: new Date('2025-05-10T09:00:00Z'),
        endDate: new Date('2025-05-17T18:00:00Z'),
        location: 'New York City',
        address: 'Various locations across NYC',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        thumbnail: 'https://source.unsplash.com/random/800x600?design,festival',
        banner: 'https://source.unsplash.com/random/1200x400?design,festival',
        website: 'https://nycxdesign.com',
        type: 'signature',
        status: 'upcoming',
        isSignature: true,
        isPinned: true,
        capacity: 10000,
        isPublic: true,
        views: 2500,
        rsvps: 1200,
      },
      create: {
        id: 'nycxdesign-2025',
        title: 'NYCxDesign 2025',
        description: 'Citywide celebration of design across all five boroughs. Experience the latest in furniture, lighting, materials, and innovative design solutions from leading brands and emerging designers.',
        startDate: new Date('2025-05-10T09:00:00Z'),
        endDate: new Date('2025-05-17T18:00:00Z'),
        location: 'New York City',
        address: 'Various locations across NYC',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        thumbnail: 'https://source.unsplash.com/random/800x600?design,festival',
        banner: 'https://source.unsplash.com/random/1200x400?design,festival',
        website: 'https://nycxdesign.com',
        type: 'signature',
        status: 'upcoming',
        isSignature: true,
        isPinned: true,
        capacity: 10000,
        isPublic: true,
        views: 2500,
        rsvps: 1200,
      },
    });

    console.log('✅ Created NYCxDesign 2025 main event');

    // Create sub-events
    const subEvents = [
      {
        id: 'soho-kickoff-dinner',
        title: 'SoHo Kickoff Dinner',
        description: 'An intimate dinner with design legend Kelly Wearstler, featuring exclusive previews of new collections and networking with industry leaders.',
        startTime: new Date('2025-05-10T19:00:00Z'),
        endTime: new Date('2025-05-10T22:00:00Z'),
        location: 'Balthazar Restaurant, SoHo',
        type: 'dinner',
        speakerName: 'Kelly Wearstler',
        speakerBio: 'Award-winning interior designer and founder of Kelly Wearstler Studio',
        speakerImage: '/images/speakers/kelly-wearstler.jpg',
        companyName: 'Kelly Wearstler Studio',
        companyLogo: '/images/companies/kelly-wearstler-logo.png',
        capacity: 80,
        qrCode: await QRCode.toDataURL('nycxdesign-2025:soho-kickoff-dinner'),
      },
      {
        id: 'future-material-design',
        title: 'Future of Material Design Panel',
        description: 'Join David Rockwell and industry experts for a deep dive into sustainable materials, innovative manufacturing, and the future of design.',
        startTime: new Date('2025-05-11T14:00:00Z'),
        endTime: new Date('2025-05-11T16:00:00Z'),
        location: 'Cooper Hewitt Museum, Upper East Side',
        type: 'talk',
        speakerName: 'David Rockwell',
        speakerBio: 'Founder of Rockwell Group and Tony Award-winning set designer',
        speakerImage: '/images/speakers/david-rockwell.jpg',
        companyName: 'Rockwell Group',
        companyLogo: '/images/companies/rockwell-group-logo.png',
        capacity: 200,
        qrCode: await QRCode.toDataURL('nycxdesign-2025:future-material-design'),
      },
      {
        id: 'tribeca-gallery-walk',
        title: 'Tribeca Gallery Walk',
        description: 'Self-guided tour of Tribeca\'s finest design galleries, featuring contemporary furniture, lighting, and art installations.',
        startTime: new Date('2025-05-12T10:00:00Z'),
        endTime: new Date('2025-05-12T18:00:00Z'),
        location: 'Various galleries in Tribeca',
        type: 'walkthrough',
        capacity: 500,
        qrCode: await QRCode.toDataURL('nycxdesign-2025:tribeca-gallery-walk'),
      },
      {
        id: 'harlem-makers-brunch',
        title: 'Harlem Makers Brunch',
        description: 'Brunch with Aurora James and local Harlem artisans, celebrating community-driven design and sustainable practices.',
        startTime: new Date('2025-05-13T11:00:00Z'),
        endTime: new Date('2025-05-13T14:00:00Z'),
        location: 'Red Rooster Harlem',
        type: 'brunch',
        speakerName: 'Aurora James',
        speakerBio: 'Founder of Brother Vellies and sustainable fashion advocate',
        speakerImage: '/images/speakers/aurora-james.jpg',
        companyName: 'Brother Vellies',
        companyLogo: '/images/companies/brother-vellies-logo.png',
        capacity: 120,
        qrCode: await QRCode.toDataURL('nycxdesign-2025:harlem-makers-brunch'),
      },
      {
        id: 'williamsburg-rooftop-showcase',
        title: 'Williamsburg Rooftop Showcase',
        description: 'Exclusive product showcase featuring the latest innovations in lighting, furniture, and smart home technology.',
        startTime: new Date('2025-05-14T17:00:00Z'),
        endTime: new Date('2025-05-14T21:00:00Z'),
        location: 'Wythe Hotel Rooftop, Williamsburg',
        type: 'product showcase',
        capacity: 150,
        qrCode: await QRCode.toDataURL('nycxdesign-2025:williamsburg-rooftop-showcase'),
      },
    ];

    // Create sub-events and link products
    for (const subEvent of subEvents) {
      const createdSubEvent = await prisma.subEvent.upsert({
        where: { id: subEvent.id },
        update: subEvent,
        create: {
          ...subEvent,
          eventId: nycxDesign.id,
        },
      });

      // Link products to sub-events based on type
      let productsToLink = [];
      switch (subEvent.type) {
        case 'dinner':
          productsToLink = ['caesarstone-1', 'flos-1', 'benjamin-moore-1'];
          break;
        case 'talk':
          productsToLink = ['muuto-1', 'gantri-1', 'benjamin-moore-2'];
          break;
        case 'walkthrough':
          productsToLink = ['flos-2', 'muuto-2', 'gantri-2'];
          break;
        case 'brunch':
          productsToLink = ['caesarstone-2', 'flos-1', 'muuto-1'];
          break;
        case 'product showcase':
          productsToLink = ['gantri-1', 'gantri-2', 'flos-1', 'muuto-1'];
          break;
      }

      // Link products to sub-event
      for (const productId of productsToLink) {
        await prisma.subEventProduct.upsert({
          where: {
            subEventId_productId: {
              subEventId: createdSubEvent.id,
              productId: productId,
            },
          },
          update: {},
          create: {
            subEventId: createdSubEvent.id,
            productId: productId,
          },
        });
      }
    }

    console.log('✅ Created sub-events with product links');

    // Create sample RSVPs for the main event
    const users = await prisma.user.findMany({ 
      where: { profileType: { in: ['designer', 'homeowner'] } },
      take: 10 
    });

    for (const user of users) {
      await prisma.eventRSVP.upsert({
        where: {
          eventId_userId: {
            eventId: nycxDesign.id,
            userId: user.id,
          },
        },
        update: {},
        create: {
          eventId: nycxDesign.id,
          userId: user.id,
          status: Math.random() > 0.3 ? 'going' : 'maybe',
        },
      });
    }

    // Create sample sub-event RSVPs
    const subEventIds = subEvents.map(se => se.id);
    for (const user of users.slice(0, 6)) {
      const randomSubEvent = subEventIds[Math.floor(Math.random() * subEventIds.length)];
      await prisma.subEventRSVP.upsert({
        where: {
          subEventId_userId: {
            subEventId: randomSubEvent,
            userId: user.id,
          },
        },
        update: {},
        create: {
          subEventId: randomSubEvent,
          userId: user.id,
          status: 'going',
        },
      });
    }

    // Create sample media uploads
    const sampleMedia = [
      {
        subEventId: 'soho-kickoff-dinner',
        type: 'image',
        url: '/images/events/soho-dinner-1.jpg',
        caption: 'Kelly Wearstler discussing new design trends',
        tags: ['dinner', 'networking', 'kelly-wearstler'],
        userId: users[0].id,
      },
      {
        subEventId: 'future-material-design',
        type: 'image',
        url: '/images/events/material-panel-1.jpg',
        caption: 'David Rockwell presenting on sustainable materials',
        tags: ['panel', 'sustainability', 'david-rockwell'],
        userId: users[1].id,
      },
      {
        subEventId: 'williamsburg-rooftop-showcase',
        type: 'video',
        url: '/videos/events/williamsburg-showcase.mp4',
        thumbnail: '/images/events/williamsburg-thumbnail.jpg',
        caption: 'Product showcase highlights',
        tags: ['showcase', 'products', 'innovation'],
        userId: users[2].id,
      },
    ];

    for (const media of sampleMedia) {
      await prisma.subEventMedia.create({
        data: media,
      });
    }

    console.log('✅ Created sample RSVPs and media');

    console.log('🎉 NYCxDesign 2025 Signature Event created successfully!');
    console.log('📊 Event Details:');
    console.log(`   - Main Event: NYCxDesign 2025`);
    console.log(`   - 5 Sub-events created`);
    console.log(`   - 10 Products from 5 vendors`);
    console.log(`   - Sample RSVPs and media uploads`);
    console.log(`   - QR codes generated for each sub-event`);

  } catch (error) {
    console.error('❌ Error creating NYCxDesign event:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  createNYCxDesignEvent()
    .then(() => {
      console.log('NYCxDesign event creation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('NYCxDesign event creation failed:', error);
      process.exit(1);
    });
}

module.exports = { createNYCxDesignEvent }; 