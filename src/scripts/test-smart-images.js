const { SmartImageSearch } = require('../lib/imageSearch');

async function testSmartImageSearch() {
  console.log('🧪 Testing Smart Image Search...\n');

  // Test 1: Event search
  console.log('📅 Testing Event Image Search:');
  const eventContext = {
    type: 'event',
    name: 'Balthazar Restaurant Dinner',
    description: 'An intimate dinner with design legend Kelly Wearstler',
    location: 'SoHo, New York',
    category: 'dinner'
  };

  try {
    const eventImages = await SmartImageSearch.searchImages(eventContext);
    console.log(`✅ Found ${eventImages.length} event images`);
    if (eventImages.length > 0) {
      console.log(`   Top result: ${eventImages[0].title} (${eventImages[0].width}×${eventImages[0].height})`);
    }
  } catch (error) {
    console.log('❌ Event search failed:', error.message);
  }

  console.log('\n🏢 Testing Vendor Image Search:');
  const vendorContext = {
    type: 'vendor',
    name: 'Benjamin Moore',
    description: 'Premium paint and coatings manufacturer',
    brand: 'Benjamin Moore'
  };

  try {
    const vendorImages = await SmartImageSearch.searchImages(vendorContext);
    console.log(`✅ Found ${vendorImages.length} vendor images`);
    if (vendorImages.length > 0) {
      console.log(`   Top result: ${vendorImages[0].title} (${vendorImages[0].width}×${vendorImages[0].height})`);
    }
  } catch (error) {
    console.log('❌ Vendor search failed:', error.message);
  }

  console.log('\n🪑 Testing Product Image Search:');
  const productContext = {
    type: 'product',
    name: 'Eames Lounge Chair',
    description: 'Classic mid-century modern furniture',
    category: 'furniture',
    brand: 'Herman Miller'
  };

  try {
    const productImages = await SmartImageSearch.searchImages(productContext);
    console.log(`✅ Found ${productImages.length} product images`);
    if (productImages.length > 0) {
      console.log(`   Top result: ${productImages[0].title} (${productImages[0].width}×${productImages[0].height})`);
    }
  } catch (error) {
    console.log('❌ Product search failed:', error.message);
  }

  console.log('\n🏛️ Testing Location Image Search:');
  const locationContext = {
    type: 'location',
    name: 'Cooper Hewitt Museum',
    location: 'Upper East Side, New York'
  };

  try {
    const locationImages = await SmartImageSearch.searchImages(locationContext);
    console.log(`✅ Found ${locationImages.length} location images`);
    if (locationImages.length > 0) {
      console.log(`   Top result: ${locationImages[0].title} (${locationImages[0].width}×${locationImages[0].height})`);
    }
  } catch (error) {
    console.log('❌ Location search failed:', error.message);
  }

  // Test auto-population
  console.log('\n🎯 Testing Auto-Population:');
  const testEvent = {
    title: 'Williamsburg Rooftop Showcase',
    description: 'Exclusive product showcase featuring the latest innovations',
    location: 'Wythe Hotel Rooftop, Williamsburg',
    type: 'product showcase'
  };

  try {
    const autoImages = await SmartImageSearch.autoPopulateImages(testEvent, 'event');
    console.log('✅ Auto-population results:');
    console.log(`   Banner: ${autoImages.banner ? '✅ Found' : '❌ Not found'}`);
    console.log(`   Thumbnail: ${autoImages.thumbnail ? '✅ Found' : '❌ Not found'}`);
  } catch (error) {
    console.log('❌ Auto-population failed:', error.message);
  }

  console.log('\n✨ Smart Image Search Test Complete!');
}

// Run the test
testSmartImageSearch().catch(console.error); 