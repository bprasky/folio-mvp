import axios from 'axios';

const BROWSERLESS_TOKEN = '2Sbq0KFBxBlYj237333ef79801d3b6ec95e752a02d26dd3ae';

async function testSimpleBrowserless() {
  console.log('🧪 Testing Basic Browserless Connection');
  console.log('=====================================');
  console.log(`🔑 Token: ${BROWSERLESS_TOKEN.substring(0, 10)}...`);
  console.log('');

  const script = `
    const page = await browser.newPage();
    await page.goto('https://www.heidicaillierdesign.com');
    const title = await page.title();
    return { title, url: page.url() };
  `;

  try {
    console.log('🔄 Connecting to Browserless API...');
    
    const response = await axios.post(
      `https://production-sfo.browserless.io/function?token=${BROWSERLESS_TOKEN}`,
      { code: script },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    console.log('✅ API Connectivity Status: SUCCESS');
    console.log('✅ HTTP Status: 200 OK');
    console.log('');
    console.log('📊 Basic Scraping Results:');
    console.log('==========================');
    console.log(`Title: ${response.data.title}`);
    console.log(`URL: ${response.data.url}`);
    console.log('');
    console.log('✅ Basic Browserless test completed successfully!');
    
    return { success: true, data: response.data };
    
  } catch (err) {
    console.log('❌ API Connectivity Status: FAILED');
    
    if (err.response) {
      console.error('❌ HTTP Error:', err.response.status);
      console.error('❌ Error Details:', err.response.data);
    } else if (err.request) {
      console.error('❌ Network Error:', err.request);
    } else {
      console.error('❌ Unexpected Error:', err.message);
    }
    
    return { success: false, error: err.message };
  }
}

testSimpleBrowserless(); 