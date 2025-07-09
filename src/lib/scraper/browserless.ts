import axios from 'axios';

// Updated for paid version
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || '2Sbq0KFBxBlYj237333ef79801d3b6ec95e752a02d26dd3ae';

interface ScrapedData {
  about?: string;
  team?: Array<{ name: string; role: string; image?: string }>;
  projects?: Array<{
    title: string;
    description: string;
    images: string[];
    category?: string;
  }>;
  logo?: string;
  companyName?: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
    socialMedia?: {
      instagram?: string;
      linkedin?: string;
      facebook?: string;
      twitter?: string;
    };
  };
  services?: string[];
  specialties?: string[];
}

export async function scrapeDesignerWebsite(url: string): Promise<ScrapedData> {
  try {
    console.log(`🔄 Attempting to scrape: ${url}`);
    console.log(`🔑 Using token: ${BROWSERLESS_TOKEN.substring(0, 10)}...`);
    
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
        timeout: 90000, // 90 second timeout
      }
    );

    console.log(`✅ Scraping successful for: ${url}`);
    const html = response.data;

    // Parse the HTML content using helper functions
    const scrapedData = parseHtmlContent(html, url);

    console.log(`📊 Found ${scrapedData.projects?.length || 0} projects`);
    console.log(`👥 Found ${scrapedData.team?.length || 0} team members`);
    console.log(`📝 About section length: ${scrapedData.about?.length || 0} characters`);
    console.log(`📧 Contact info: ${scrapedData.contactInfo ? 'Found' : 'Not found'}`);
    console.log(`🛠️ Services: ${scrapedData.services?.length || 0} identified`);
    console.log(`🎯 Specialties: ${scrapedData.specialties?.length || 0} identified`);

    return scrapedData;

  } catch (error: any) {
    console.error('❌ Browserless scraping error:', error.response?.data || error.message);
    
    // Return fallback data if scraping fails
    return {
      about: "We couldn't automatically import your profile information. You can add it manually after signup.",
      projects: [{
        title: 'Your Portfolio',
        description: 'Add your projects and images after signup',
        category: 'portfolio',
        images: []
      }],
      contactInfo: {
        email: undefined,
        phone: undefined,
        socialMedia: {}
      },
      services: [],
      specialties: []
    };
  }
}

