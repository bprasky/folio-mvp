const axios = require('axios');

// Your Browserless token
const BROWSERLESS_TOKEN = '2Sbq0KFBxBlYj237333ef79801d3b6ec95e752a02d26dd3ae';

// Test URLs for different types of designer websites
const testUrls = [
  'https://www.studiodesigncollective.com',
  'https://www.houzz.com/professionals/interior-designers-and-decorators',
  'https://www.architecturaldigest.com/story/best-interior-designers',
  'https://www.dezeen.com/interiors/'
];

async function testBrowserlessScraping() {
  console.log('🧪 Testing Browserless Scraper with /content endpoint\n');
  
  for (const url of testUrls) {
    console.log(`\n🔍 Testing URL: ${url}`);
    
    try {
      // Use the working /content endpoint
      const response = await axios.post(
        `https://production-sfo.browserless.io/content?token=${BROWSERLESS_TOKEN}`,
        { 
          url: url,
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

      const html = response.data;
      console.log(`✅ Successfully fetched HTML (${html.length} characters)`);
      
      // Test our parsing functions
      const scrapedData = parseHtmlContent(html, url);
      
      console.log(`📊 Results:`);
      console.log(`   - Title: ${scrapedData.companyName || 'Not found'}`);
      console.log(`   - About: ${scrapedData.about ? `${scrapedData.about.substring(0, 100)}...` : 'Not found'}`);
      console.log(`   - Projects: ${scrapedData.projects?.length || 0}`);
      console.log(`   - Team: ${scrapedData.team?.length || 0}`);
      console.log(`   - Contact: ${scrapedData.contactInfo?.email || 'Not found'}`);
      console.log(`   - Services: ${scrapedData.services?.join(', ') || 'None'}`);
      console.log(`   - Specialties: ${scrapedData.specialties?.join(', ') || 'None'}`);
      
    } catch (error) {
      console.error(`❌ Error scraping ${url}:`, error.response?.data || error.message);
    }
  }
}

// Helper function to parse HTML content (same as in the main scraper)
function parseHtmlContent(html, url) {
  const results = {
    about: extractAbout(html),
    team: extractTeam(html),
    projects: extractProjects(html),
    logo: extractLogo(html),
    companyName: extractCompanyName(html),
    contactInfo: extractContactInfo(html),
    services: extractServices(html),
    specialties: extractSpecialties(html)
  };

  return results;
}

// Helper functions to extract data from HTML
function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

function extractAbout(html) {
  const aboutPatterns = [
    /<section[^>]*class="[^"]*about[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
    /<div[^>]*class="[^"]*about[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<section[^>]*id="about"[^>]*>([\s\S]*?)<\/section>/gi,
    /<div[^>]*id="about"[^>]*>([\s\S]*?)<\/div>/gi,
    /<article[^>]*class="[^"]*about[^"]*"[^>]*>([\s\S]*?)<\/article>/gi
  ];
  
  for (const pattern of aboutPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const text = match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 50) return text;
    }
  }
  return undefined;
}

function extractTeam(html) {
  const teamPatterns = [
    /<section[^>]*class="[^"]*team[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
    /<div[^>]*class="[^"]*team[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<section[^>]*class="[^"]*staff[^"]*"[^>]*>([\s\S]*?)<\/section>/gi
  ];
  
  for (const pattern of teamPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const teamSection = match[1];
      const members = [];
      
      const memberMatches = teamSection.match(/<div[^>]*class="[^"]*(?:member|person|staff)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
      if (memberMatches) {
        for (const memberMatch of memberMatches) {
          const nameMatch = memberMatch.match(/<h[3-6][^>]*>([^<]+)<\/h[3-6]>/i);
          const roleMatch = memberMatch.match(/<p[^>]*class="[^"]*role[^"]*"[^>]*>([^<]+)<\/p>/i);
          const imageMatch = memberMatch.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
          
          if (nameMatch) {
            members.push({
              name: nameMatch[1].trim(),
              role: roleMatch ? roleMatch[1].trim() : '',
              image: imageMatch ? imageMatch[1] : undefined
            });
          }
        }
      }
      
      if (members.length > 0) return members;
    }
  }
  return undefined;
}

