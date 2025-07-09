const axios = require('axios');
const BROWSERLESS_TOKEN = '2Sbq0KFBxBlYj237333ef79801d3b6ec95e752a02d26dd3ae';

console.log('🧪 Testing Browserless with /execute endpoint');
console.log('=============================================');
console.log(`🔑 Token: ${BROWSERLESS_TOKEN.substring(0, 10)}...`);
console.log(`🌐 Endpoint: https://production-sfo.browserless.io/execute`);
console.log('');

const script = `
const page = await browser.newPage();
await page.goto('https://example.com');
const title = await page.title();
return { title, url: page.url() };
`;

console.log('🔄 Connecting to Browserless API...');

axios.post(
  'https://production-sfo.browserless.io/execute?token=' + BROWSERLESS_TOKEN,
  { code: script },
  { 
    headers: { 'Content-Type': 'application/json' }, 
    timeout: 30000 
  }
).then(res => {
  console.log('✅ SUCCESS! Browserless /execute is working!');
  console.log('📊 Response:');
  console.log(JSON.stringify(res.data, null, 2));
}).catch(err => {
  console.log('❌ FAILED!');
  if (err.response) {
    console.error('HTTP Error:', err.response.status);
    console.error('Error Details:', err.response.data);
  } else {
    console.error('Network Error:', err.message);
  }
}); 