import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Enhanced scraper for Material Bank and other vendor pages
async function scrapeVendorProducts(vendorUrl: string, vendorName: string) {
  try {
    const response = await fetch(vendorUrl, {
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
    const urlObj = new URL(vendorUrl);
    const hostname = urlObj.hostname.replace('www.', '');
    
    // Material Bank specific scraping
    if (hostname.includes('materialbank.com')) {
      return parseMaterialBank(html, vendorUrl, vendorName);
    }
    
    // Generic vendor page parsing
    return parseGenericVendorPage(html, vendorUrl, vendorName);
    
  } catch (error) {
    console.error('Error scraping vendor products:', error);
    throw error;
  }
}

// Material Bank specific parser
function parseMaterialBank(html: string, vendorUrl: string, vendorName: string) {
  const products = [];
  
  // Look for product grid containers
  const productSelectors = [
    '.product-grid .product-item',
    '.products-grid .product',
    '.product-list .product',
    '[data-product]',
    '.mb-product-card'
  ];
  
  // Extract product information using various patterns
  const productMatches = html.match(/<div[^>]*class="[^"]*(?:product|item)[^"]*"[^>]*>[\s\S]*?<\/div>/gi) || [];
  
  for (let i = 0; i < Math.min(productMatches.length, 20); i++) {
    const productHtml = productMatches[i];
    
    // Extract product name
    const nameMatches = [
      productHtml.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i),
      productHtml.match(/<a[^>]*class="[^"]*product-name[^"]*"[^>]*>([^<]+)<\/a>/i),
      productHtml.match(/title="([^"]+)"/i)
    ];
    
    let name = `${vendorName} Product ${i + 1}`;
    for (const match of nameMatches) {
      if (match && match[1]) {
        name = match[1].trim().replace(/\s+/g, ' ');
        break;
      }
    }
    
    // Extract product image
    const imageMatches = [
      productHtml.match(/<img[^>]*src="([^"]+)"/i),
      productHtml.match(/<img[^>]*data-src="([^"]+)"/i),
      productHtml.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/i)
    ];
    
    let imageUrl = '';
    for (const match of imageMatches) {
      if (match && match[1]) {
        imageUrl = match[1].startsWith('http') ? match[1] : `https://materialbank.com${match[1]}`;
        break;
      }
    }
    
    // Extract product URL
    const urlMatches = [
      productHtml.match(/<a[^>]*href="([^"]+)"[^>]*>/i),
      productHtml.match(/href="([^"]*product[^"]*)"/i)
    ];
    
    let productUrl = '';
    for (const match of urlMatches) {
      if (match && match[1]) {
        productUrl = match[1].startsWith('http') ? match[1] : `https://materialbank.com${match[1]}`;
        break;
      }
    }
    
    // Extract description
    const descMatches = [
      productHtml.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)<\/p>/i),
      productHtml.match(/<div[^>]*class="[^"]*desc[^"]*"[^>]*>([^<]+)<\/div>/i)
    ];
    
    let description = '';
    for (const match of descMatches) {
      if (match && match[1]) {
        description = match[1].trim();
        break;
      }
    }
    
    // Determine category based on content
    let category = 'General';
    const lowerName = name.toLowerCase();
    if (lowerName.includes('tile') || lowerName.includes('ceramic')) category = 'Tile';
    if (lowerName.includes('marble') || lowerName.includes('stone')) category = 'Natural Stone';
    if (lowerName.includes('lighting') || lowerName.includes('lamp')) category = 'Lighting';
    if (lowerName.includes('fabric') || lowerName.includes('textile')) category = 'Textiles';
    if (lowerName.includes('paint') || lowerName.includes('color')) category = 'Paint';
    if (lowerName.includes('hardware') || lowerName.includes('fixture')) category = 'Hardware';
    
    products.push({
      name: name.trim(),
      description: description || `Premium ${category.toLowerCase()} from ${vendorName}`,
      imageUrl: imageUrl,
      productUrl: productUrl,
      category: category,
      brand: vendorName,
      materialBankSource: true
    });
  }
  
  return products;
}