function extractProjects(html) {
  const portfolioPatterns = [
    /<section[^>]*class="[^"]*portfolio[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
    /<div[^>]*class="[^"]*portfolio[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<section[^>]*class="[^"]*projects[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
    /<div[^>]*class="[^"]*projects[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<section[^>]*class="[^"]*work[^"]*"[^>]*>([\s\S]*?)<\/section>/gi
  ];
  
  for (const pattern of portfolioPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const portfolioSection = match[1];
      const projects = [];
      
      const projectMatches = portfolioSection.match(/<div[^>]*class="[^"]*(?:project|portfolio-item|work-item)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
      if (projectMatches) {
        for (const projectMatch of projectMatches) {
          const titleMatch = projectMatch.match(/<h[3-6][^>]*>([^<]+)<\/h[3-6]>/i);
          const descMatch = projectMatch.match(/<p[^>]*>([^<]+)<\/p>/i);
          const images = extractImagesFromHtml(projectMatch);
          
          if (titleMatch || images.length > 0) {
            projects.push({
              title: titleMatch ? titleMatch[1].trim() : 'Project',
              description: descMatch ? descMatch[1].trim() : '',
              images: images,
              category: 'portfolio'
            });
          }
        }
      }
      
      if (projects.length > 0) return projects;
    }
  }
  
  const allImages = extractImagesFromHtml(html);
  if (allImages.length > 0) {
    return [{
      title: 'Portfolio Images',
      description: 'Images from your website',
      category: 'portfolio',
      images: allImages.slice(0, 15)
    }];
  }
  
  return undefined;
}

function extractImagesFromHtml(html) {
  const imgMatches = html.match(/<img[^>]+src="([^"]+)"[^>]*>/gi);
  if (!imgMatches) return [];
  
  const images = [];
  for (const match of imgMatches) {
    const srcMatch = match.match(/src="([^"]+)"/);
    if (srcMatch && srcMatch[1]) {
      const src = srcMatch[1];
      if (src.includes('http') && 
          !src.includes('logo') && 
          !src.includes('icon') && 
          !src.includes('avatar') &&
          !src.includes('menu') &&
          !src.includes('nav')) {
        images.push(src);
      }
    }
  }
  return images;
}

function extractLogo(html) {
  const logoPatterns = [
    /<img[^>]+class="[^"]*logo[^"]*"[^>]+src="([^"]+)"/gi,
    /<img[^>]+src="([^"]*logo[^"]*)"[^>]+class="[^"]*logo[^"]*"/gi
  ];
  
  for (const pattern of logoPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return undefined;
}

function extractCompanyName(html) {
  const title = extractTitle(html);
  if (title) {
    return title.replace(/^\s*Home\s*[-|]\s*/i, '').replace(/\s*[-|]\s*Home\s*$/i, '').trim();
  }
  return undefined;
}

function extractContactInfo(html) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = html.match(emailRegex) || [];
  
  const socialMedia = {};
  
  const instagramMatch = html.match(/<a[^>]+href="([^"]*instagram[^"]*)"[^>]*>/gi);
  const linkedinMatch = html.match(/<a[^>]+href="([^"]*linkedin[^"]*)"[^>]*>/gi);
  const facebookMatch = html.match(/<a[^>]+href="([^"]*facebook[^"]*)"[^>]*>/gi);
  const twitterMatch = html.match(/<a[^>]+href="([^"]*twitter[^"]*)"[^>]*>/gi);
  
  if (instagramMatch) socialMedia.instagram = instagramMatch[0].match(/href="([^"]+)"/)?.[1];
  if (linkedinMatch) socialMedia.linkedin = linkedinMatch[0].match(/href="([^"]+)"/)?.[1];
  if (facebookMatch) socialMedia.facebook = facebookMatch[0].match(/href="([^"]+)"/)?.[1];
  if (twitterMatch) socialMedia.twitter = twitterMatch[0].match(/href="([^"]+)"/)?.[1];
  
  return {
    email: emails[0],
    socialMedia: Object.keys(socialMedia).length > 0 ? socialMedia : undefined
  };
}

function extractServices(html) {
  const serviceKeywords = ['residential', 'commercial', 'kitchen', 'bathroom', 'living room', 'bedroom', 'office', 'renovation', 'new construction', 'interior design', 'decorating'];
  const pageText = html.replace(/<[^>]*>/g, ' ').toLowerCase();
  const services = [];
  
  for (const keyword of serviceKeywords) {
    if (pageText.includes(keyword)) {
      services.push(keyword);
    }
  }
  
  return services.length > 0 ? services : undefined;
}

function extractSpecialties(html) {
  const specialtyKeywords = ['modern', 'traditional', 'contemporary', 'minimalist', 'luxury', 'sustainable', 'eco-friendly', 'smart home', 'scandinavian', 'industrial', 'bohemian'];
  const pageText = html.replace(/<[^>]*>/g, ' ').toLowerCase();
  const specialties = [];
  
  for (const keyword of specialtyKeywords) {
    if (pageText.includes(keyword)) {
      specialties.push(keyword);
    }
  }
  
  return specialties.length > 0 ? specialties : undefined;
}

// Run the test
testBrowserlessScraping().catch(console.error); 