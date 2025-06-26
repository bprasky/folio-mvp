import { NextRequest, NextResponse } from 'next/server';

// Enhanced function to scrape product data from various sites
async function scrapeProductData(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    
    // Site-specific parsing
    if (hostname.includes('artistictile.com')) {
      return parseArtisticTile(html, url);
    }
    
    // Generic parsing for other sites
    return parseGenericSite(html, url);
    
  } catch (error) {
    console.error('Error scraping product data:', error);
    throw error;
  }
}

// Specific parser for Artistic Tile
function parseArtisticTile(html: string, url: string) {
  // Extract title from h1 or title tag
  const nameMatches = [
    html.match(/<h1[^>]*class="[^"]*"[^>]*>([^<]+)<\/h1>/i),
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i),
    html.match(/<title[^>]*>([^<]+)<\/title>/i)
  ];
  
  let name = 'Artistic Tile Product';
  for (const match of nameMatches) {
    if (match && match[1]) {
      name = match[1].trim().replace(/\s+/g, ' ');
      break;
    }
  }
  
  // Extract price - Artistic Tile uses specific patterns like "$32.00 S/F"
  const pricePatterns = [
    /\$[\d,]+\.?\d*\s*(?:S\/F|per\s+S\/F|square\s+foot)/gi,
    /\$[\d,]+\.?\d*\s*(?:per\s+box|\/box)/gi,
    /\$[\d,]+\.?\d*/g
  ];
  
  let price = '';
  for (const pattern of pricePatterns) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      price = matches[0].trim();
      break;
    }
  }
  
  // Extract description from meta tags or product details
  const description = extractMetaContent(html, 'og:description') || 
                     extractMetaContent(html, 'description') || 
                     extractTextFromSelector(html, '.product-description') ||
                     extractTextFromSelector(html, '.product-details') ||
                     'Premium tile product from Artistic Tile';
  
  // Extract image
  const image = extractMetaContent(html, 'og:image') || 
                extractImageFromSelector(html, '.product-image img') ||
                '';
  
  // Extract specifications
  const dimensions = extractSpecification(html, 'Size') || 
                    extractDimensionsFromText(html) || '';
  
  const materials = extractMaterials(html, name);
  const colors = extractColors(html, name);
  
  // Determine category based on content
  let category = 'Tile';
  if (name.toLowerCase().includes('marble')) category = 'Natural Stone';
  if (name.toLowerCase().includes('porcelain')) category = 'Porcelain';
  if (name.toLowerCase().includes('glass')) category = 'Glass';
  if (name.toLowerCase().includes('mosaic')) category = 'Mosaic';
  
  // Generate tags
  const tags = generateTags(name, description, url);
  
  return {
    name: name.trim(),
    price: price || '$0.00',
    image: image,
    description: description.trim(),
    brand: 'Artistic Tile',
    category: category,
    tags: tags,
    materials: materials,
    dimensions: dimensions,
    colors: colors
  };
}

// Generic parser for other sites
function parseGenericSite(html: string, url: string) {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname.replace('www.', '');
  const brand = hostname.split('.')[0];
  
  // Extract basic product information
  const name = extractMetaContent(html, 'og:title') || 
               extractMetaContent(html, 'twitter:title') || 
               extractTitle(html) || 
               'Untitled Product';
  
  const image = extractMetaContent(html, 'og:image') || 
                extractMetaContent(html, 'twitter:image') || 
                '';
  
  const description = extractMetaContent(html, 'og:description') || 
                     extractMetaContent(html, 'twitter:description') || 
                     extractMetaContent(html, 'description') || 
                     '';
  
  // Enhanced price extraction
  const pricePatterns = [
    /\$[\d,]+\.?\d*\s*(?:each|ea\.?|per\s+piece)/gi,
    /\$[\d,]+\.?\d*\s*(?:S\/F|per\s+S\/F|square\s+foot)/gi,
    /\$[\d,]+\.?\d*/g,
    /price[^>]*>[\s]*\$?[\d,]+\.?\d*/gi,
    /cost[^>]*>[\s]*\$?[\d,]+\.?\d*/gi
  ];
  
  let price = '';
  for (const pattern of pricePatterns) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      price = matches[0].replace(/[^\d.,$\/\s]/g, '').trim();
      if (price && price.includes('$')) {
        break;
      }
    }
  }
  
  // Generate tags and category
  const tags = generateTags(name, description, url);
  const category = determineCategory(tags, name);
  const materials = extractMaterials(html, name);
  
  return {
    name: name.trim(),
    price: price || '$0.00',
    image: image,
    description: description.trim(),
    brand: brand.charAt(0).toUpperCase() + brand.slice(1),
    category: category,
    tags: tags,
    materials: materials,
    dimensions: extractDimensionsFromText(html),
    colors: extractColors(html, name)
  };
}

// Helper functions
function extractMetaContent(html: string, property: string): string {
  const regex = new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
  const match = html.match(regex);
  return match ? match[1] : '';
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1] : '';
}

