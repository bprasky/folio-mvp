const axios = require('axios');

// Test the enhanced signup flow
async function testEnhancedSignup() {
  console.log('🧪 Testing Enhanced Designer Signup Flow...\n');

  const testCases = [
    {
      name: 'Basic Signup Data',
      data: {
        email: 'test@designer.com',
        password: 'password123',
        website: 'https://www.studiolife.com',
        eventId: 'nycxdesign-2025',
        acceptTerms: true
      }
    },
    {
      name: 'Website Scraping',
      data: {
        url: 'https://www.studiolife.com',
        eventId: 'nycxdesign-2025'
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.name}`);
    
    try {
      if (testCase.name === 'Website Scraping') {
        // Test the scraping endpoint
        const response = await axios.post('http://localhost:3000/api/scrape-website', testCase.data);
        console.log('✅ Scraping successful');
        console.log('📊 Scraped data preview:', {
          about: response.data.about?.substring(0, 100) + '...',
          teamCount: response.data.team?.length || 0,
          projectsCount: response.data.projects?.length || 0,
          hasLogo: !!response.data.logo
        });
      } else {
        // Test the signup endpoint
        const response = await axios.post('http://localhost:3000/api/auth/signup/designer', testCase.data);
        console.log('✅ Signup successful');
        console.log('👤 User created:', response.data.userId);
      }
    } catch (error) {
      console.log('❌ Test failed:', error.response?.data?.message || error.message);
    }
    
    console.log('');
  }

  console.log('🎯 Test URLs to try:');
  console.log('   • http://localhost:3000/test-scraper');
  console.log('   • http://localhost:3000/signup/designer/enhanced');
  console.log('   • http://localhost:3000/signup/designer/enhanced?event=nycxdesign-2025');
  
  console.log('\n📝 Instructions:');
  console.log('   1. Visit the test page to try different website URLs');
  console.log('   2. Use the enhanced signup flow to see the scraping in action');
  console.log('   3. Check the browser console for any errors');
  console.log('   4. Verify that scraped data appears in the preview section');
}

// Run the test
testEnhancedSignup().catch(console.error); 