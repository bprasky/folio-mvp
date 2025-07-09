const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createSpotlightProducts() {
  try {
    // Get existing subevents
    const subEvents = await prisma.subEvent.findMany({
      take: 5, // Limit to first 5 subevents
    });

    console.log(`Found ${subEvents.length} subevents`);

    // Get existing products
    const products = await prisma.product.findMany({
      take: 10, // Limit to first 10 products
    });

    console.log(`Found ${products.length} products`);

    if (subEvents.length === 0 || products.length === 0) {
      console.log('No subevents or products found. Please create some first.');
      return;
    }

    // Create spotlight products for each subevent
    for (const subEvent of subEvents) {
      // Select 2-4 random products for this subevent
      const numProducts = Math.floor(Math.random() * 3) + 2; // 2-4 products
      const selectedProducts = products
        .sort(() => 0.5 - Math.random())
        .slice(0, numProducts);

      for (const product of selectedProducts) {
        const spotlightReasons = [
          'Trending at this event',
          'Most saved by attendees',
          'Featured by organizers',
          'Best seller this season',
          'Designer favorite',
          'Innovation award winner'
        ];

        const spotlightReason = spotlightReasons[Math.floor(Math.random() * spotlightReasons.length)];
        const featured = Math.random() > 0.7; // 30% chance of being featured

        try {
          await prisma.subEventSpotlightProduct.create({
            data: {
              subEventId: subEvent.id,
              productId: product.id,
              featured: featured,
              spotlightReason: spotlightReason,
            },
          });

          console.log(`Created spotlight product: ${product.name} for subevent: ${subEvent.title}`);
        } catch (error) {
          if (error.code === 'P2002') {
            console.log(`Spotlight product already exists for ${product.name} in ${subEvent.title}`);
          } else {
            console.error(`Error creating spotlight product:`, error);
          }
        }
      }
    }

    console.log('Spotlight products creation completed!');
  } catch (error) {
    console.error('Error creating spotlight products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSpotlightProducts(); 