// Generic vendor page parser
function parseGenericVendorPage(html: string, vendorUrl: string, vendorName: string) {
  const products = [];
  
  // Look for common product patterns
  const productPatterns = [
    /<div[^>]*class="[^"]*(?:product|item|card)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<article[^>]*>[\s\S]*?<\/article>/gi,
    /<li[^>]*class="[^"]*(?:product|item)[^"]*"[^>]*>[\s\S]*?<\/li>/gi
  ];
  
  let productMatches = [];
  for (const pattern of productPatterns) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      productMatches = matches;
      break;
    }
  }
  
  for (let i = 0; i < Math.min(productMatches.length, 15); i++) {
    const productHtml = productMatches[i];
    
    // Extract product name
    const nameMatches = [
      productHtml.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i),
      productHtml.match(/<a[^>]*>([^<]+)<\/a>/i),
      productHtml.match(/title="([^"]+)"/i)
    ];
    
    let name = `${vendorName} Product ${i + 1}`;
    for (const match of nameMatches) {
      if (match && match[1]) {
        name = match[1].trim().replace(/\s+/g, ' ');
        break;
      }
    }
    
    // Extract product image
    const imageMatches = [
      productHtml.match(/<img[^>]*src="([^"]+)"/i),
      productHtml.match(/<img[^>]*data-src="([^"]+)"/i)
    ];
    
    let imageUrl = '';
    for (const match of imageMatches) {
      if (match && match[1]) {
        imageUrl = match[1].startsWith('http') ? match[1] : `${vendorUrl}${match[1]}`;
        break;
      }
    }
    
    // Extract product URL
    const urlMatches = [
      productHtml.match(/<a[^>]*href="([^"]+)"[^>]*>/i)
    ];
    
    let productUrl = '';
    for (const match of urlMatches) {
      if (match && match[1]) {
        productUrl = match[1].startsWith('http') ? match[1] : `${vendorUrl}${match[1]}`;
        break;
      }
    }
    
    // Determine category
    let category = 'General';
    const lowerName = name.toLowerCase();
    if (lowerName.includes('tile') || lowerName.includes('ceramic')) category = 'Tile';
    if (lowerName.includes('marble') || lowerName.includes('stone')) category = 'Natural Stone';
    if (lowerName.includes('lighting') || lowerName.includes('lamp')) category = 'Lighting';
    if (lowerName.includes('fabric') || lowerName.includes('textile')) category = 'Textiles';
    if (lowerName.includes('paint') || lowerName.includes('color')) category = 'Paint';
    if (lowerName.includes('hardware') || lowerName.includes('fixture')) category = 'Hardware';
    
    products.push({
      name: name.trim(),
      description: `Premium ${category.toLowerCase()} from ${vendorName}`,
      imageUrl: imageUrl,
      productUrl: productUrl,
      category: category,
      brand: vendorName,
      materialBankSource: false
    });
  }
  
  return products;
}

