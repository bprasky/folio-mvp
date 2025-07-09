import axios from 'axios';

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || '2Sbq0KFBxBlYj237333ef79801d3b6ec95e752a02d26dd3ae';

interface DesignerProfileScrape {
  about?: string;
  team?: Array<{ name: string; role: string; image?: string }>;
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
}

export async function scrapeDesignerProfile(url: string): Promise<DesignerProfileScrape> {
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
    
    const scraped: DesignerProfileScrape = {};
    // Extract company name from title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      scraped.companyName = titleMatch[1].trim();
    }
    // Extract about/description
    const aboutPatterns = [
      /<meta[^>]*name="description"[^>]*content="([^"]+)"/i,
      /<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i,
      /<div[^>]*class="[^"]*about[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<section[^>]*class="[^"]*about[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
      /<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/i
    ];
    for (const pattern of aboutPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const aboutText = match[1].replace(/<[^>]*>/g, '').trim();
        if (aboutText.length > 20) {
          scraped.about = aboutText;
          break;
        }
      }
    }
    // Extract team
    const teamMembers: Array<{ name: string; role: string; image?: string }> = [];
    const teamPatterns = [
      /<div[^>]*class="[^"]*team[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<section[^>]*class="[^"]*team[^"]*"[^>]*>([\s\S]*?)<\/section>/i
    ];
    for (const pattern of teamPatterns) {
      const match = html.match(pattern);
      if (match) {
        const teamSection = match[1];
        const nameMatches = teamSection.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi);
        const roleMatches = teamSection.match(/<p[^>]*>([^<]+)<\/p>/gi);
        const imageMatches = teamSection.match(/<img[^>]*src="([^"]*)"[^>]*>/gi);
        if (nameMatches) {
          nameMatches.forEach((nameMatch, index) => {
            const name = nameMatch.replace(/<[^>]*>/g, '').trim();
            const role = roleMatches && roleMatches[index] 
              ? roleMatches[index].replace(/<[^>]*>/g, '').trim()
              : 'Team Member';
            const image = imageMatches && imageMatches[index]
              ? imageMatches[index].match(/src="([^"]*)"/)[1]
              : undefined;
            if (name && name.length > 0) {
              teamMembers.push({ name, role, image });
            }
          });
        }
      }
    }
    if (teamMembers.length > 0) {
      scraped.team = teamMembers;
    }
    // Extract contact info
    const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    const phoneMatches = html.match(/\+?\d[\d\s().-]{7,}\d/g);
    // Social links
    const socialMedia: any = {};
    const instagramMatch = html.match(/<a[^>]+href="([^"]*instagram[^"#]*)"[^>]*>/i);
    const linkedinMatch = html.match(/<a[^>]+href="([^"]*linkedin[^"#]*)"[^>]*>/i);
    const facebookMatch = html.match(/<a[^>]+href="([^"]*facebook[^"#]*)"[^>]*>/i);
    const twitterMatch = html.match(/<a[^>]+href="([^"]*twitter[^"#]*)"[^>]*>/i);
    if (instagramMatch) socialMedia.instagram = instagramMatch[1];
    if (linkedinMatch) socialMedia.linkedin = linkedinMatch[1];
    if (facebookMatch) socialMedia.facebook = facebookMatch[1];
    if (twitterMatch) socialMedia.twitter = twitterMatch[1];
    scraped.contactInfo = {
      email: emailMatches ? emailMatches[0] : undefined,
      phone: phoneMatches ? phoneMatches[0] : undefined,
      socialMedia: Object.keys(socialMedia).length > 0 ? socialMedia : undefined
    };
    // Extract logo (favicon or logo image)
    const faviconMatch = html.match(/<link[^>]*rel="(?:shortcut )?icon"[^>]*href="([^"]+)"[^>]*>/i);
    const logoImgMatch = html.match(/<img[^>]*class="[^"]*logo[^"]*"[^>]*src="([^"]+)"[^>]*>/i);
    if (logoImgMatch) {
      scraped.logo = logoImgMatch[1];
    } else if (faviconMatch) {
      scraped.logo = faviconMatch[1];
    }
    console.log('📝 Scraped profile:', scraped);
    return scraped;
  } catch (error) {
    console.error('❌ Browserless scraping error:', error);
    return { about: "We couldn't automatically import your profile information. You can add it manually after signup." };
  }
} 