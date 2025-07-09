// Verify that the Browserless scraper is fully working for onboarding designer profiles
// Use the /content endpoint with this test site: https://www.heidicaillierdesign.com
// Log and return the following:
// - API connectivity status
// - Any HTTP errors (403, 401, 500)
// - Parsed output from:
//    - About text
//    - Team section text
//    - Portfolio or project images (src URLs)
// Use this Browserless token: 2Sbq0KFBxBlYj23409d3d7c721ceb7abdfcdba6f978b2bf41

const axios = require('axios');

const BROWSERLESS_TOKEN = '2Sbq0KFBxBlYj23409d3d7c721ceb7abdfcdba6f978b2bf41';
const TEST_URL = 'https://www.heidicaillierdesign.com';

function extractAbout(html) {
  const aboutPatterns = [
    /<section[^>]*class="[^"]*about[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    /<div[^>]*class="[^"]*about[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*id="about"[^>]*>([\s\S]*?)<\/section>/i,
    /<div[^>]*id="about"[^>]*>([\s\S]*?)<\/div>/i,
    /<article[^>]*class="[^"]*about[^"]*"[^>]*>([\s\S]*?)<\/article>/i
  ];
  for (const pattern of aboutPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const text = match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 50) return text;
    }
  }
  return '⚠️ No about section found';
}

function extractTeam(html) {
  const teamPatterns = [
    /<section[^>]*class="[^"]*team[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    /<div[^>]*class="[^"]*team[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*class="[^"]*staff[^"]*"[^>]*>([\s\S]*?)<\/section>/i
  ];
  for (const pattern of teamPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const text = match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 30) return text;
    }
  }
  return '⚠️ No team section found';
}

function extractPortfolioImages(html) {
  const imgMatches = html.match(/<img[^>]+src="([^"]+)"[^>]*>/gi);
  if (!imgMatches) return [];
  const images = [];
  for (const match of imgMatches) {
    const srcMatch = match.match(/src="([^"]+)"/);
    if (srcMatch && srcMatch[1]) {
      const src = srcMatch[1];
      const lower = src.toLowerCase();
      if (
        lower.includes('project') ||
        lower.includes('work') ||
        lower.includes('portfolio') ||
        lower.includes('gallery') ||
        (!lower.includes('logo') && !lower.includes('icon') && !lower.includes('avatar') && !lower.includes('menu') && !lower.includes('nav'))
      ) {
        images.push(src);
      }
    }
  }
  return images;
}

async function testBrowserlessContentEndpoint() {
  console.log('🧪 Testing Browserless /content Endpoint');
  console.log('==========================================');
  console.log(`🔑 Token: ${BROWSERLESS_TOKEN.substring(0, 10)}...`);
  console.log(`🌐 Target: ${TEST_URL}`);
  console.log(`🔧 Endpoint: /content`);
  console.log('');

  try {
    console.log('🔄 Sending request to Browserless...');
    const response = await axios.post(
      `https://production-sfo.browserless.io/content?token=${BROWSERLESS_TOKEN}`,
      {
        url: TEST_URL,
        gotoOptions: {
          waitUntil: 'networkidle2',
          timeout: 45000
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 90000,
      }
    );
    console.log('✅ API Connectivity Status: SUCCESS');
    const html = response.data;
    console.log(`📊 Content length: ${html.length} characters`);
    const about = extractAbout(html);
    const team = extractTeam(html);
    const images = extractPortfolioImages(html);
    console.log('');
    console.log('📝 About Section:');
    console.log(`   ${about}`);
    console.log('');
    console.log('👥 Team Section:');
    console.log(`   ${team}`);
    console.log('');
    console.log('🖼️ Portfolio Images:');
    console.log(`   Total: ${images.length}`);
    if (images.length > 0) {
      console.log('   Sample URLs:');
      images.slice(0, 5).forEach((url, i) => console.log(`   ${i + 1}. ${url}`));
    } else {
      console.log('   ⚠️ No portfolio images found');
    }
    return { about, team, images };
  } catch (err) {
    if (err.response) {
      console.error('❌ HTTP Error:', err.response.status, err.response.data);
    } else if (err.request) {
      console.error('❌ Network Error:', err.request);
    } else {
      console.error('❌ Unexpected Error:', err.message);
    }
    return { success: false, reason: 'Browserless failed to return data.' };
  }
}

if (require.main === module) {
  testBrowserlessContentEndpoint();
} 