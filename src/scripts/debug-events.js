const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugEvents() {
  try {
    console.log('🔍 DEBUGGING EVENTS DATABASE...\n');

    // 1. Check if the event exists
    console.log('1️⃣ Checking if NYCxDesign event exists...');
    const event = await prisma.event.findUnique({
      where: { id: "nycxdesign-2025" },
      include: { 
        subEvents: {
          include: {
            media: true,
            products: true,
            rsvps: true
          }
        },
        eventRSVPs: true,
        media: true,
        products: true
      }
    });

    if (!event) {
      console.log('❌ NYCxDesign event NOT FOUND in database!');
      return;
    }

    console.log('✅ NYCxDesign event found!');
    console.log(`   Title: ${event.title}`);
    console.log(`   Sub-events count: ${event.subEvents?.length || 0}`);
    console.log(`   RSVPs count: ${event.eventRSVPs?.length || 0}`);
    console.log(`   Media count: ${event.media?.length || 0}`);
    console.log(`   Products count: ${event.products?.length || 0}\n`);

    // 2. Check sub-events details
    if (event.subEvents && event.subEvents.length > 0) {
      console.log('2️⃣ Sub-events found:');
      event.subEvents.forEach((subEvent, index) => {
        console.log(`   ${index + 1}. ${subEvent.title}`);
        console.log(`      Date: ${subEvent.startTime}`);
        console.log(`      Type: ${subEvent.type}`);
        console.log(`      Location: ${subEvent.location}`);
        console.log(`      Media: ${subEvent.media?.length || 0}`);
        console.log(`      Products: ${subEvent.products?.length || 0}`);
        console.log(`      RSVPs: ${subEvent.rsvps?.length || 0}\n`);
      });
    } else {
      console.log('❌ NO SUB-EVENTS FOUND!');
    }

    // 3. Check all events in database
    console.log('3️⃣ All events in database:');
    const allEvents = await prisma.event.findMany({
      select: {
        id: true,
        title: true,
        isSignature: true,
        isPinned: true,
        _count: {
          select: {
            subEvents: true,
            eventRSVPs: true
          }
        }
      }
    });

    allEvents.forEach(e => {
      console.log(`   - ${e.title} (${e.id})`);
      console.log(`     Signature: ${e.isSignature}, Pinned: ${e.isPinned}`);
      console.log(`     Sub-events: ${e._count.subEvents}, RSVPs: ${e._count.eventRSVPs}\n`);
    });

    // 4. Check schema relations
    console.log('4️⃣ Checking schema relations...');
    const subEventCount = await prisma.subEvent.count();
    const eventCount = await prisma.event.count();
    console.log(`   Total events: ${eventCount}`);
    console.log(`   Total sub-events: ${subEventCount}`);

    // 5. Check for orphaned sub-events
    const orphanedSubEvents = await prisma.subEvent.findMany({
      where: {
        eventId: null
      }
    });
    console.log(`   Orphaned sub-events: ${orphanedSubEvents.length}`);

    console.log('\n🎯 DIAGNOSTIC COMPLETE');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugEvents(); 