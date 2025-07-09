// Test the Browserless-powered website scraper for designer onboarding (Paid Version)
// Use this static example URL: https://www.heidicaillierdesign.com/
// Log the full response object from the API and print:
// - about section
// - number of images found
// - team section text
// - contact information
// - services and specialties

const BROWSERLESS_TOKEN = '2Sbq0KFBxBlYj237333ef79801d3b6ec95e752a02d26dd3ae';

async function testScraper() {
  const testUrl = 'https://www.heidicaillierdesign.com/';
  
  console.log('🧪 Testing website scraper (Paid Version)...');
  console.log(`📍 Target URL: ${testUrl}`);
  console.log(`🔑 Using paid token: ${BROWSERLESS_TOKEN.substring(0, 10)}...`);
  
  try {
    // Test the API endpoint
    const response = await fetch('http://localhost:3000/api/scrape-website', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: testUrl,
        eventId: null
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('\n📊 ENHANCED SCRAPING RESULTS (Paid Version):');
    console.log('===========================================');
    
    // About section
    console.log(`\n📝 About Section:`);
    if (data.about) {
      console.log(`Length: ${data.about.length} characters`);
      console.log(`Preview: ${data.about.substring(0, 200)}...`);
    } else {
      console.log('❌ No about section found');
    }
    
    // Team section
    console.log(`\n👥 Team Section:`);
    if (data.team && data.team.length > 0) {
      console.log(`Found ${data.team.length} team members:`);
      data.team.forEach((member, index) => {
        console.log(`  ${index + 1}. ${member.name} - ${member.role}`);
        if (member.image) {
          console.log(`     Image: ${member.image}`);
        }
      });
    } else {
      console.log('❌ No team members found');
    }
    
    // Projects/Images
    console.log(`\n🖼️ Projects/Images:`);
    if (data.projects && data.projects.length > 0) {
      console.log(`Found ${data.projects.length} projects:`);
      data.projects.forEach((project, index) => {
        console.log(`  ${index + 1}. ${project.title}`);
        console.log(`     Description: ${project.description}`);
        console.log(`     Images: ${project.images.length}`);
        console.log(`     Category: ${project.category}`);
      });
      
      // Total images
      const totalImages = data.projects.reduce((sum, project) => sum + project.images.length, 0);
      console.log(`\n📸 Total images found: ${totalImages}`);
    } else {
      console.log('❌ No projects/images found');
    }
    
    // Company info
    console.log(`\n🏢 Company Info:`);
    if (data.companyName) {
      console.log(`Company: ${data.companyName}`);
    } else {
      console.log('❌ No company name found');
    }
    
    if (data.logo) {
      console.log(`Logo: ${data.logo}`);
    } else {
      console.log('❌ No logo found');
    }
    
    // Contact information (new paid feature)
    console.log(`\n📧 Contact Information:`);
    if (data.contactInfo) {
      if (data.contactInfo.email) {
        console.log(`Email: ${data.contactInfo.email}`);
      }
      if (data.contactInfo.phone) {
        console.log(`Phone: ${data.contactInfo.phone}`);
      }
      if (data.contactInfo.address) {
        console.log(`Address: ${data.contactInfo.address}`);
      }
      if (data.contactInfo.socialMedia) {
        console.log(`Social Media:`);
        Object.entries(data.contactInfo.socialMedia).forEach(([platform, url]) => {
          if (url) console.log(`  ${platform}: ${url}`);
        });
      }
    } else {
      console.log('❌ No contact information found');
    }
    
    // Services (new paid feature)
    console.log(`\n🛠️ Services:`);
    if (data.services && data.services.length > 0) {
      console.log(`Found ${data.services.length} services:`);
      data.services.forEach((service, index) => {
        console.log(`  ${index + 1}. ${service}`);
      });
    } else {
      console.log('❌ No services identified');
    }
    
    // Specialties (new paid feature)
    console.log(`\n🎯 Specialties:`);
    if (data.specialties && data.specialties.length > 0) {
      console.log(`Found ${data.specialties.length} specialties:`);
      data.specialties.forEach((specialty, index) => {
        console.log(`  ${index + 1}. ${specialty}`);
      });
    } else {
      console.log('❌ No specialties identified');
    }
    
    console.log('\n✅ Enhanced scraping test completed successfully!');
    console.log('🚀 Paid version features: Contact info, Services, Specialties, Enhanced image extraction');
    
  } catch (error) {
    console.error('❌ Scraping test failed:', error.message);
    
    if (error.message.includes('401')) {
      console.error('🔑 API Key Error: Check your Browserless paid token');
    } else if (error.message.includes('timeout')) {
      console.error('⏰ Timeout Error: Website took too long to load');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('🌐 Connection Error: Make sure the server is running on localhost:3000');
    }
  }
}

// Run the test
testScraper(); 