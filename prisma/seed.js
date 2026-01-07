/* prisma/seed.js */
const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function upsertUser({ email, role, name }) {
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 12);

  // upsert the user; update resets the passwordHash & role in case it drifted
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role },
    create: {
      email,
      name,
      role,
      passwordHash,
    },
  });

  // Optionally upsert role-specific profile records if your schema has them
  // These blocks are wrapped in try/catch so the seed doesn't fail if models don't exist.

  if (role === Role.DESIGNER) {
    try {
      await prisma.designer.upsert({
        where: { userId: user.id },
        update: { name: name || 'Designer User' },
        create: {
          userId: user.id,
          name: name || 'Designer User',
        },
      });
    } catch (e) {
      // No Designer model or different shape — ignore
    }
  }

  if (role === Role.VENDOR) {
    try {
      await prisma.vendor.upsert({
        where: { userId: user.id },
        update: { name: name || 'Vendor User' },
        create: {
          userId: user.id,
          name: name || 'Vendor User',
        },
      });
    } catch (e) {
      // No Vendor model or different shape — ignore
    }
  }

  return user;
}

// NYCxDesign 2026 Festival Data
const FEST_TITLE = 'NYCxDesign 2026';
const FEST_START = new Date('2026-05-14T09:00:00-04:00');
const FEST_END = new Date('2026-05-20T23:59:59-04:00');

// Helper functions for date manipulation
function addHours(d, hours) {
  const copy = new Date(d);
  copy.setHours(copy.getHours() + hours);
  return copy;
}