// Helper function to parse HTML content
function parseHtmlContent(html: string, url: string): ScrapedData {
  const results: ScrapedData = {
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
function extractTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

function extractAbout(html: string): string | undefined {
  // Look for about sections
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

function extractTeam(html: string): Array<{ name: string; role: string; image?: string }> | undefined {
  // Look for team sections
  const teamPatterns = [
    /<section[^>]*class="[^"]*team[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
    /<div[^>]*class="[^"]*team[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<section[^>]*class="[^"]*staff[^"]*"[^>]*>([\s\S]*?)<\/section>/gi
  ];
  
  for (const pattern of teamPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const teamSection = match[1];
      const members: Array<{ name: string; role: string; image?: string }> = [];
      
      // Extract team members
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

function extractProjects(html: string): Array<{ title: string; description: string; images: string[]; category?: string }> | undefined {
  // Look for portfolio/project sections
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
      const projects: Array<{ title: string; description: string; images: string[]; category?: string }> = [];
      
      // Extract project items
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
  
  // If no structured projects found, create a general portfolio from images
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

function extractImagesFromHtml(html: string): string[] {
  const imgMatches = html.match(/<img[^>]+src="([^"]+)"[^>]*>/gi);
  if (!imgMatches) return [];
  
  const images: string[] = [];
  for (const match of imgMatches) {
    const srcMatch = match.match(/src="([^"]+)"/);
    if (srcMatch && srcMatch[1]) {
      const src = srcMatch[1];
      // Filter out logos, icons, and small images
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

function extractLogo(html: string): string | undefined {
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

function extractCompanyName(html: string): string | undefined {
  const title = extractTitle(html);
  if (title) {
    // Clean up common title patterns
    return title.replace(/^\s*Home\s*[-|]\s*/i, '').replace(/\s*[-|]\s*Home\s*$/i, '').trim();
  }
  return undefined;
}

function extractContactInfo(html: string): { email?: string; phone?: string; address?: string; socialMedia?: { instagram?: string; linkedin?: string; facebook?: string; twitter?: string } } | undefined {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = html.match(emailRegex) || [];
  
  const socialMedia: { instagram?: string; linkedin?: string; facebook?: string; twitter?: string } = {};
  
  // Extract social media links
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

function extractServices(html: string): string[] | undefined {
  const serviceKeywords = ['residential', 'commercial', 'kitchen', 'bathroom', 'living room', 'bedroom', 'office', 'renovation', 'new construction', 'interior design', 'decorating'];
  const pageText = html.replace(/<[^>]*>/g, ' ').toLowerCase();
  const services: string[] = [];
  
  for (const keyword of serviceKeywords) {
    if (pageText.includes(keyword)) {
      services.push(keyword);
    }
  }
  
  return services.length > 0 ? services : undefined;
}

function extractSpecialties(html: string): string[] | undefined {
  const specialtyKeywords = ['modern', 'traditional', 'contemporary', 'minimalist', 'luxury', 'sustainable', 'eco-friendly', 'smart home', 'scandinavian', 'industrial', 'bohemian'];
  const pageText = html.replace(/<[^>]*>/g, ' ').toLowerCase();
  const specialties: string[] = [];
  
  for (const keyword of specialtyKeywords) {
    if (pageText.includes(keyword)) {
      specialties.push(keyword);
    }
  }
  
  return specialties.length > 0 ? specialties : undefined;
}

// Enhanced fallback function for paid version
export async function scrapeDesignerProfile(url: string): Promise<ScrapedData> {
  try {
    // Ensure the URL has a protocol
    let fixedUrl = url.trim();
    if (!/^https?:\/\//i.test(fixedUrl)) {
      fixedUrl = 'https://' + fixedUrl;
    }
    console.log(`🔄 Attempting to scrape: ${fixedUrl}`);
    console.log(`🔑 Using token: ${BROWSERLESS_TOKEN.substring(0, 10)}...`);
    
    // Use the working /content endpoint
    const response = await axios.post(
      `https://production-sfo.browserless.io/content?token=${BROWSERLESS_TOKEN}`,
      { 
        url: fixedUrl,
        gotoOptions: {
          waitUntil: 'networkidle2',
          timeout: 45000
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 90000, // 90 second timeout
      }
    );

    const html = response.data;
    console.log(`✅ Scraping successful for: ${fixedUrl}`);
    
    // Parse the HTML content using helper functions
    const scrapedData = parseHtmlContent(html, fixedUrl);

    // Return only profile data (no projects)
    return {
      about: scrapedData.about,
      team: scrapedData.team,
      logo: scrapedData.logo,
      companyName: scrapedData.companyName,
      contactInfo: scrapedData.contactInfo,
      services: scrapedData.services,
      specialties: scrapedData.specialties
      // Note: projects is intentionally omitted for profile-only scraping
    };

  } catch (error) {
    console.error('❌ Browserless scraping error:', error);
    return { 
      about: "We couldn't automatically import your profile information. You can add it manually after signup.",
      contactInfo: {
        email: undefined,
        phone: undefined,
        socialMedia: {}
      }
    };
  }
}

export async function mockScrapeDesignerWebsite(url: string): Promise<ScrapedData> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));

  return {
    about: "We are a boutique design studio specializing in residential and commercial interiors. Our approach combines timeless aesthetics with modern functionality, creating spaces that inspire and endure.",
    team: [
      { name: "Sarah Johnson", role: "Principal Designer", image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face" },
      { name: "Michael Chen", role: "Senior Designer", image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face" },
      { name: "Emily Rodriguez", role: "Project Manager", image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face" }
    ],
    projects: [
      {
        title: "Modern Manhattan Apartment",
        description: "A complete renovation of a 2,500 sq ft apartment featuring open-concept living, custom millwork, and a sophisticated color palette.",
        images: [
          "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop",
          "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400&h=300&fit=crop",
          "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400&h=300&fit=crop"
        ],
        category: "Residential"
      },
      {
        title: "Downtown Office Renovation",
        description: "A contemporary office space designed for collaboration and productivity, featuring flexible work areas and modern amenities.",
        images: [
          "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop",
          "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&h=300&fit=crop"
        ],
        category: "Commercial"
      }
    ],
    logo: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200&h=200&fit=crop",
    companyName: "Studio Design Collective",
    contactInfo: {
      email: "hello@studiodesigncollective.com",
      phone: "+1 (555) 123-4567",
      socialMedia: {
        instagram: "https://instagram.com/studiodesigncollective",
        linkedin: "https://linkedin.com/company/studiodesigncollective"
      }
    },
    services: ["residential", "commercial", "kitchen", "bathroom", "renovation"],
    specialties: ["modern", "contemporary", "luxury", "sustainable"]
  };
} 