function extractTextFromSelector(html: string, selector: string): string {
  // Simple text extraction - in production, use a proper HTML parser
  const classMatch = selector.match(/\.([^.\s]+)/);
  if (classMatch) {
    const className = classMatch[1];
    const regex = new RegExp(`class=["'][^"']*${className}[^"']*["'][^>]*>([^<]+)`, 'i');
    const match = html.match(regex);
    return match ? match[1].trim() : '';
  }
  return '';
}

function extractImageFromSelector(html: string, selector: string): string {
  // Extract image src from selector
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const matches = html.match(imgRegex);
  if (matches && matches.length > 0) {
    const srcMatch = matches[0].match(/src=["']([^"']+)["']/);
    return srcMatch ? srcMatch[1] : '';
  }
  return '';
}

function extractSpecification(html: string, specName: string): string {
  const regex = new RegExp(`${specName}[^>]*>([^<]+)`, 'i');
  const match = html.match(regex);
  return match ? match[1].trim() : '';
}

function extractDimensionsFromText(html: string): string {
  // Look for dimension patterns
  const dimensionPatterns = [
    /\d+["']\s*[xX×]\s*\d+["']\s*[xX×]\s*\d+["']/g,
    /\d+["']\s*[xX×]\s*\d+["']/g,
    /\d+\s*[xX×]\s*\d+\s*[xX×]\s*\d+/g,
    /\d+\s*[xX×]\s*\d+/g
  ];
  
  for (const pattern of dimensionPatterns) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      return matches[0];
    }
  }
  return '';
}

function extractMaterials(html: string, name: string): string[] {
  const materials = [];
  const content = (html + ' ' + name).toLowerCase();
  
  const materialKeywords = {
    'marble': 'Marble',
    'granite': 'Granite',
    'porcelain': 'Porcelain',
    'ceramic': 'Ceramic',
    'glass': 'Glass',
    'wood': 'Wood',
    'metal': 'Metal',
    'fabric': 'Fabric',
    'stone': 'Stone',
    'travertine': 'Travertine',
    'limestone': 'Limestone',
    'slate': 'Slate',
    'quartzite': 'Quartzite'
  };
  
  for (const [keyword, material] of Object.entries(materialKeywords)) {
    if (content.includes(keyword)) {
      materials.push(material);
    }
  }
  
  return Array.from(new Set(materials)); // Remove duplicates
}

function extractColors(html: string, name: string): string[] {
  const colors = [];
  const content = (html + ' ' + name).toLowerCase();
  
  const colorKeywords = {
    'white': 'White',
    'black': 'Black',
    'gray': 'Gray',
    'grey': 'Gray',
    'brown': 'Brown',
    'beige': 'Beige',
    'blue': 'Blue',
    'green': 'Green',
    'red': 'Red',
    'yellow': 'Yellow',
    'gold': 'Gold',
    'silver': 'Silver',
    'bronze': 'Bronze',
    'cream': 'Cream',
    'ivory': 'Ivory',
    'tan': 'Tan',
    'charcoal': 'Charcoal'
  };
  
  for (const [keyword, color] of Object.entries(colorKeywords)) {
    if (content.includes(keyword)) {
      colors.push(color);
    }
  }
  
  return Array.from(new Set(colors)); // Remove duplicates
}

function generateTags(name: string, description: string, url: string): string[] {
  const tags = [];
  const content = (name + ' ' + description + ' ' + url).toLowerCase();
  const urlPath = new URL(url).pathname.toLowerCase();
  
  // Product type tags
  const productTypes = {
    'chair': ['chair', 'seating'],
    'sofa': ['sofa', 'seating'],
    'table': ['table', 'furniture'],
    'lamp': ['lamp', 'lighting'],
    'rug': ['rug', 'textile'],
    'bed': ['bed', 'bedroom'],
    'tile': ['tile', 'flooring'],
    'marble': ['marble', 'stone'],
    'mosaic': ['mosaic', 'tile'],
    'backsplash': ['backsplash', 'kitchen'],
    'bathroom': ['bathroom'],
    'kitchen': ['kitchen'],
    'floor': ['flooring'],
    'wall': ['wall']
  };
  
  for (const [keyword, tagList] of Object.entries(productTypes)) {
    if (content.includes(keyword) || urlPath.includes(keyword)) {
      tags.push(...tagList);
    }
  }
  
  return Array.from(new Set(tags)); // Remove duplicates
}

function determineCategory(tags: string[], name: string): string {
  if (tags.some(tag => ['tile', 'marble', 'mosaic'].includes(tag))) {
    return 'Tile & Stone';
  }
  if (tags.some(tag => ['chair', 'sofa', 'table', 'bed'].includes(tag))) {
    return 'Furniture';
  }
  if (tags.includes('lighting')) {
    return 'Lighting';
  }
  if (tags.includes('textile')) {
    return 'Textiles';
  }
  return 'Decor';
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
    
    // For demo purposes, return mock data for some common sites
    if (url.includes('westelm.com') || url.includes('cb2.com') || url.includes('wayfair.com') || 
        url.includes('ikea.com') || url.includes('target.com') || url.includes('amazon.com')) {
      
      const mockData = await generateMockProductData(url);
      return NextResponse.json(mockData);
    }
    
    // For all other URLs including Artistic Tile, try actual scraping
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