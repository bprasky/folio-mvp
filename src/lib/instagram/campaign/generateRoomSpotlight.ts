/**
 * Generate room spotlight carousel (3-7 slides per room)
 * Slide 1: Room name overlay on wide shot
 * Slides 2-N: Additional angles and details
 * Final slide: CTA to Folio
 */

import sharp from 'sharp';

export type RoomSpotlightFormat = 'square' | 'portrait' | 'story';

interface RoomSpotlightInput {
  roomName: string;
  projectTitle: string;
  designerName: string;
  projectSlug: string;
  imageUrls: string[]; // 3-7 images for this room
  format: RoomSpotlightFormat;
  seriesInfo?: {
    current: number;
    total: number;
  };
}

const FORMATS = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

const BACKGROUND_COLOR = '#F9F7F4';
const BORDER_COLOR = '#E8E4DE';
const TEXT_COLOR = '#1A1A1A';
const JPG_QUALITY = 90;

/**
 * Fetch image from URL
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  try {
    const isExternal =
      !url.includes(process.env.NEXT_PUBLIC_SUPABASE_URL || '') &&
      !url.startsWith('/') &&
      (url.startsWith('http://') || url.startsWith('https://'));

    if (isExternal) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const proxyUrl = `${baseUrl}/api/instagram/proxy-image?url=${encodeURIComponent(url)}`;

      const response = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Proxy failed: ${response.statusText}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } else {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Folio-Instagram-Export/1.0' },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      return Buffer.from(await response.arrayBuffer());
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error(`Timeout fetching image`);
    }
    throw error;
  }
}

/**
 * Generate title slide (first slide with room name overlay)
 */
async function generateTitleSlide(
  imageUrl: string,
  roomName: string,
  projectTitle: string,
  designerName: string,
  dimensions: { width: number; height: number },
  seriesInfo?: { current: number; total: number }
): Promise<Buffer> {
  const imageBuffer = await fetchImageBuffer(imageUrl);
  const baseImage = sharp(imageBuffer).resize(dimensions.width, dimensions.height, {
    fit: 'cover',
    position: 'center',
  });

  // Gradient overlay for text legibility
  const gradientHeight = Math.floor(dimensions.height * 0.5);
  const gradientSvg = `
    <svg width="${dimensions.width}" height="${dimensions.height}">
      <defs>
        <linearGradient id="grad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" style="stop-color:rgba(0,0,0,0.75);stop-opacity:1" />
          <stop offset="50%" style="stop-color:rgba(0,0,0,0.3);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${dimensions.width}" height="${gradientHeight}" y="${dimensions.height - gradientHeight}" fill="url(#grad)" />
    </svg>
  `;

  const padding = 60;
  const bottomY = dimensions.height - padding;

  // Text overlay
  const textSvg = `
    <svg width="${dimensions.width}" height="${dimensions.height}">
      <!-- Room Name (large) -->
      <text
        x="${padding}"
        y="${bottomY - 90}"
        font-family="Georgia, serif"
        font-size="64"
        font-weight="400"
        fill="#FFFFFF"
        letter-spacing="-0.01em"
        style="text-shadow: 0 4px 20px rgba(0,0,0,0.4);"
      >
        ${escapeXml(roomName)}
      </text>

      <!-- Project Title -->
      <text
        x="${padding}"
        y="${bottomY - 48}"
        font-family="Arial, sans-serif"
        font-size="28"
        font-weight="400"
        fill="rgba(255,255,255,0.9)"
        letter-spacing="0.01em"
      >
        ${escapeXml(projectTitle)}
      </text>

      <!-- Designer Name -->
      <text
        x="${padding}"
        y="${bottomY - 18}"
        font-family="Arial, sans-serif"
        font-size="24"
        font-weight="300"
        fill="rgba(255,255,255,0.85)"
        letter-spacing="0.02em"
      >
        ${escapeXml(designerName)}
      </text>

      ${
        seriesInfo
          ? `
      <!-- Series Indicator -->
      <text
        x="${padding}"
        y="${bottomY + 12}"
        font-family="Arial, sans-serif"
        font-size="20"
        font-weight="300"
        fill="rgba(255,255,255,0.7)"
        letter-spacing="0.02em"
      >
        • ${seriesInfo.current} of ${seriesInfo.total}
      </text>
      `
          : ''
      }

      <!-- Folio Mark -->
      <text
        x="${dimensions.width - padding}"
        y="${bottomY}"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-size="18"
        font-weight="300"
        fill="rgba(255,255,255,0.6)"
        letter-spacing="0.1em"
      >
        FOLIO
      </text>
    </svg>
  `;

  // Composite
  const composite = await sharp(await baseImage.toBuffer())
    .composite([
      { input: Buffer.from(gradientSvg), top: 0, left: 0 },
      { input: Buffer.from(textSvg), top: 0, left: 0 },
    ])
    .toBuffer();

  // Add border
  const borderSvg = `
    <svg width="${dimensions.width}" height="${dimensions.height}">
      <rect x="0" y="0" width="${dimensions.width}" height="${dimensions.height}"
        fill="none" stroke="${BORDER_COLOR}" stroke-width="1" />
    </svg>
  `;

  return sharp(composite)
    .composite([{ input: Buffer.from(borderSvg), top: 0, left: 0 }])
    .jpeg({ quality: JPG_QUALITY })
    .toBuffer();
}