// Scrape individual product URL
async function scrapeIndividualProduct(productUrl: string, vendorName: string) {
  try {
    const response = await fetch(productUrl, {
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
    
    // Extract product information
    const name = extractMetaContent(html, 'og:title') || 
                 extractMetaContent(html, 'twitter:title') || 
                 extractTitle(html) || 
                 `${vendorName} Product`;
    
    const imageUrl = extractMetaContent(html, 'og:image') || 
                     extractMetaContent(html, 'twitter:image') || 
                     '';
    
    const description = extractMetaContent(html, 'og:description') || 
                       extractMetaContent(html, 'twitter:description') || 
                       extractMetaContent(html, 'description') || 
                       `Premium product from ${vendorName}`;
    
    // Extract price
    const pricePatterns = [
      /\$[\d,]+\.?\d*\s*(?:each|ea\.?|per\s+piece)/gi,
      /\$[\d,]+\.?\d*\s*(?:S\/F|per\s+S\/F|square\s+foot)/gi,
      /\$[\d,]+\.?\d*/g
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
    
    // Determine category
    let category = 'General';
    const lowerName = name.toLowerCase();
    if (lowerName.includes('tile') || lowerName.includes('ceramic')) category = 'Tile';
    if (lowerName.includes('marble') || lowerName.includes('stone')) category = 'Natural Stone';
    if (lowerName.includes('lighting') || lowerName.includes('lamp')) category = 'Lighting';
    if (lowerName.includes('fabric') || lowerName.includes('textile')) category = 'Textiles';
    if (lowerName.includes('paint') || lowerName.includes('color')) category = 'Paint';
    if (lowerName.includes('hardware') || lowerName.includes('fixture')) category = 'Hardware';
    
    return {
      name: name.trim(),
      description: description.trim(),
      imageUrl: imageUrl,
      productUrl: productUrl,
      category: category,
      brand: vendorName,
      price: price || null,
      materialBankSource: false
    };
    
  } catch (error) {
    console.error('Error scraping individual product:', error);
    throw error;
  }
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      vendorName, 
      vendorUrl, 
      vendorDescription, 
      logoUrl, 
      scrapedProducts, 
      manualProductUrls 
    } = body;

    // Create vendor user
    const vendor = await prisma.user.create({
      data: {
        name: vendorName,
        profileType: 'vendor',
        companyName: vendorName,
        bio: vendorDescription,
        profileImage: logoUrl,
        website: vendorUrl
      }
    });

    const createdProducts = [];

    // Process scraped products
    if (scrapedProducts && scrapedProducts.length > 0) {
      for (const product of scrapedProducts) {
        const createdProduct = await prisma.product.create({
          data: {
            name: product.name,
            description: product.description,
            imageUrl: product.imageUrl,
            url: product.productUrl,
            category: product.category,
            brand: product.brand,
            vendorId: vendor.id
          }
        });
        createdProducts.push(createdProduct);
      }
    }

    // Process manual product URLs
    if (manualProductUrls && manualProductUrls.length > 0) {
      for (const productUrl of manualProductUrls) {
        try {
          const scrapedProduct = await scrapeIndividualProduct(productUrl, vendorName);
          
          const createdProduct = await prisma.product.create({
            data: {
              name: scrapedProduct.name,
              description: scrapedProduct.description,
              imageUrl: scrapedProduct.imageUrl,
              url: scrapedProduct.productUrl,
              category: scrapedProduct.category,
              brand: scrapedProduct.brand,
              price: scrapedProduct.price,
              vendorId: vendor.id
            }
          });
          createdProducts.push(createdProduct);
        } catch (error) {
          console.error(`Failed to scrape product URL: ${productUrl}`, error);
          // Continue with other products even if one fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      vendor: {
        id: vendor.id,
        name: vendor.name,
        companyName: vendor.companyName,
        description: vendor.bio,
        logoUrl: vendor.profileImage,
        website: vendor.website
      },
      products: createdProducts,
      totalProducts: createdProducts.length
    });

  } catch (error) {
    console.error('Error in vendor onboarding:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create vendor and products' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vendorUrl = searchParams.get('vendorUrl');
    const vendorName = searchParams.get('vendorName');

    if (!vendorUrl || !vendorName) {
      return NextResponse.json(
        { success: false, error: 'vendorUrl and vendorName are required' },
        { status: 400 }
      );
    }

    // Scrape vendor products
    const scrapedProducts = await scrapeVendorProducts(vendorUrl, vendorName);

    return NextResponse.json({
      success: true,
      products: scrapedProducts,
      totalProducts: scrapedProducts.length
    });

  } catch (error) {
    console.error('Error scraping vendor products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to scrape vendor products' },
      { status: 500 }
    );
  }
} 