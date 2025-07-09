const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testTrendingAlgorithm() {
  try {
    console.log('Testing trending algorithm...\n');

    // Test 1: Get all sub-events
    console.log('1. Fetching all sub-events...');
    const subEvents = await prisma.$queryRaw`
      SELECT 
        se.*,
        COUNT(DISTINCT ser.id) as rsvp_count,
        COUNT(DISTINCT sem.id) as media_count,
        COALESCE(SUM(p."scanCount" + p."likeCount" + p."saveCount"), 0) as product_engagement
      FROM sub_events se
      LEFT JOIN sub_event_rsvps ser ON se.id = ser."subEventId"
      LEFT JOIN sub_event_media sem ON se.id = sem."subEventId"
      LEFT JOIN sub_event_products sep ON se.id = sep."subEventId"
      LEFT JOIN products p ON sep."productId" = p.id
      GROUP BY se.id
      ORDER BY se."createdAt" DESC
      LIMIT 5
    `;

    console.log(`Found ${subEvents.length} sub-events:`);
    subEvents.forEach((se, i) => {
      console.log(`  ${i + 1}. ${se.title} - RSVPs: ${se.rsvp_count}, Media: ${se.media_count}, Product Engagement: ${se.product_engagement}`);
    });

    // Test 2: Get all events
    console.log('\n2. Fetching all events...');
    const events = await prisma.$queryRaw`
      SELECT 
        e.*,
        COUNT(DISTINCT er.id) as event_rsvp_count,
        COUNT(DISTINCT em.id) as event_media_count,
        COUNT(DISTINCT ser.id) as subevent_rsvp_count,
        COUNT(DISTINCT sem.id) as subevent_media_count,
        COALESCE(SUM(p."scanCount" + p."likeCount" + p."saveCount"), 0) as total_product_engagement
      FROM events e
      LEFT JOIN event_rsvps er ON e.id = er."eventId"
      LEFT JOIN event_media em ON e.id = em."eventId"
      LEFT JOIN sub_events se ON e.id = se."eventId"
      LEFT JOIN sub_event_rsvps ser ON se.id = ser."subEventId"
      LEFT JOIN sub_event_media sem ON se.id = sem."subEventId"
      LEFT JOIN sub_event_products sep ON se.id = sep."subEventId"
      LEFT JOIN products p ON sep."productId" = p.id
      GROUP BY e.id
      ORDER BY e."createdAt" DESC
      LIMIT 5
    `;

    console.log(`Found ${events.length} events:`);
    events.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.title} - Total RSVPs: ${parseInt(e.event_rsvp_count) + parseInt(e.subevent_rsvp_count)}, Total Media: ${parseInt(e.event_media_count) + parseInt(e.subevent_media_count)}`);
    });

    // Test 3: Get all products
    console.log('\n3. Fetching all products...');
    const products = await prisma.$queryRaw`
      SELECT 
        p.*,
        COUNT(DISTINCT pt.id) as tag_count,
        COUNT(DISTINCT sep.id) as subevent_count
      FROM products p
      LEFT JOIN product_tags pt ON p.id = pt."productId"
      LEFT JOIN sub_event_products sep ON p.id = sep."productId"
      GROUP BY p.id
      ORDER BY p."createdAt" DESC
      LIMIT 5
    `;

    console.log(`Found ${products.length} products:`);
    products.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} - Scans: ${p.scanCount || 0}, Likes: ${p.likeCount || 0}, Saves: ${p.saveCount || 0}, Tags: ${p.tag_count}`);
    });

    // Test 4: Calculate simple trending scores
    console.log('\n4. Calculating simple trending scores...');
    
    subEvents.forEach((se, i) => {
      const viewScore = (se.viewCount || 0) * 0.1;
      const rsvpScore = parseInt(se.rsvp_count) * 2.0;
      const mediaScore = parseInt(se.media_count) * 1.5;
      const productScore = parseInt(se.product_engagement) * 0.5;
      
      const totalScore = Math.round(viewScore + rsvpScore + mediaScore + productScore);
      
      console.log(`  ${i + 1}. ${se.title}: ${totalScore} points`);
      console.log(`     - Views: ${se.viewCount || 0} (${viewScore.toFixed(1)} pts)`);
      console.log(`     - RSVPs: ${se.rsvp_count} (${rsvpScore} pts)`);
      console.log(`     - Media: ${se.media_count} (${mediaScore} pts)`);
      console.log(`     - Products: ${se.product_engagement} (${productScore} pts)`);
    });

    console.log('\n✅ Trending algorithm test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing trending algorithm:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTrendingAlgorithm(); 