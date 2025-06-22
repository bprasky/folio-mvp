import { NextRequest, NextResponse } from 'next/server';

// Mock function to simulate scraping product data
// In a real implementation, you'd use libraries like Puppeteer, Cheerio, or a service like Scrapfly
async function scrapeProductData(url: string) {
  try {
    // For demo purposes, we'll return mock data based on common patterns
    // In production, you'd actually scrape the URL
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Simple HTML parsing (in production, use a proper HTML parser like Cheerio)
    const extractMetaContent = (property: string) => {
      const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
      const match = html.match(regex);
      return match ? match[1] : '';
    };
    
    const extractTitle = () => {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return titleMatch ? titleMatch[1] : '';
    };
    
    // Extract basic product information
    const name = extractMetaContent('og:title') || 
                 extractMetaContent('twitter:title') || 
                 extractTitle() || 
                 'Untitled Product';
    
    const image = extractMetaContent('og:image') || 
                  extractMetaContent('twitter:image') || 
                  '';
    
    const description = extractMetaContent('og:description') || 
                       extractMetaContent('twitter:description') || 
                       extractMetaContent('description') || 
                       '';
    
    // Try to extract price (common patterns)
    const pricePatterns = [
      /\$[\d,]+\.?\d*/g,
      /price[^>]*>[\s]*\$?[\d,]+\.?\d*/gi,
      /cost[^>]*>[\s]*\$?[\d,]+\.?\d*/gi
    ];
    
    let price = '';
    for (const pattern of pricePatterns) {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        // Get the first price match and clean it up
        price = matches[0].replace(/[^\d.,]/g, '');
        if (price) {
          price = '$' + price;
          break;
        }
      }
    }
    
    // Extract brand from URL or title
    const urlParts = new URL(url);
    const hostname = urlParts.hostname.replace('www.', '');
    const brand = hostname.split('.')[0];
    
    // Generate tags based on URL and content
    const tags = [];
    const urlPath = urlParts.pathname.toLowerCase();
    
    // Common furniture/decor categories
    if (urlPath.includes('chair') || name.toLowerCase().includes('chair')) tags.push('chair', 'seating');
    if (urlPath.includes('sofa') || name.toLowerCase().includes('sofa')) tags.push('sofa', 'seating');
    if (urlPath.includes('table') || name.toLowerCase().includes('table')) tags.push('table', 'furniture');
    if (urlPath.includes('lamp') || name.toLowerCase().includes('lamp')) tags.push('lamp', 'lighting');
    if (urlPath.includes('rug') || name.toLowerCase().includes('rug')) tags.push('rug', 'textile');
    if (urlPath.includes('bed') || name.toLowerCase().includes('bed')) tags.push('bed', 'bedroom');
    if (urlPath.includes('decor') || name.toLowerCase().includes('decor')) tags.push('decor');
    
    // Determine category
    let category = '';
    if (tags.some(tag => ['chair', 'sofa', 'table', 'bed'].includes(tag))) {
      category = 'Furniture';
    } else if (tags.includes('lighting')) {
      category = 'Lighting';
    } else if (tags.includes('textile')) {
      category = 'Textiles';
    } else {
      category = 'Decor';
    }
    
    // Mock additional data
    const materials = [];
    if (name.toLowerCase().includes('wood') || description.toLowerCase().includes('wood')) {
      materials.push('Wood');
    }
    if (name.toLowerCase().includes('metal') || description.toLowerCase().includes('metal')) {
      materials.push('Metal');
    }
    if (name.toLowerCase().includes('fabric') || description.toLowerCase().includes('fabric')) {
      materials.push('Fabric');
    }
    
    return {
      name: name.trim(),
      price: price || '$0.00',
      image: image,
      description: description.trim(),
      brand: brand.charAt(0).toUpperCase() + brand.slice(1),
      category: category,
      tags: tags,
      materials: materials,
      dimensions: '', // Would need more sophisticated parsing
      colors: [] // Would need image analysis or specific parsing
    };
    
  } catch (error) {
    console.error('Error scraping product data:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }
    
    // For demo purposes, return mock data for common sites
    // In production, you'd call the actual scraping function
    if (url.includes('westelm.com') || url.includes('cb2.com') || url.includes('wayfair.com') || 
        url.includes('ikea.com') || url.includes('target.com') || url.includes('amazon.com')) {
      
      // Generate mock data based on URL
      const mockData = await generateMockProductData(url);
      return NextResponse.json(mockData);
    }
    
    // For other URLs, try actual scraping (simplified version)
    const productData = await scrapeProductData(url);
    return NextResponse.json(productData);
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape product data. Please check the URL and try again.' },
      { status: 500 }
    );
  }
}

// Mock data generator for demo purposes
async function generateMockProductData(url: string) {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname.replace('www.', '');
  const brand = hostname.split('.')[0];
  
  // Mock product data based on common patterns
  const mockProducts = [
    {
      name: 'Modern Accent Chair',
      price: '$399.00',
      image: 'https://source.unsplash.com/800x600?modern,chair,furniture',
      description: 'A sleek and comfortable accent chair perfect for modern living spaces. Features premium upholstery and solid wood legs.',
      brand: brand.charAt(0).toUpperCase() + brand.slice(1),
      category: 'Furniture',
      tags: ['chair', 'accent', 'modern', 'seating'],
      materials: ['Fabric', 'Wood'],
      dimensions: '28"W x 30"D x 32"H',
      colors: ['Gray', 'Navy', 'Beige']
    },
    {
      name: 'Contemporary Floor Lamp',
      price: '$199.00',
      image: 'https://source.unsplash.com/800x600?floor,lamp,lighting',
      description: 'Elegant floor lamp with adjustable height and warm LED lighting. Perfect for reading nooks and living areas.',
      brand: brand.charAt(0).toUpperCase() + brand.slice(1),
      category: 'Lighting',
      tags: ['lamp', 'floor', 'lighting', 'contemporary'],
      materials: ['Metal', 'Fabric'],
      dimensions: '15"W x 15"D x 58"H',
      colors: ['Black', 'Brass', 'White']
    },
    {
      name: 'Handwoven Area Rug',
      price: '$299.00',
      image: 'https://source.unsplash.com/800x600?area,rug,textile',
      description: 'Beautiful handwoven area rug with geometric patterns. Made from sustainable materials and perfect for any room.',
      brand: brand.charAt(0).toUpperCase() + brand.slice(1),
      category: 'Textiles',
      tags: ['rug', 'handwoven', 'geometric', 'sustainable'],
      materials: ['Wool', 'Cotton'],
      dimensions: '8\' x 10\'',
      colors: ['Multi', 'Blue', 'Neutral']
    }
  ];
  
  // Return a random mock product
  const randomProduct = mockProducts[Math.floor(Math.random() * mockProducts.length)];
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return randomProduct;
} 