/**
 * Generate standard slide (clean image with minimal branding)
 */
async function generateStandardSlide(
  imageUrl: string,
  dimensions: { width: number; height: number }
): Promise<Buffer> {
  const imageBuffer = await fetchImageBuffer(imageUrl);
  const baseImage = await sharp(imageBuffer)
    .resize(dimensions.width, dimensions.height, {
      fit: 'cover',
      position: 'center',
    })
    .toBuffer();

  // Add subtle Folio mark in corner
  const watermarkSvg = `
    <svg width="${dimensions.width}" height="${dimensions.height}">
      <text
        x="${dimensions.width - 50}"
        y="${dimensions.height - 40}"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-size="12"
        font-weight="300"
        fill="rgba(128,128,128,0.4)"
        letter-spacing="0.1em"
      >
        FOLIO
      </text>
    </svg>
  `;

  // Border
  const borderSvg = `
    <svg width="${dimensions.width}" height="${dimensions.height}">
      <rect x="0" y="0" width="${dimensions.width}" height="${dimensions.height}"
        fill="none" stroke="${BORDER_COLOR}" stroke-width="1" />
    </svg>
  `;

  return sharp(baseImage)
    .composite([
      { input: Buffer.from(watermarkSvg), top: 0, left: 0 },
      { input: Buffer.from(borderSvg), top: 0, left: 0 },
    ])
    .jpeg({ quality: JPG_QUALITY })
    .toBuffer();
}

/**
 * Generate CTA slide (final slide with link to Folio)
 */
async function generateCtaSlide(
  projectSlug: string,
  projectTitle: string,
  dimensions: { width: number; height: number }
): Promise<Buffer> {
  const ctaSvg = `
    <svg width="${dimensions.width}" height="${dimensions.height}">
      <rect width="${dimensions.width}" height="${dimensions.height}" fill="${BACKGROUND_COLOR}" />

      <!-- CTA Text -->
      <text
        x="${dimensions.width / 2}"
        y="${dimensions.height / 2 - 60}"
        text-anchor="middle"
        font-family="Georgia, serif"
        font-size="48"
        font-weight="400"
        fill="${TEXT_COLOR}"
        letter-spacing="-0.01em"
      >
        Explore the full project
      </text>

      <!-- Project Link -->
      <text
        x="${dimensions.width / 2}"
        y="${dimensions.height / 2 + 20}"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="32"
        font-weight="400"
        fill="${TEXT_COLOR}"
        letter-spacing="0.02em"
      >
        folio.ad/p/${escapeXml(projectSlug)}
      </text>

      <!-- Divider Line -->
      <line
        x1="${dimensions.width / 2 - 200}"
        y1="${dimensions.height / 2 - 20}"
        x2="${dimensions.width / 2 + 200}"
        y2="${dimensions.height / 2 - 20}"
        stroke="${BORDER_COLOR}"
        stroke-width="1"
      />

      <!-- Folio Mark -->
      <text
        x="${dimensions.width / 2}"
        y="${dimensions.height - 80}"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="20"
        font-weight="300"
        fill="rgba(26,26,26,0.5)"
        letter-spacing="0.15em"
      >
        FOLIO
      </text>

      <!-- Border -->
      <rect x="0" y="0" width="${dimensions.width}" height="${dimensions.height}"
        fill="none" stroke="${BORDER_COLOR}" stroke-width="1" />
    </svg>
  `;

  return sharp(Buffer.from(ctaSvg)).jpeg({ quality: JPG_QUALITY }).toBuffer();
}

/**
 * Generate complete room spotlight carousel
 */
export async function generateRoomSpotlight(
  input: RoomSpotlightInput
): Promise<Buffer[]> {
  const { roomName, projectTitle, designerName, projectSlug, imageUrls, format, seriesInfo } =
    input;
  const dimensions = FORMATS[format];

  if (imageUrls.length < 3) {
    throw new Error(`Room spotlight requires at least 3 images, got ${imageUrls.length}`);
  }

  const slides: Buffer[] = [];

  // Slide 1: Title slide with room name
  const titleSlide = await generateTitleSlide(
    imageUrls[0],
    roomName,
    projectTitle,
    designerName,
    dimensions,
    seriesInfo
  );
  slides.push(titleSlide);

  // Slides 2-N: Standard slides (all remaining images except last)
  for (let i = 1; i < imageUrls.length; i++) {
    const standardSlide = await generateStandardSlide(imageUrls[i], dimensions);
    slides.push(standardSlide);
  }

  // Final slide: CTA
  const ctaSlide = await generateCtaSlide(projectSlug, projectTitle, dimensions);
  slides.push(ctaSlide);

  return slides;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
