const axios = require('axios');
const BROWSERLESS_TOKEN = '2Sbq0KFBxBlYj237333ef79801d3b6ec95e752a02d26dd3ae';

async function scrapeDesignerWebsite() {
  console.log('🧪 Testing Designer Onboarding Scraper');
  console.log('=====================================');
  console.log(`🔑 Token: ${BROWSERLESS_TOKEN.substring(0, 10)}...`);
  console.log(`🌐 Target: https://www.heidicaillierdesign.com`);
  console.log('');

  try {
    console.log('🔄 Fetching website content...');
    
    const response = await axios.post(
      'https://production-sfo.browserless.io/content?token=' + BROWSERLESS_TOKEN,
      { 
        url: 'https://www.heidicaillierdesign.com',
        gotoOptions: {
          waitUntil: 'networkidle2',
          timeout: 45000
        }
      },
      { 
        headers: { 'Content-Type': 'application/json' }, 
        timeout: 60000 
      }
    );

    console.log('✅ SUCCESS! Website content retrieved!');
    console.log(`📊 Content length: ${response.data.length} characters`);
    console.log('');

    // Parse the HTML content
    const html = response.data;
    
    // Extract information using regex patterns
    const results = {
      title: extractTitle(html),
      about: extractAbout(html),
      team: extractTeam(html),
      images: extractImages(html),
      contact: extractContact(html)
    };

    console.log('📊 PARSED RESULTS:');
    console.log('==================');
    
    console.log('\n📝 Title:');
    console.log(results.title || '⚠️ No title found');
    
    console.log('\n📝 About Section:');
    if (results.about) {
      console.log(`Length: ${results.about.length} characters`);
      console.log(`Preview: ${results.about.substring(0, 300)}...`);
    } else {
      console.log('⚠️ No about section found');
    }
    
    console.log('\n👥 Team Section:');
    if (results.team) {
      console.log(`Length: ${results.team.length} characters`);
      console.log(`Preview: ${results.team.substring(0, 300)}...`);
    } else {
      console.log('⚠️ No team section found');
    }
    
    console.log('\n🖼️ Images Found:');
    if (results.images.length > 0) {
      console.log(`Total: ${results.images.length} images`);
      console.log('Sample URLs:');
      results.images.slice(0, 5).forEach((img, index) => {
        console.log(`  ${index + 1}. ${img}`);
      });
    } else {
      console.log('⚠️ No images found');
    }
    
    console.log('\n📧 Contact Information:');
    if (results.contact.emails.length > 0) {
      console.log('Emails:');
      results.contact.emails.forEach((email, index) => {
        console.log(`  ${index + 1}. ${email}`);
      });
    } else {
      console.log('⚠️ No emails found');
    }

    console.log('\n✅ Designer onboarding scraper completed successfully!');
    console.log('🚀 Ready for production use!');
    
    return results;

  } catch (err) {
    console.log('❌ FAILED!');
    if (err.response) {
      console.error('HTTP Error:', err.response.status);
      console.error('Error Details:', err.response.data);
    } else {
      console.error('Network Error:', err.message);
    }
    return null;
  }
}

// Helper functions to extract data from HTML
function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

function extractAbout(html) {
  // Look for about sections
  const aboutPatterns = [
    /<section[^>]*class="[^"]*about[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
    /<div[^>]*class="[^"]*about[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<section[^>]*id="about"[^>]*>([\s\S]*?)<\/section>/gi,
    /<div[^>]*id="about"[^>]*>([\s\S]*?)<\/div>/gi
  ];
  
  for (const pattern of aboutPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const text = match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 50) return text;
    }
  }
  return null;
}

function extractTeam(html) {
  // Look for team sections
  const teamPatterns = [
    /<section[^>]*class="[^"]*team[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
    /<div[^>]*class="[^"]*team[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
  ];
  
  for (const pattern of teamPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const text = match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 20) return text;
    }
  }
  return null;
}

function extractImages(html) {
  const imgMatches = html.match(/<img[^>]+src="([^"]+)"[^>]*>/gi);
  if (!imgMatches) return [];
  
  const images = [];
  for (const match of imgMatches) {
    const srcMatch = match.match(/src="([^"]+)"/);
    if (srcMatch && srcMatch[1]) {
      const src = srcMatch[1];
      // Filter out logos, icons, and small images
      if (src.includes('http') && 
          !src.includes('logo') && 
          !src.includes('icon') && 
          !src.includes('avatar')) {
        images.push(src);
      }
    }
  }
  return images.slice(0, 15); // Limit to 15 images
}

function extractContact(html) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = html.match(emailRegex) || [];
  
  return {
    emails: emails.slice(0, 3) // Limit to 3 emails
  };
}

// Run the scraper
scrapeDesignerWebsite(); 