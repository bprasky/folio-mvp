/**
 * Generate "Now on Folio" launch card in multiple formats
 * Supports: square (1080x1080), portrait (1080x1350), story (1080x1920)
 */

import sharp from 'sharp';

export type LaunchCardFormat = 'square' | 'portrait' | 'story';

interface LaunchCardInput {
  projectTitle: string;
  designerName: string;
  heroImageUrl: string;
  projectSlug: string;
  format: LaunchCardFormat;
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
const JPG_QUALITY = 90;

/**
 * Fetch image from URL and convert to buffer
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

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } else {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Folio-Instagram-Export/1.0',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error(`Timeout fetching image from ${url}`);
    }
    throw error;
  }
}

/**
 * Generate launch card for a campaign
 */
export async function generateLaunchCard(input: LaunchCardInput): Promise<Buffer> {
  const { projectTitle, designerName, heroImageUrl, projectSlug, format, seriesInfo } = input;
  const dimensions = FORMATS[format];

  // Fetch and process hero image
  const imageBuffer = await fetchImageBuffer(heroImageUrl);
  const heroImage = sharp(imageBuffer).resize(dimensions.width, dimensions.height, {
    fit: 'cover',
    position: 'center',
  });

  // Create gradient overlay for text legibility
  const gradientHeight = Math.floor(dimensions.height * 0.6);
  const gradientSvg = `
    <svg width="${dimensions.width}" height="${dimensions.height}">
      <defs>
        <linearGradient id="grad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" style="stop-color:rgba(0,0,0,0.85);stop-opacity:1" />
          <stop offset="60%" style="stop-color:rgba(0,0,0,0.4);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgba(0,0,0,0);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${dimensions.width}" height="${gradientHeight}" y="${dimensions.height - gradientHeight}" fill="url(#grad)" />
    </svg>
  `;

  // Calculate text sizing based on format
  const titleSize = format === 'story' ? 80 : format === 'portrait' ? 72 : 64;
  const subtitleSize = format === 'story' ? 36 : format === 'portrait' ? 32 : 28;
  const padding = format === 'story' ? 80 : 60;
  const bottomPadding = padding;

  // Text content positioning
  const textY = dimensions.height - bottomPadding - (seriesInfo ? 120 : 100);

  // Build text overlay SVG
  const textSvg = `
    <svg width="${dimensions.width}" height="${dimensions.height}">
      <!-- Project Title -->
      <text
        x="${padding}"
        y="${textY}"
        font-family="Georgia, serif"
        font-size="${titleSize}"
        font-weight="400"
        fill="#FFFFFF"
        letter-spacing="-0.02em"
        style="text-shadow: 0 4px 24px rgba(0,0,0,0.3);"
      >
        ${escapeXml(projectTitle.toUpperCase())}
      </text>

      <!-- Designer Name -->
      <text
        x="${padding}"
        y="${textY + 48}"
        font-family="Arial, sans-serif"
        font-size="${subtitleSize}"
        font-weight="400"
        fill="rgba(255,255,255,0.9)"
        letter-spacing="0.01em"
      >
        ${escapeXml(designerName)}
      </text>

      ${
        seriesInfo
          ? `
      <!-- Series Indicator -->
      <text
        x="${padding}"
        y="${textY + 90}"
        font-family="Arial, sans-serif"
        font-size="24"
        font-weight="300"
        fill="rgba(255,255,255,0.8)"
        letter-spacing="0.02em"
      >
        • ${seriesInfo.current} of ${seriesInfo.total}
      </text>
      `
          : ''
      }

      <!-- Folio Mark (bottom right) -->
      <text
        x="${dimensions.width - padding}"
        y="${dimensions.height - bottomPadding}"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-size="20"
        font-weight="300"
        fill="rgba(255,255,255,0.6)"
        letter-spacing="0.1em"
      >
        FOLIO
      </text>
    </svg>
  `;

  // Composite: hero image + gradient + text
  const compositeImage = await sharp(await heroImage.toBuffer())
    .composite([
      {
        input: Buffer.from(gradientSvg),
        top: 0,
        left: 0,
      },
      {
        input: Buffer.from(textSvg),
        top: 0,
        left: 0,
      },
    ])
    .toBuffer();

  // Add hairline border
  const borderSvg = `
    <svg width="${dimensions.width}" height="${dimensions.height}">
      <rect
        x="0"
        y="0"
        width="${dimensions.width}"
        height="${dimensions.height}"
        fill="none"
        stroke="${BORDER_COLOR}"
        stroke-width="1"
      />
    </svg>
  `;

  // Final composite with border
  const finalImage = await sharp(compositeImage)
    .composite([
      {
        input: Buffer.from(borderSvg),
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: JPG_QUALITY })
    .toBuffer();

  return finalImage;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