function between(start, end, dayOffset, hour) {
  const d = new Date(start);
  d.setDate(start.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// NYCxDesign 2026 Sub-events specification
const NYCX_SUBEVENTS = [
  // Opening night party (big)
  {
    title: 'NYCxDesign 2026 Opening Party @ The Refinery by Domino',
    day: 0, startHour: 18, durationHrs: 4,
    location: 'The Refinery at Domino, Brooklyn',
    rsvpTarget: 900, createdBy: 'prA',
  },
  // Panels & talks
  { title: 'Design Futures: AI & Craft', day: 1, startHour: 10, location: 'SoHo Design District', createdBy: 'prB', rsvpTarget: 260 },
  { title: 'Sustainability in Materials: New Standards', day: 2, startHour: 11, location: 'A/D/O Green Lab', createdBy: 'prB', rsvpTarget: 210 },
  { title: 'Keynote: The City as a Living Interface', day: 3, startHour: 9, location: 'The Shed, Hudson Yards', createdBy: 'prA', rsvpTarget: 600 },
  // Product reveals
  { title: 'Lexus Pavilion: Light + Motion Reveal', day: 1, startHour: 15, location: 'Hudson Yards Public Square & Gardens', createdBy: 'prC', rsvpTarget: 380, linkedProducts: ['SKU-LEX-NEON','SKU-LEX-ARC'] },
  { title: 'Stone & Steam: Kettle Collection by Alinea', day: 2, startHour: 16, location: 'Nolita Showroom', createdBy: 'prA', rsvpTarget: 180 },
  // Installations / exhibitions
  { title: 'Soft Geometry: Inflated Forms', day: 0, startHour: 12, durationHrs: 6, location: 'Industry City, Building 5', createdBy: 'prC', rsvpTarget: 140 },
  { title: 'Glass Lines: A Micro Exhibition', day: 3, startHour: 12, durationHrs: 6, location: 'Chelsea Gallery Row', createdBy: 'prB', rsvpTarget: 90 },
  { title: 'Future Woods: Engineered Timber Pavilion', day: 4, startHour: 10, durationHrs: 8, location: 'Brooklyn Navy Yard', createdBy: 'prC', rsvpTarget: 110 },
  // Booths
  { title: 'Maison&Objet — Studio ARCA Booth', day: 1, startHour: 10, durationHrs: 7, location: 'Javits Center – Hall B', createdBy: 'prA', rsvpTarget: 70 },
  { title: 'Maison&Objet — Ceramic Cloud Booth', day: 1, startHour: 10, durationHrs: 7, location: 'Javits Center – Hall B', createdBy: 'prB', rsvpTarget: 65 },
  { title: 'Designers\' Night Out', day: 2, startHour: 19, durationHrs: 3, location: 'Seaport Esplanade', createdBy: 'prB', rsvpTarget: 120 },
];

async function seedNYCxDesign2026() {
  console.log('🌱 Seeding NYCxDesign 2026 + sub-events...');

  // Create additional users for NYCxDesign
  const prA = await upsertUser({ 
    email: 'press@northsix-pr.com', 
    name: 'NorthSix PR', 
    role: Role.VENDOR 
  });
  const prB = await upsertUser({ 
    email: 'hello@designpressco.com', 
    name: 'Design Press Co.', 
    role: Role.VENDOR 
  });
  const prC = await upsertUser({ 
    email: 'events@showroomcollective.com', 
    name: 'Showroom Collective', 
    role: Role.VENDOR 
  });

  // Create additional designers for RSVPs
  const designers = await Promise.all([
    upsertUser({ email: 'designer1@folio.com', name: 'Designer One', role: Role.DESIGNER }),
    upsertUser({ email: 'designer2@folio.com', name: 'Designer Two', role: Role.DESIGNER }),
    upsertUser({ email: 'designer3@folio.com', name: 'Designer Three', role: Role.DESIGNER }),
    upsertUser({ email: 'designer4@folio.com', name: 'Designer Four', role: Role.DESIGNER }),
    upsertUser({ email: 'designer5@folio.com', name: 'Designer Five', role: Role.DESIGNER }),
  ]);

  const creatorByKey = { prA: prA.id, prB: prB.id, prC: prC.id };

  // Upsert main festival
  const fest = await prisma.event.upsert({
    where: { id: 'nycx-design-2026' },
    update: {
      startDate: FEST_START,
      endDate: FEST_END,
      isApproved: true,
      isPublic: true,
      imageUrl: 'https://picsum.photos/seed/nycx-fest/1400/700',
      location: 'New York, NY',
      eventTypes: ['FESTIVAL'], // Add FESTIVAL eventType
    },
    create: {
      id: 'nycx-design-2026',
      title: FEST_TITLE,
      description: 'NYCxDESIGN unites NYC\'s multidisciplinary and global design community for a week of exhibitions, launches, talks, and parties across the city.',
      location: 'New York, NY',
      startDate: FEST_START,
      endDate: FEST_END,
      imageUrl: 'https://picsum.photos/seed/nycx-fest/1400/700',
      isPublic: true,
      isApproved: true,
      createdById: prA.id, // Use first PR firm as creator
      isFestival: true,
      eventTypes: ['FESTIVAL'], // Add FESTIVAL eventType
    },
  });

  // Delete existing sub-events to prevent duplicates on re-seed
  // First delete related event_products, then delete events
  const existingEvents = await prisma.event.findMany({ 
    where: { parentFestivalId: fest.id },
    select: { id: true }
  });
  
  if (existingEvents.length > 0) {
    const eventIds = existingEvents.map(e => e.id);
    await prisma.event_products.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { parentFestivalId: fest.id } });
  }

  // Create sub-events
  for (let i = 0; i < NYCX_SUBEVENTS.length; i++) {
    const spec = NYCX_SUBEVENTS[i];
    const start = between(FEST_START, FEST_END, spec.day, spec.startHour);
    const end = addHours(start, spec.durationHrs ?? 2);

    const subEvent = await prisma.event.create({
      data: {
        title: spec.title,
        description: 'Part of NYCxDesign 2026. Expect a design-forward crowd, good conversations, and plenty of inspiration.',
        location: spec.location,
        startDate: start,
        endDate: end,
        imageUrl: `https://picsum.photos/seed/nycx-${i}/1200/630`,
        isPublic: true,
        isApproved: true,
        createdById: creatorByKey[spec.createdBy],
        parentFestivalId: fest.id,
        eventTypes: ['OTHER'], // Add eventTypes field
      },
    });

    // Create RSVPs for this sub-event
    const target = Math.min(spec.rsvpTarget ?? 90, designers.length);
    const step = Math.max(1, Math.floor(designers.length / target));
    const chosen = designers.filter((_, idx) => idx % step === 0).slice(0, target);

    if (chosen.length) {
      await prisma.eventRSVP.createMany({
        data: chosen.map((user) => ({
          userId: user.id,
          eventId: subEvent.id,
          status: 'attending',
        })),
        skipDuplicates: true,
      });
    }

    // Create sample products for events with linkedProducts
    if (spec.linkedProducts && spec.linkedProducts.length > 0) {
      for (const sku of spec.linkedProducts) {
        const product = await prisma.product.upsert({
          where: { id: sku },
          update: {},
          create: {
            id: sku,
            name: `${sku} Product`,
            description: `Featured product at ${spec.title}`,
            price: Math.floor(Math.random() * 1000) + 100,
            imageUrl: `https://picsum.photos/seed/${sku}/400/400`,
            category: 'Featured',
            brand: 'Design Brand',
            vendorId: creatorByKey[spec.createdBy],
          },
        });

        // Link product to event
        await prisma.event_products.upsert({
          where: { id: `${subEvent.id}-${sku}` },
          update: {},
          create: {
            id: `${subEvent.id}-${sku}`,
            eventId: subEvent.id,
            productId: product.id,
            position: 0,
            name: product.name,
            imageUrl: product.imageUrl,
            price: product.price,
            url: product.url,
          },
        });
      }
    }
  }

  console.log('✅ NYCxDesign 2026 seeded with', NYCX_SUBEVENTS.length, 'sub-events.');
  
  // Return the festival ID for featured products seeding
  return fest.id;
}

