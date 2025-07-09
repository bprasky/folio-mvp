// Verify that the Browserless scraper is fully working for onboarding designer profiles
// Use the function endpoint with this test site: https://www.heidicaillierdesign.com
// Log and return the following:
// - API connectivity status
// - Any HTTP errors (403, 401, 500)
// - Parsed output from:
//    - About text
//    - Team section text
//    - Portfolio or project images (src URLs)
// Use this Browserless token: 2Sbq0KFBxBlYj23409d3d7c721ceb7abdfcdba6f978b2bf41

import axios from 'axios';

const BROWSERLESS_TOKEN = '2Sbq0KFBxBlYj237333ef79801d3b6ec95e752a02d26dd3ae';

async function testBrowserlessOnboarding() {
  console.log('🧪 Testing Browserless Scraper for Designer Onboarding');
  console.log('=====================================================');
  console.log(`🔑 Token: ${BROWSERLESS_TOKEN.substring(0, 10)}...`);
  console.log(`🌐 Target URL: https://www.heidicaillierdesign.com`);
  console.log('');

  const script = `
    const page = await browser.newPage();
    
    // Enhanced settings for better scraping
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
      await page.goto('https://www.heidicaillierdesign.com', { 
        waitUntil: 'networkidle2', 
        timeout: 45000 
      });
      
      // Wait for dynamic content
      await page.waitForTimeout(3000);

      const result = await page.evaluate(() => {
        // Enhanced about text extraction
        const aboutSelectors = [
          'section.about', '#about', '.about', '[class*="bio"]', '[class*="about"]',
          'section[class*="about"]', 'div[class*="about"]', 'article[class*="about"]',
          '.mission', '.philosophy', '.story', '[class*="mission"]', '[class*="philosophy"]'
        ];
        
        let about = '';
        for (const selector of aboutSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim().length > 50) {
            about = element.textContent.trim();
            break;
          }
        }

        // Enhanced team section extraction
        const teamSelectors = [
          'section[class*="team"]', '.team', '[class*="team"]',
          'section:has-text("team")', 'div:has-text("team")',
          '.staff', '.crew', '.people', '[class*="staff"]'
        ];
        
        let team = '';
        for (const selector of teamSelectors) {
          const teamSection = document.querySelector(selector);
          if (teamSection) {
            team = teamSection.textContent.trim();
            break;
          }
        }

        // Enhanced image extraction
        const images = Array.from(document.querySelectorAll('img'))
          .filter(img => 
            img.src && 
            img.src.includes('http') &&
            !img.src.includes('logo') &&
            !img.src.includes('icon') &&
            !img.src.includes('avatar') &&
            img.width > 200 && 
            img.height > 200
          )
          .map(img => ({
            src: img.src,
            alt: img.alt || '',
            width: img.width,
            height: img.height
          }));

        // Extract company name
        const companySelectors = [
          '.logo', '.brand', '.company-name', 'h1', '.site-title',
          'header h1', 'nav .logo', '[class*="logo"]', '.studio-name',
          'title'
        ];
        
        let companyName = '';
        for (const selector of companySelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            companyName = element.textContent.trim();
            break;
          }
        }

        // Extract contact information
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        
        const pageText = document.body.textContent;
        const emails = pageText.match(emailRegex) || [];

        return { 
          about, 
          team, 
          companyName,
          images,
          contact: {
            emails: emails.slice(0, 3)
          },
          pageTitle: document.title,
          url: window.location.href
        };
      });

      return {
        success: true,
        data: result
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
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
        timeout: 90000, // 90 second timeout
      }
    );

    console.log('✅ API Connectivity Status: SUCCESS');
    console.log('✅ HTTP Status: 200 OK');
    console.log('');

    if (response.data.success) {
      const data = response.data.data;
      
      console.log('📊 PARSED OUTPUT:');
      console.log('================');
      
      // About text
      console.log('\n📝 About Text:');
      if (data.about) {
        console.log(`Length: ${data.about.length} characters`);
        console.log(`Preview: ${data.about.substring(0, 300)}...`);
      } else {
        console.log('⚠️ No about text found');
      }
      
      // Team section
      console.log('\n👥 Team Section:');
      if (data.team) {
        console.log(`Length: ${data.team.length} characters`);
        console.log(`Preview: ${data.team.substring(0, 300)}...`);
      } else {
        console.log('⚠️ No team section found');
      }
      
      // Company name
      console.log('\n🏢 Company Name:');
      if (data.companyName) {
        console.log(data.companyName);
      } else {
        console.log('⚠️ No company name found');
      }
      
      // Images
      console.log('\n🖼️ Portfolio/Project Images:');
      if (data.images && data.images.length > 0) {
        console.log(`Total images found: ${data.images.length}`);
        console.log('Sample image URLs:');
        data.images.slice(0, 5).forEach((img, index) => {
          console.log(`  ${index + 1}. ${img.src}`);
          console.log(`     Alt: ${img.alt}`);
          console.log(`     Size: ${img.width}x${img.height}`);
        });
      } else {
        console.log('⚠️ No portfolio images found');
      }
      
      // Contact information
      console.log('\n📧 Contact Information:');
      if (data.contact.emails.length > 0) {
        console.log('Emails found:');
        data.contact.emails.forEach((email, index) => {
          console.log(`  ${index + 1}. ${email}`);
        });
      } else {
        console.log('⚠️ No emails found');
      }
      
      // Page info
      console.log('\n📄 Page Information:');
      console.log(`Title: ${data.pageTitle}`);
      console.log(`URL: ${data.url}`);
      
      console.log('\n✅ SCRAPING COMPLETED SUCCESSFULLY!');
      console.log('🚀 Ready for designer onboarding automation');
      
      return {
        success: true,
        data: data
      };
      
    } else {
      console.log('❌ Scraping failed:', response.data.error);
      return {
        success: false,
        reason: 'Scraping failed',
        error: response.data.error
      };
    }

  } catch (err) {
    console.log('❌ API Connectivity Status: FAILED');
    
    if (err.response) {
      console.error('❌ HTTP Error:', err.response.status);
      console.error('❌ Error Details:', err.response.data);
      
      if (err.response.status === 401) {
        console.error('🔑 Authentication Error: Invalid or expired token');
      } else if (err.response.status === 403) {
        console.error('🚫 Authorization Error: Insufficient permissions');
      } else if (err.response.status === 500) {
        console.error('⚡ Server Error: Browserless service issue');
      } else if (err.response.status === 429) {
        console.error('⏰ Rate Limit Error: Too many requests');
      }
      
      return {
        success: false,
        reason: `HTTP ${err.response.status}`,
        error: err.response.data
      };
      
    } else if (err.request) {
      console.error('❌ Network Error: No response received');
      console.error('❌ Request Details:', err.request);
      
      return {
        success: false,
        reason: 'Network error',
        error: 'No response received from Browserless'
      };
      
    } else {
      console.error('❌ Unexpected Error:', err.message);
      
      return {
        success: false,
        reason: 'Unexpected error',
        error: err.message
      };
    }
  }
}

// Run the test
testBrowserlessOnboarding().then(result => {
  console.log('\n📋 TEST SUMMARY:');
  console.log('================');
  console.log(`Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  if (!result.success) {
    console.log(`Reason: ${result.reason}`);
  }
}); 