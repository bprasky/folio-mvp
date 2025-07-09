const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFeedAggregation() {
  try {
    console.log('🧪 Testing Feed Aggregation...\n');

    // Test 1: Check if there are any subevent media posts
    console.log('1. Checking for subevent media posts...');
    const subEventMedia = await prisma.subEventMedia.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            profileType: true
          }
        },
        subEvent: {
          select: {
            id: true,
            title: true,
            event: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      }
    });

    console.log(`Found ${subEventMedia.length} subevent media posts:`);
    subEventMedia.forEach((media, i) => {
      console.log(`  ${i + 1}. ${media.caption || 'No caption'} by ${media.user.name}`);
      console.log(`     Event: ${media.subEvent.event.title} - ${media.subEvent.title}`);
      console.log(`     Type: ${media.type}, Created: ${media.createdAt}`);
    });

    // Test 2: Check the feed API response
    console.log('\n2. Testing feed API response...');
    const response = await fetch('http://localhost:3001/api/feed');
    const feedData = await response.json();

    if (feedData.items) {
      console.log(`Feed API returned ${feedData.items.length} items`);
      
      // Count different types
      const typeCounts = {};
      const subeventPosts = feedData.items.filter(item => item.subType === 'subevent_post');
      
      feedData.items.forEach(item => {
        typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
      });

      console.log('Feed item types:');
      Object.entries(typeCounts).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

      console.log(`\nSubevent posts in feed: ${subeventPosts.length}`);
      subeventPosts.slice(0, 3).forEach((post, i) => {
        console.log(`  ${i + 1}. ${post.title} (${post.eventTitle} - ${post.subEventTitle})`);
      });
    } else {
      console.log('❌ Feed API returned no items');
    }

    // Test 3: Check if we have any subevents with media
    console.log('\n3. Checking subevents with media...');
    const subEventsWithMedia = await prisma.subEvent.findMany({
      where: {
        media: {
          some: {}
        }
      },
      include: {
        _count: {
          select: {
            media: true
          }
        },
        event: {
          select: {
            title: true
          }
        }
      }
    });

    console.log(`Found ${subEventsWithMedia.length} subevents with media:`);
    subEventsWithMedia.forEach((subEvent, i) => {
      console.log(`  ${i + 1}. ${subEvent.title} (${subEvent.event.title})`);
      console.log(`     Media count: ${subEvent._count.media}`);
    });

    console.log('\n✅ Feed aggregation test completed!');

  } catch (error) {
    console.error('❌ Error testing feed aggregation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testFeedAggregation(); 