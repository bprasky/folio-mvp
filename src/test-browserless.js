const axios = require('axios');

// Updated for paid version
const token = "2Sbq0KFBxBlYj237333ef79801d3b6ec95e752a02d26dd3ae";

// Test 1: Simple object return
async function test1() {
  try {
    const response = await axios.post(
      `https://production-sfo.browserless.io/function?token=${token}`,
      {
        code: `
          module.exports = async function() {
            return { message: "Hello World", timestamp: Date.now() };
          }
        `
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );
    console.log('✅ Test 1 SUCCESS:', response.data);
  } catch (error) {
    console.log('❌ Test 1 ERROR:', error.response?.data || error.message);
  }
}

// Test 2: Enhanced browser automation with paid features
async function test2() {
  try {
    const response = await axios.post(
      `https://production-sfo.browserless.io/function?token=${token}`,
      {
        code: `
          module.exports = async function(browser) {
            const page = await browser.newPage();
            
            // Enhanced viewport for paid version
            await page.setViewport({ width: 1920, height: 1080 });
            
            // Enhanced user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            await page.goto('https://example.com', { waitUntil: 'networkidle2' });
            const title = await page.title();
            
            // Enhanced screenshot capability
            const screenshot = await page.screenshot({ 
              type: 'jpeg', 
              quality: 80,
              fullPage: false 
            });
            
            return { 
              title, 
              url: page.url(),
              screenshot: screenshot.toString('base64').substring(0, 100) + '...',
              viewport: { width: 1920, height: 1080 }
            };
          }
        `
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 45000
      }
    );
    console.log('✅ Test 2 SUCCESS:', response.data);
  } catch (error) {
    console.log('❌ Test 2 ERROR:', error.response?.data || error.message);
  }
}

// Test 3: Enhanced scraping with paid features
async function test3() {
  try {
    const response = await axios.post(
      `https://production-sfo.browserless.io/function?token=${token}`,
      {
        code: `
          module.exports = async function(browser) {
            const page = await browser.newPage();
            
            // Enhanced settings for paid version
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            await page.goto('https://www.heidicaillierdesign.com/', { 
              waitUntil: 'networkidle2',
              timeout: 45000 
            });
            await page.waitForTimeout(3000);
            
            const result = await page.evaluate(() => {
              const title = document.title;
              const h1 = document.querySelector('h1')?.textContent || '';
              
              // Enhanced image extraction
              const images = Array.from(document.querySelectorAll('img'))
                .filter(img => 
                  img.src && 
                  img.src.includes('http') &&
                  !img.src.includes('logo') &&
                  !img.src.includes('icon') &&
                  img.width > 200 && 
                  img.height > 200
                )
                .slice(0, 10)
                .map(img => ({
                  src: img.src,
                  alt: img.alt || '',
                  width: img.width,
                  height: img.height
                }));
              
              // Enhanced text extraction
              const aboutSections = document.querySelectorAll('section.about, #about, .about, [class*="bio"]');
              const about = Array.from(aboutSections)
                .map(section => section.textContent.trim())
                .filter(text => text.length > 50)
                .join(' ');
              
              // Enhanced contact extraction
              const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
              const phoneRegex = /(\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})/g;
              
              const pageText = document.body.textContent;
              const emails = pageText.match(emailRegex) || [];
              const phones = pageText.match(phoneRegex) || [];
              
              return { 
                title, 
                h1, 
                images,
                about: about.substring(0, 500),
                contact: {
                  emails: emails.slice(0, 3),
                  phones: phones.slice(0, 3)
                },
                meta: {
                  description: document.querySelector('meta[name="description"]')?.content || '',
                  keywords: document.querySelector('meta[name="keywords"]')?.content || ''
                }
              };
            });
            
            return result;
          }
        `
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 90000
      }
    );
    console.log('✅ Test 3 SUCCESS:', response.data);
  } catch (error) {
    console.log('❌ Test 3 ERROR:', error.response?.data || error.message);
  }
}

// Test 4: New test for advanced features
async function test4() {
  try {
    const response = await axios.post(
      `https://production-sfo.browserless.io/function?token=${token}`,
      {
        code: `
          module.exports = async function(browser) {
            const page = await browser.newPage();
            
            // Test advanced features
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Test PDF generation (paid feature)
            await page.goto('https://example.com', { waitUntil: 'networkidle2' });
            const pdf = await page.pdf({ 
              format: 'A4',
              printBackground: true
            });
            
            // Test performance metrics
            const metrics = await page.metrics();
            
            return {
              pdfSize: pdf.length,
              metrics: {
                Timestamp: metrics.Timestamp,
                Documents: metrics.Documents,
                Frames: metrics.Frames,
                JSEventListeners: metrics.JSEventListeners,
                Nodes: metrics.Nodes,
                LayoutCount: metrics.LayoutCount,
                RecalcStyleCount: metrics.RecalcStyleCount,
                LayoutDuration: metrics.LayoutDuration,
                RecalcStyleDuration: metrics.RecalcStyleDuration,
                ScriptDuration: metrics.ScriptDuration,
                TaskDuration: metrics.TaskDuration
              }
            };
          }
        `
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      }
    );
    console.log('✅ Test 4 SUCCESS:', response.data);
  } catch (error) {
    console.log('❌ Test 4 ERROR:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🧪 Testing Browserless Paid Version API...');
  console.log(`🔑 Token: ${token.substring(0, 10)}...`);
  console.log('');
  
  await test1();
  console.log('');
  await test2();
  console.log('');
  await test3();
  console.log('');
  await test4();
}

runTests(); 