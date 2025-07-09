const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getSubEventIds() {
  try {
    console.log('🔍 Getting sub-event IDs...');
    
    const subEvents = await prisma.subEvent.findMany({
      where: {
        eventId: 'nycxdesign-2025'
      },
      select: {
        id: true,
        title: true,
        type: true,
        startTime: true
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    console.log(`📊 Found ${subEvents.length} sub-events:`);
    subEvents.forEach((se, index) => {
      console.log(`${index + 1}. ${se.title} (${se.type}) - ID: ${se.id}`);
    });

    return subEvents;
  } catch (error) {
    console.error('❌ Error getting sub-event IDs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  getSubEventIds()
    .then(() => {
      console.log('Sub-event ID retrieval completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Sub-event ID retrieval failed:', error);
      process.exit(1);
    });
}

module.exports = { getSubEventIds }; 