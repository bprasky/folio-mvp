const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkEvents() {
  try {
    console.log('🔍 Checking events in database...');

    // Check all events
    const events = await prisma.event.findMany({
      include: {
        subEvents: true,
        eventRSVPs: true,
        _count: {
          select: {
            subEvents: true,
            eventRSVPs: true,
            media: true,
            products: true
          }
        }
      }
    });

    console.log(`📊 Found ${events.length} events:`);
    events.forEach(event => {
      console.log(`- ${event.title} (${event.id})`);
      console.log(`  Signature: ${event.isSignature}, Pinned: ${event.isPinned}`);
      console.log(`  Sub-events: ${event._count.subEvents}`);
      console.log(`  RSVPs: ${event._count.eventRSVPs}`);
      console.log(`  Media: ${event._count.media}`);
      console.log(`  Products: ${event._count.products}`);
      console.log('');
    });

    // Check NYCxDesign specifically
    const nycxDesign = await prisma.event.findUnique({
      where: { id: 'nycx-design-2025' },
      include: {
        subEvents: {
          orderBy: { startTime: 'asc' }
        },
        eventRSVPs: true
      }
    });

    if (nycxDesign) {
      console.log('✅ NYCxDesign 2025 found!');
      console.log(`Title: ${nycxDesign.title}`);
      console.log(`Signature: ${nycxDesign.isSignature}`);
      console.log(`Sub-events: ${nycxDesign.subEvents.length}`);
      nycxDesign.subEvents.forEach(se => {
        console.log(`  - ${se.title} (${se.type}) at ${se.startTime}`);
      });
    } else {
      console.log('❌ NYCxDesign 2025 not found!');
    }

  } catch (error) {
    console.error('❌ Error checking events:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEvents(); 