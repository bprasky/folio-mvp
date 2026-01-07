/**
 * Generate a single Instagram slide at full resolution (1080x1350)
 * Uses the same rendering pipeline as generateCarouselSlides.ts
 */

import sharp from 'sharp';
import { matchQuotesToImages, extractQuotesWithMetadata } from './matchQuoteToImage';
import { Blocks } from '@/lib/posting/schemas';
import { placeQuoteSmart, formatQuoteText } from './placeQuoteSmart';

interface ImageData {
  id: string;
  url: string;
  name?: string | null;
  room?: string | null;
}

interface QuoteData {
  text: string;
  imageId?: string;
  room?: string;
}

interface ProductData {
  id: string;
  name: string;
  imageUrl?: string | null;
  brand?: string | null;
}

interface SingleSlideInput {
  projectTitle: string;
  images: ImageData[];
  slideIndex: number;
  quotes?: QuoteData[];
  heroImageUrl?: string;
  projectSlug?: string;
  projectId?: string;
  expandedBlocks?: Blocks | null;
  products?: ProductData[]; // For shop-the-look slide
}

const INSTAGRAM_WIDTH = 1080;
const INSTAGRAM_HEIGHT = 1350;
const BACKGROUND_COLOR = '#F9F7F4';
const SERIF_FONT = 'Georgia, &quot;Times New Roman&quot;, serif';
const SANS_FONT = 'Arial, Helvetica, sans-serif';
const TEXT_COLOR = '#1A1A1A'; // Updated to match spec
const RULE_COLOR = '#D8D3CB'; // Updated to match spec
const QUOTE_BG_COLOR = '#FFFAF5'; // Quote overlay background
const BORDER_COLOR = '#E8E4DE'; // Hairline border
const JPG_QUALITY = 90; // Final quality setting

/**
 * Fetch image from URL and convert to buffer
 * Server-side: fetches directly with proper headers to bypass CDN restrictions
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  console.log('[fetchImageBuffer] Attempting to fetch image:', url.substring(0, 100) + '...');
  
  // Check if it's a Facebook CDN URL - these cannot be fetched server-side
  const isFacebookCDN = url.includes('fbcdn.net') || url.includes('facebook.com') || url.includes('scontent-');
  if (isFacebookCDN) {
    console.error('[fetchImageBuffer] Facebook CDN URL detected - cannot fetch server-side:', url);
    throw new Error('Facebook CDN images cannot be fetched server-side. Please re-upload images to Supabase first.');
  }
  
  try {
    // Build headers to mimic a browser request (bypasses most CDN restrictions)
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };

    // Check if it's a Supabase URL
    const isSupabaseUrl = url.includes('supabase.co') || url.includes(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
    if (isSupabaseUrl) {
      console.log('[fetchImageBuffer] Detected Supabase URL');
    }

    // Fetch image directly (server-side, no proxy needed)
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    console.log('[fetchImageBuffer] Response status:', response.status, response.statusText);

    if (!response.ok) {
      // If 403, provide more helpful error message
      if (response.status === 403) {
        console.error('[fetchImageBuffer] 403 Forbidden - image may be on restricted CDN:', url);
        throw new Error('Image access forbidden (403). The image may need to be re-uploaded to Supabase.');
      }
      
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log('[fetchImageBuffer] Successfully fetched image, size:', arrayBuffer.byteLength);
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    // Handle timeout errors
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.error('[fetchImageBuffer] Timeout error:', url);
      throw new Error(`Timeout fetching image from ${url} (30s limit)`);
    }
    
    // Re-throw if it's already our custom error
    if (error.message.includes('Facebook CDN') || error.message.includes('re-uploaded')) {
      throw error;
    }
    
    console.error('[fetchImageBuffer] Error fetching image:', url, error.message);
    throw new Error(`Failed to fetch image from ${url}: ${error.message}`);
  }
}

/**
 * Escape text for SVG
 */
function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Add hairline border to slide (1px border around 1080x1350)
 */
async function addBorder(buffer: Buffer): Promise<Buffer> {
  // Create a border overlay SVG
  const borderSvg = `<svg width="${INSTAGRAM_WIDTH}" height="${INSTAGRAM_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${INSTAGRAM_WIDTH}" height="${INSTAGRAM_HEIGHT}" fill="none" stroke="${BORDER_COLOR}" stroke-width="1"/>
  </svg>`;
  
  return await sharp(buffer)
    .composite([
      {
        input: Buffer.from(borderSvg),
        top: 0,
        left: 0,
      },
    ])
    .toBuffer();
}

