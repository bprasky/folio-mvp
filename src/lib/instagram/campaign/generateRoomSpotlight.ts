/** Room photographs use the publication composition; the final slide links to the article. */
import sharp from 'sharp';
import { fetchProjectImage } from '@/lib/server/project-image-input';
import { projectPhotoProcessingUrl } from '@/lib/server/protected-project-photo';
import { renderPublicationPhoto } from '@/lib/instagram-export/render-publication-photo';
import type { PublicationPhoto } from '@/lib/instagram-export/publication-photo';

export type RoomSpotlightFormat = 'square' | 'portrait' | 'story';

interface RoomSpotlightInput {
  projectId: string;
  publicationPhotos: Record<string, PublicationPhoto>;
  projectSlug: string;
  imageUrls: string[];
  format: RoomSpotlightFormat;
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

async function generateCtaSlide(
  projectSlug: string,
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

/** Generate the selected room photos, followed by the existing CTA. */
export async function generateRoomSpotlight(input: RoomSpotlightInput): Promise<Buffer[]> {
  const { projectId, publicationPhotos, projectSlug, imageUrls, format } = input;
  const dimensions = FORMATS[format];
  if (imageUrls.length < 3) {
    throw new Error(`Room spotlight requires at least 3 images, got ${imageUrls.length}`);
  }
  if (!projectId || imageUrls.some(url => !publicationPhotos?.[url])) {
    throw new Error('This room photo needs a new source review.');
  }
  const slides: Buffer[] = [];
  for (const url of imageUrls) {
    const source = await projectPhotoProcessingUrl(url, projectId);
    const { buffer } = await fetchProjectImage(source);
    slides.push(await renderPublicationPhoto(buffer, publicationPhotos[url], dimensions.width, dimensions.height));
  }
  slides.push(await generateCtaSlide(projectSlug, dimensions));
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
