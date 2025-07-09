const axios = require('axios');
const BROWSERLESS_TOKEN = '2Sbq0KFBxBlYj237333ef79801d3b6ec95e752a02d26dd3ae';

console.log('🧪 Testing Browserless with /content endpoint');
console.log('=============================================');
console.log(`🔑 Token: ${BROWSERLESS_TOKEN.substring(0, 10)}...`);
console.log(`🌐 Endpoint: https://production-sfo.browserless.io/content`);
console.log('');

console.log('🔄 Connecting to Browserless API...');

axios.post(
  'https://production-sfo.browserless.io/content?token=' + BROWSERLESS_TOKEN,
  { 
    url: 'https://example.com',
    gotoOptions: {
      waitUntil: 'networkidle2',
      timeout: 30000
    }
  },
  { 
    headers: { 'Content-Type': 'application/json' }, 
    timeout: 30000 
  }
).then(res => {
  console.log('✅ SUCCESS! Browserless /content is working!');
  console.log('📊 Response length:', res.data.length);
  console.log('📄 First 200 characters:');
  console.log(res.data.substring(0, 200));
}).catch(err => {
  console.log('❌ FAILED!');
  if (err.response) {
    console.error('HTTP Error:', err.response.status);
    console.error('Error Details:', err.response.data);
  } else {
    console.error('Network Error:', err.message);
  }
}); 