/**
 * Create magazine cover slide with hero image
 */
async function createMagazineCoverSlide(
  title: string,
  heroImageUrl: string
): Promise<Buffer> {
  const imageBuffer = await fetchImageBuffer(heroImageUrl);
  
  const backgroundImage = await sharp(imageBuffer)
    .resize(INSTAGRAM_WIDTH, INSTAGRAM_HEIGHT, {
      fit: 'cover',
      position: 'center',
    })
    .toBuffer();

  const titleWords = title.split(' ');
  const titleLine1 = escapeSvgText(titleWords.slice(0, 3).join(' ')) || 'Project';
  const titleLine2 = titleWords.length > 3 ? escapeSvgText(titleWords.slice(3).join(' ')) : '';

  // Build SVG with proper XML structure - updated specs
  let overlaySvg = `<svg width="${INSTAGRAM_WIDTH}" height="${INSTAGRAM_HEIGHT}" xmlns="http://www.w3.org/2000/svg">`;
  overlaySvg += `<defs>`;
  overlaySvg += `<filter id="shadow">`;
  overlaySvg += `<feDropShadow dx="0" dy="6" stdDeviation="30" flood-opacity="0.5"/>`;
  overlaySvg += `</filter>`;
  overlaySvg += `</defs>`;
  // Title: 120-140px, white, top-left (moved to top 15% instead of 10%)
  const titleFontSize = 130; // Middle of 120-140px range
  const titleY = INSTAGRAM_HEIGHT * 0.15; // Top 15% instead of ~10%
  overlaySvg += `<text x="60" y="${titleY}" font-family="${SERIF_FONT}" font-size="${titleFontSize}" font-weight="700" fill="white" filter="url(#shadow)">`;
  overlaySvg += titleLine1;
  overlaySvg += `</text>`;
  if (titleLine2 && titleLine2.trim()) {
    overlaySvg += `<text x="60" y="${titleY + titleFontSize * 1.15}" font-family="${SERIF_FONT}" font-size="${titleFontSize}" font-weight="700" fill="white" filter="url(#shadow)">`;
    overlaySvg += titleLine2;
    overlaySvg += `</text>`;
  }
  // Folio wordmark: 12px gray, 40% opacity, bottom-right
  overlaySvg += `<text x="${INSTAGRAM_WIDTH - 200}" y="${INSTAGRAM_HEIGHT - 60}" font-family="${SERIF_FONT}" font-size="12" font-weight="400" fill="rgba(128,128,128,0.4)" letter-spacing="2">`;
  overlaySvg += `FOLIO`;
  overlaySvg += `</text>`;
  overlaySvg += `</svg>`;

  // Validate SVG structure
  const textOpenCount = (overlaySvg.match(/<text[^>]*>/g) || []).length;
  const textCloseCount = (overlaySvg.match(/<\/text>/g) || []).length;
  if (textOpenCount !== textCloseCount) {
    console.error('[createMagazineCoverSlide] SVG tag mismatch! Open:', textOpenCount, 'Close:', textCloseCount);
    console.error('[createMagazineCoverSlide] Full SVG:', overlaySvg);
    throw new Error(`SVG structure error: ${textOpenCount} opening <text> tags but ${textCloseCount} closing </text> tags`);
  }

  try {
    let result = await sharp(backgroundImage)
      .composite([
        {
          input: Buffer.from(overlaySvg),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: JPG_QUALITY })
      .toBuffer();

    // Add hairline border
    result = await addBorder(result);

    return result;
  } catch (error: any) {
    console.error('[createMagazineCoverSlide] Sharp error. SVG length:', overlaySvg.length);
    console.error('[createMagazineCoverSlide] SVG content:', overlaySvg);
    throw new Error(`Failed to create magazine cover slide: ${error.message}`);
  }
}

/**
 * Create image slide with optional quote overlay
 * Preserves entire image with letterbox, adds 20px safe-zone margin
 */
async function createImageSlideWithQuote(
  imageUrl: string,
  quote?: string
): Promise<Buffer> {
  const imageBuffer = await fetchImageBuffer(imageUrl);
  
  // Resize and letterbox - preserve entire image (no hard crops)
  // Add 20px safe-zone margin
  const safeZone = 20;
  const imageAreaWidth = INSTAGRAM_WIDTH - (safeZone * 2);
  const imageAreaHeight = INSTAGRAM_HEIGHT - (safeZone * 2);
  
  const baseImage = await sharp(imageBuffer)
    .resize(imageAreaWidth, imageAreaHeight, {
      fit: 'contain',
      background: BACKGROUND_COLOR,
    })
    .extend({
      top: safeZone,
      bottom: safeZone,
      left: safeZone,
      right: safeZone,
      background: BACKGROUND_COLOR,
    })
    .toBuffer();

  if (!quote) {
    let result = await sharp(baseImage)
      .jpeg({ quality: JPG_QUALITY })
      .toBuffer();
    result = await addBorder(result);
    return result;
  }

  // AI-powered smart quote placement
  const placement = await placeQuoteSmart(baseImage, quote);
  const { lines, fontSize } = formatQuoteText(quote, INSTAGRAM_WIDTH * 0.85);
  const lineHeight = fontSize * 1.15; // Line-height 1.15

  // Build SVG with proper XML structure - smart placement
  let quoteOverlaySvg = `<svg width="${INSTAGRAM_WIDTH}" height="${INSTAGRAM_HEIGHT}" xmlns="http://www.w3.org/2000/svg">`;
  quoteOverlaySvg += `<defs>`;
  
  // Primary shadow
  quoteOverlaySvg += `<filter id="quoteShadow">`;
  quoteOverlaySvg += `<feDropShadow dx="0" dy="8" stdDeviation="30" flood-opacity="${placement.shadowOpacity}" flood-color="${placement.shadowColor.includes('rgba') ? 'black' : placement.shadowColor}"/>`;
  quoteOverlaySvg += `</filter>`;
  
  // Glow effect for very dark images
  if (placement.glow) {
    quoteOverlaySvg += `<filter id="quoteGlow">`;
    quoteOverlaySvg += `<feGaussianBlur stdDeviation="4" result="coloredBlur"/>`;
    quoteOverlaySvg += `<feMerge>`;
    quoteOverlaySvg += `<feMergeNode in="coloredBlur"/>`;
    quoteOverlaySvg += `<feMergeNode in="SourceGraphic"/>`;
    quoteOverlaySvg += `</feMerge>`;
    quoteOverlaySvg += `</filter>`;
  }
  
  quoteOverlaySvg += `</defs>`;
  
  // Scrim overlay (if needed for fallback)
  if (placement.hasScrim && placement.scrimColor) {
    quoteOverlaySvg += `<rect x="${placement.x - 200}" y="${placement.y - 100}" width="400" height="200" fill="${placement.scrimColor}" rx="8"/>`;
  }
  
  // Warm tint for very light images (8% opacity #F9F7F4)
  if (placement.color === '#1A1A1A') {
    // Very light background detected, add subtle warm tint behind text
    const textWidth = Math.max(...lines.map(l => l.length)) * fontSize * 0.6;
    quoteOverlaySvg += `<rect x="${placement.x - textWidth / 2 - 40}" y="${placement.y - 20}" width="${textWidth + 80}" height="${lines.length * lineHeight + 40}" fill="rgba(249,247,244,0.08)" rx="4"/>`;
  }
  
  // Horizontal rules (if enabled)
  if (placement.rules && placement.rulesColor) {
    const textWidth = Math.max(...lines.map(l => l.length)) * fontSize * 0.6;
    const ruleY1 = placement.y - (lines.length * lineHeight) / 2 - 20;
    const ruleY2 = placement.y + (lines.length * lineHeight) / 2 + 20;
    quoteOverlaySvg += `<line x1="${placement.x - textWidth / 2}" y1="${ruleY1}" x2="${placement.x + textWidth / 2}" y2="${ruleY1}" stroke="${placement.rulesColor}" stroke-width="0.5"/>`;
    quoteOverlaySvg += `<line x1="${placement.x - textWidth / 2}" y1="${ruleY2}" x2="${placement.x + textWidth / 2}" y2="${ruleY2}" stroke="${placement.rulesColor}" stroke-width="0.5"/>`;
  }
  
  // Quote text: smart color, 58-68px italic serif, letter-spacing 1.2px
  const filterId = placement.glow ? 'url(#quoteGlow)' : 'url(#quoteShadow)';
  quoteOverlaySvg += `<text x="${placement.x}" y="${placement.y}" font-family="${SERIF_FONT}" font-size="${fontSize}" font-style="italic" text-anchor="middle" fill="${placement.color}" letter-spacing="1.2" filter="${filterId}" dominant-baseline="middle">`;
  lines.forEach((line, i) => {
    quoteOverlaySvg += `<tspan x="${placement.x}" dy="${i === 0 ? 0 : lineHeight}">${escapeSvgText(line)}</tspan>`;
  });
  quoteOverlaySvg += `</text>`;
  quoteOverlaySvg += `</svg>`;

  // Validate SVG structure
  const textOpenCount = (quoteOverlaySvg.match(/<text[^>]*>/g) || []).length;
  const textCloseCount = (quoteOverlaySvg.match(/<\/text>/g) || []).length;
  if (textOpenCount !== textCloseCount) {
    console.error('[createImageSlideWithQuote] SVG tag mismatch! Open:', textOpenCount, 'Close:', textCloseCount);
    console.error('[createImageSlideWithQuote] Full SVG:', quoteOverlaySvg);
    throw new Error(`SVG structure error: ${textOpenCount} opening <text> tags but ${textCloseCount} closing </text> tags`);
  }

  try {
    let result = await sharp(baseImage)
      .composite([
        {
          input: Buffer.from(quoteOverlaySvg),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: JPG_QUALITY })
      .toBuffer();

    // Add hairline border
    result = await addBorder(result);

    return result;
  } catch (error: any) {
    console.error('[createImageSlideWithQuote] Sharp error. SVG length:', quoteOverlaySvg.length);
    console.error('[createImageSlideWithQuote] SVG content:', quoteOverlaySvg);
    throw new Error(`Failed to create image slide with quote: ${error.message}`);
  }
}

/**
 * Create shop-the-look grid slide (3×3 or 2×4 grid of product thumbnails)
 */
async function createShopTheLookSlide(products: ProductData[]): Promise<Buffer> {
  // Determine grid layout: 3×3 for 7-9 products, 2×4 for 7-8 products
  const displayProducts = products.slice(0, 9);
  let cols: number;
  let rows: number;
  
  if (displayProducts.length <= 6) {
    cols = 3;
    rows = 2;
  } else if (displayProducts.length <= 8) {
    cols = 4;
    rows = 2;
  } else {
    cols = 3;
    rows = 3;
  }
  
  const gutter = 24; // 24px gutter
  const thumbnailSize = 240;
  const gridWidth = (cols * thumbnailSize) + ((cols - 1) * gutter);
  const gridHeight = (rows * thumbnailSize) + ((rows - 1) * gutter);
  const gridStartX = (INSTAGRAM_WIDTH - gridWidth) / 2;
  const gridStartY = 500; // Position grid in center area

  // Build SVG
  let svg = `<svg width="${INSTAGRAM_WIDTH}" height="${INSTAGRAM_HEIGHT}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="${INSTAGRAM_WIDTH}" height="${INSTAGRAM_HEIGHT}" fill="${BACKGROUND_COLOR}"/>`;
  
  // Center overlay text: "Shop every piece — link in bio" in large serif (80px)
  svg += `<text x="${INSTAGRAM_WIDTH / 2}" y="320" font-family="${SERIF_FONT}" font-size="80" font-weight="600" text-anchor="middle" fill="${TEXT_COLOR}" dominant-baseline="middle">`;
  svg += `Shop every piece — link in bio`;
  svg += `</text>`;

  // Product grid
  displayProducts.forEach((product, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = gridStartX + (col * (thumbnailSize + gutter));
    const y = gridStartY + (row * (thumbnailSize + gutter));

    // Product thumbnail: subtle 1px #E8E4DE border + 4px corner radius
    svg += `<rect x="${x}" y="${y}" width="${thumbnailSize}" height="${thumbnailSize}" fill="#E8E4DE" rx="4" stroke="${BORDER_COLOR}" stroke-width="1"/>`;
    
    // Product image placeholder (would fetch actual image in production)
    // For now, just the bordered rectangle
  });

  // Bottom-right tiny "Folio" wordmark (same as cover slide)
  svg += `<text x="${INSTAGRAM_WIDTH - 200}" y="${INSTAGRAM_HEIGHT - 60}" font-family="${SERIF_FONT}" font-size="12" font-weight="400" fill="rgba(128,128,128,0.4)" letter-spacing="2">`;
  svg += `FOLIO`;
  svg += `</text>`;

  svg += `</svg>`;

  let result = await sharp(Buffer.from(svg))
    .jpeg({ quality: JPG_QUALITY })
    .toBuffer();

  // Add hairline border
  result = await addBorder(result);

  return result;
}

/**
 * Create CTA slide
 */
async function createCTASlide(
  projectTitle: string,
  projectSlug?: string,
  projectId?: string
): Promise<Buffer> {
  const shortlink = projectSlug 
    ? `folio.com/p/${projectSlug}` 
    : projectId 
    ? `link.bio/folio/${projectId.substring(0, 8)}`
    : 'link.bio/folio';

  let qrCodeSvg = '';
  try {
    const QRCode = require('qrcode');
    const qrDataUrl = await QRCode.toDataURL(`https://${shortlink}`, {
      width: 180, // Slightly smaller
      margin: 1,
      color: {
        dark: TEXT_COLOR,
        light: BACKGROUND_COLOR,
      },
    });
    const qrBase64 = qrDataUrl.split(',')[1];
    // Tiny QR bottom-right (only if space)
    qrCodeSvg = `<image href="data:image/png;base64,${qrBase64}" x="${INSTAGRAM_WIDTH - 200}" y="${INSTAGRAM_HEIGHT - 200}" width="180" height="180"/>`;
  } catch (error) {
    // QR code generation failed, skip it
    console.warn('[createCTASlide] QR code generation failed:', error);
  }

  // Build SVG with proper XML structure - updated specs
  let svg = `<svg width="${INSTAGRAM_WIDTH}" height="${INSTAGRAM_HEIGHT}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="${INSTAGRAM_WIDTH}" height="${INSTAGRAM_HEIGHT}" fill="${BACKGROUND_COLOR}"/>`;
  // Center: "Explore the full feature on Folio" in large serif
  svg += `<text x="${INSTAGRAM_WIDTH / 2}" y="${INSTAGRAM_HEIGHT / 2 - 60}" font-family="${SERIF_FONT}" font-size="64" font-weight="600" text-anchor="middle" fill="${TEXT_COLOR}" dominant-baseline="middle">`;
  svg += `Explore the full feature`;
  svg += `</text>`;
  svg += `<text x="${INSTAGRAM_WIDTH / 2}" y="${INSTAGRAM_HEIGHT / 2 + 20}" font-family="${SERIF_FONT}" font-size="64" font-weight="600" text-anchor="middle" fill="${TEXT_COLOR}" dominant-baseline="middle">`;
  svg += `on Folio`;
  svg += `</text>`;
  // Below: shortlink in medium gray
  svg += `<text x="${INSTAGRAM_WIDTH / 2}" y="${INSTAGRAM_HEIGHT / 2 + 100}" font-family="${SANS_FONT}" font-size="36" font-weight="400" text-anchor="middle" fill="#666" dominant-baseline="middle">`;
  svg += escapeSvgText(shortlink);
  svg += `</text>`;
  // Folio wordmark bottom-left (same style as cover)
  svg += `<text x="60" y="${INSTAGRAM_HEIGHT - 60}" font-family="${SERIF_FONT}" font-size="12" font-weight="400" fill="rgba(128,128,128,0.4)" letter-spacing="2">`;
  svg += `FOLIO`;
  svg += `</text>`;
  if (qrCodeSvg) {
    svg += qrCodeSvg;
  }
  svg += `</svg>`;

  // Validate SVG structure
  const textOpenCount = (svg.match(/<text[^>]*>/g) || []).length;
  const textCloseCount = (svg.match(/<\/text>/g) || []).length;
  if (textOpenCount !== textCloseCount) {
    console.error('[createCTASlide] SVG tag mismatch! Open:', textOpenCount, 'Close:', textCloseCount);
    console.error('[createCTASlide] Full SVG:', svg);
    throw new Error(`SVG structure error: ${textOpenCount} opening <text> tags but ${textCloseCount} closing </text> tags`);
  }

  try {
    let result = await sharp(Buffer.from(svg))
      .jpeg({ quality: JPG_QUALITY })
      .toBuffer();

    // Add hairline border
    result = await addBorder(result);

    return result;
  } catch (error: any) {
    console.error('[createCTASlide] Sharp error. SVG length:', svg.length);
    console.error('[createCTASlide] SVG content:', svg);
    throw new Error(`Failed to create CTA slide: ${error.message}`);
  }
}

/**
 * Generate a single slide at the specified index
 */
export async function generateSingleSlide(input: SingleSlideInput): Promise<Buffer> {
  const { projectTitle, images, slideIndex, heroImageUrl, projectSlug, projectId, expandedBlocks } = input;

  if (images.length === 0) {
    throw new Error('No images available for carousel');
  }

  // Extract and match quotes to images
  let quoteMatches = new Map<string, string>();
  if (expandedBlocks) {
    const quotesWithMetadata = extractQuotesWithMetadata(expandedBlocks);
    quoteMatches = matchQuotesToImages(quotesWithMetadata, images);
  } else if (input.quotes) {
    const quotesWithMetadata = input.quotes.map(q => ({ 
      text: typeof q === 'string' ? q : q.text,
      imageId: typeof q === 'object' ? q.imageId : undefined,
      room: typeof q === 'object' ? q.room : undefined,
    }));
    quoteMatches = matchQuotesToImages(quotesWithMetadata, images);
  }

  // Build slides array to determine which slide to generate
  // 0 = hero, 1-N = images, possibly shop slide after 5-6, N+1 = CTA
  let totalSlides = 1 + images.length + 1; // hero + images + CTA
  const hasShopSlide = input.products && input.products.length >= 4;
  if (hasShopSlide) {
    totalSlides += 1; // Add shop slide
  }

  if (slideIndex < 0 || slideIndex >= totalSlides) {
    throw new Error(`Slide index ${slideIndex} is out of range (0-${totalSlides - 1})`);
  }

  // Generate the requested slide
  if (slideIndex === 0) {
    // Hero slide
    const heroImage = heroImageUrl 
      ? images.find(img => img.url === heroImageUrl) || images[0]
      : images[0];
    try {
      return await createMagazineCoverSlide(projectTitle, heroImage.url);
    } catch (error: any) {
      // If image fetch fails, create a fallback slide
      if (error.message.includes('Failed to fetch image') || error.message.includes('403')) {
        console.warn(`[generateSingleSlide] Hero image fetch failed, using fallback for slide ${slideIndex}`);
        return await createFallbackSlide(projectTitle, 'Hero image unavailable');
      }
      throw error;
    }
  } else if (slideIndex === totalSlides - 1) {
    // CTA slide
    return await createCTASlide(projectTitle, projectSlug, projectId);
  } else {
    // Check if this is the shop slide
    let imageSlideCount = 0;
    let currentIndex = 1; // Start after hero
    
    for (let i = 0; i < images.length; i++) {
      if (currentIndex === slideIndex) {
        // This is an image slide
        const image = images[i];
        const quote = quoteMatches.get(image.id);
        try {
          return await createImageSlideWithQuote(image.url, quote);
        } catch (error: any) {
          if (error.message.includes('Failed to fetch image') || error.message.includes('403')) {
            console.warn(`[generateSingleSlide] Image fetch failed for slide ${slideIndex}, using fallback`);
            return await createFallbackSlide(projectTitle, `Image ${i + 1} unavailable`);
          }
          throw error;
        }
      }
      currentIndex++;
      imageSlideCount++;
      
      // Check if shop slide should be inserted after slide 5 or 6
      if (hasShopSlide && (imageSlideCount === 5 || imageSlideCount === 6)) {
        if (currentIndex === slideIndex) {
          // This is the shop slide
          return await createShopTheLookSlide(input.products!);
        }
        currentIndex++;
      }
    }
    
    throw new Error(`Slide index ${slideIndex} not found`);
  }
}

/**
 * Create a fallback slide when image fetch fails
 */
async function createFallbackSlide(title: string, message: string): Promise<Buffer> {
  let svg = `<svg width="${INSTAGRAM_WIDTH}" height="${INSTAGRAM_HEIGHT}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="${INSTAGRAM_WIDTH}" height="${INSTAGRAM_HEIGHT}" fill="${BACKGROUND_COLOR}"/>`;  
  svg += `<text x="${INSTAGRAM_WIDTH / 2}" y="${INSTAGRAM_HEIGHT / 2 - 40}" font-family="${SERIF_FONT}" font-size="48" font-weight="600" text-anchor="middle" fill="${TEXT_COLOR}" dominant-baseline="middle">`;       
  svg += escapeSvgText(title);
  svg += `</text>`;
  svg += `<text x="${INSTAGRAM_WIDTH / 2}" y="${INSTAGRAM_HEIGHT / 2 + 40}" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#999" dominant-baseline="middle">`;
  svg += escapeSvgText(message);
  svg += `</text>`;
  svg += `</svg>`;

  let result = await sharp(Buffer.from(svg))
    .jpeg({ quality: JPG_QUALITY })
    .toBuffer();

  // Add hairline border
  result = await addBorder(result);

  return result;
}