// Featured Products Seeding for NYCxDesign 2026
async function seedFeaturedForNycxDesign2026(festivalId) {
  console.log('🎯 Seeding featured products for NYCxDesign 2026...');

  // Load all sub-events for the festival
  const subEvents = await prisma.event.findMany({
    where: { parentFestivalId: festivalId },
    select: { id: true, title: true }
  });

  if (subEvents.length === 0) {
    console.log('⚠️ No sub-events found for featured products seeding');
    return { subEventsWithFeatured: 0, totalFeaturedLinks: 0 };
  }

  // Create a comprehensive set of demo products for featured seeding
  const demoProducts = [
    // Furniture & Lighting
    { id: 'TMQ-01', name: 'Modern Task Chair', category: 'Furniture', brand: 'TaskMaster', price: 450 },
    { id: 'THS-12', name: 'High-Table Stool', category: 'Furniture', brand: 'TableHigh', price: 280 },
    { id: 'LUM-ARC', name: 'Arc Floor Lamp', category: 'Lighting', brand: 'LumenWorks', price: 650 },
    { id: 'LUM-P3', name: 'Pendant Light P3', category: 'Lighting', brand: 'LumenWorks', price: 420 },
    
    // Textiles & Materials
    { id: 'FAB-WOOL', name: 'Premium Wool Fabric', category: 'Textiles', brand: 'FabricCraft', price: 85 },
    { id: 'FAB-LIN', name: 'Linen Blend Material', category: 'Textiles', brand: 'FabricCraft', price: 65 },
    { id: 'STL-ACR', name: 'Acrylic Surface Panel', category: 'Materials', brand: 'SurfaceTech', price: 120 },
    { id: 'STL-QUA', name: 'Quartz Countertop', category: 'Materials', brand: 'SurfaceTech', price: 180 },
    
    // Decorative & Accessories
    { id: 'ART-GEO', name: 'Geometric Art Piece', category: 'Art', brand: 'ArtSpace', price: 320 },
    { id: 'VAS-CER', name: 'Ceramic Vase', category: 'Accessories', brand: 'CeramicWorks', price: 95 },
    { id: 'PLT-HAN', name: 'Handwoven Plant Basket', category: 'Accessories', brand: 'PlantLife', price: 75 },
    { id: 'CUS-LEA', name: 'Leather Cushion', category: 'Accessories', brand: 'CustomCraft', price: 150 }
  ];

  // Get all vendor IDs for product assignment
  const vendors = await prisma.user.findMany({
    where: { role: 'VENDOR' },
    select: { id: true, name: true }
  });

  if (vendors.length === 0) {
    console.log('⚠️ No vendors found for featured products seeding');
    return { subEventsWithFeatured: 0, totalFeaturedLinks: 0 };
  }

  // Create demo products (upsert to avoid duplicates)
  const createdProducts = [];
  for (const productData of demoProducts) {
    const vendor = vendors[Math.floor(Math.random() * vendors.length)]; // Random vendor assignment
    const product = await prisma.product.upsert({
      where: { id: productData.id },
      update: {},
      create: {
        id: productData.id,
        name: productData.name,
        description: `Featured ${productData.category.toLowerCase()} for NYCxDesign 2026`,
        price: productData.price,
        imageUrl: `https://picsum.photos/seed/${productData.id}/400/400`,
        category: productData.category,
        brand: productData.brand,
        vendorId: vendor.id,
      },
    });
    createdProducts.push(product);
  }

  // Deterministic mapping of products to sub-events based on event themes
  const subEventFeaturedMapping = {
    // Opening events - premium lighting and furniture
    'NYCxDesign 2026 Opening Party @ The Refinery by Domino': ['LUM-ARC', 'TMQ-01', 'CUS-LEA'],
    
    // Design panels - furniture and materials
    'Design Futures: AI & Craft': ['THS-12', 'STL-ACR', 'ART-GEO'],
    'Sustainability in Materials: New Standards': ['FAB-WOOL', 'STL-QUA', 'PLT-HAN'],
    'Keynote: The City as a Living Interface': ['LUM-P3', 'TMQ-01', 'VAS-CER'],
    
    // Product reveals - specific product categories
    'Lexus Pavilion: Light + Motion Reveal': ['LUM-ARC', 'LUM-P3', 'STL-ACR'],
    'Stone & Steam: Kettle Collection by Alinea': ['VAS-CER', 'STL-QUA', 'FAB-LIN'],
    
    // Installations - art and decorative
    'Soft Geometry: Inflated Forms': ['ART-GEO', 'FAB-WOOL', 'PLT-HAN'],
    'Glass Lines: A Micro Exhibition': ['VAS-CER', 'STL-ACR', 'CUS-LEA'],
    'Future Woods: Engineered Timber Pavilion': ['STL-QUA', 'TMQ-01', 'FAB-LIN'],
    
    // Booths - mixed categories
    'Maison&Objet — Studio ARCA Booth': ['ART-GEO', 'LUM-P3', 'FAB-WOOL'],
    'Maison&Objet — Ceramic Cloud Booth': ['VAS-CER', 'PLT-HAN', 'CUS-LEA'],
    
    // Networking events - accessories and lighting
    'Designers\' Night Out': ['LUM-ARC', 'CUS-LEA', 'ART-GEO']
  };

  let totalFeaturedLinks = 0;
  let subEventsWithFeatured = 0;

  // Seed featured products for each sub-event
  for (const subEvent of subEvents) {
    const featuredProductIds = subEventFeaturedMapping[subEvent.title] || [];
    
    if (featuredProductIds.length === 0) {
      // Fallback: pick first 2 products alphabetically for events not in mapping
      const fallbackProducts = createdProducts
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, 2)
        .map(p => p.id);
      featuredProductIds.push(...fallbackProducts);
    }

    // Upsert featured product links for this sub-event
    for (let i = 0; i < featuredProductIds.length; i++) {
      const productId = featuredProductIds[i];
      const featuredRank = i + 1; // 1-based ranking
      
      await prisma.event_products.upsert({
        where: { id: `${subEvent.id}-${productId}` },
        update: {},
        create: {
          id: `${subEvent.id}-${productId}`,
          eventId: subEvent.id,
          productId: productId,
          position: featuredRank,
          name: createdProducts.find(p => p.id === productId)?.name || `${productId} Product`,
          imageUrl: `https://picsum.photos/seed/${productId}/400/400`,
          price: createdProducts.find(p => p.id === productId)?.price || 100,
        },
      });
      
      totalFeaturedLinks++;
    }
    
    subEventsWithFeatured++;
  }

  const summary = { subEventsWithFeatured, totalFeaturedLinks };
  console.log(`✅ Featured products seeded: ${summary.subEventsWithFeatured} sub-events, ${summary.totalFeaturedLinks} featured links`);
  
  return summary;
}

async function main() {
  const results = await Promise.all([
    upsertUser({ email: 'admin@folio.com', name: 'Admin User', role: Role.ADMIN }),
    upsertUser({ email: 'designer@folio.com', name: 'Designer User', role: Role.DESIGNER }),
    upsertUser({ email: 'vendor@folio.com', name: 'Vendor User', role: Role.VENDOR }),
  ]);

  console.log('Seeded users:', results.map(u => ({ id: u.id, email: u.email, role: u.role })));

  // Seed NYCxDesign 2026 festival and sub-events
  const festivalId = await seedNYCxDesign2026();
  
  // Seed featured products for NYCxDesign 2026
  const featuredSummary = await seedFeaturedForNycxDesign2026(festivalId);
  
  console.log('\n📊 NYCxDesign 2026 Seeding Summary:');
  console.log(`   Festival ID: ${festivalId}`);
  console.log(`   Sub-events with featured products: ${featuredSummary.subEventsWithFeatured}`);
  console.log(`   Total featured product links: ${featuredSummary.totalFeaturedLinks}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });


