import sharp from 'sharp';
import {
  createGradientOverlaySVG,
  createHeadlineSVG,
  createWatermarkSVG,
  createBioSlideSVG,
  createPhotoFadeSVG,
  createCTAContentSVG,
  type HeadlinePosition,
  type WatermarkStyle,
} from './svg-templates';

// Aspect ratio dimensions (pixels, optimized for Instagram)
export const DIMENSIONS = {
  '4:5': { width: 1080, height: 1350 },
  '1:1': { width: 1080, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
} as const;

export type AspectRatio = keyof typeof DIMENSIONS;
export type SlideType = 'hero' | 'detail' | 'bio' | 'cta';

export interface ExportConfig {
  aspectRatio: AspectRatio;
  watermarkStyle: WatermarkStyle;
  headlinePosition: HeadlinePosition;
  headline: string;
  designerName: string;
  designerTitle?: string;
  studioName?: string;
  bioEnabled: boolean;
  bioText?: string;
  projectName: string;
  slideCount: 3 | 4 | 5;
  selectedImageUrls: string[];
  roomId?: string;
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateHeroSlide(config: {
  imageUrl: string;
  aspectRatio: AspectRatio;
  headline: string;
  headlinePosition: HeadlinePosition;
  watermarkStyle: WatermarkStyle;
  designerName: string;
}): Promise<Buffer> {
  const { width, height } = DIMENSIONS[config.aspectRatio];

  const imageBuffer = await fetchImageBuffer(config.imageUrl);

  const baseImage = await sharp(imageBuffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .toBuffer();

  const gradientOverlay = createGradientOverlaySVG(width, height, config.headlinePosition);
  const headlineSVG = createHeadlineSVG(config.headline, width, height, config.headlinePosition);
  const watermarkSVG = createWatermarkSVG(
    config.watermarkStyle,
    config.designerName,
    width,
    height,
    config.headlinePosition
  );

  return sharp(baseImage)
    .composite([
      { input: Buffer.from(gradientOverlay), top: 0, left: 0 },
      { input: Buffer.from(headlineSVG), top: 0, left: 0 },
      { input: Buffer.from(watermarkSVG), top: 0, left: 0 },
    ])
    .jpeg({ quality: 95 })
    .toBuffer();
}

export async function generateDetailSlide(config: {
  imageUrl: string;
  aspectRatio: AspectRatio;
  watermarkStyle: WatermarkStyle;
  designerName: string;
}): Promise<Buffer> {
  const { width, height } = DIMENSIONS[config.aspectRatio];

  const imageBuffer = await fetchImageBuffer(config.imageUrl);

  const baseImage = await sharp(imageBuffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .toBuffer();

  // Watermark at bottom-right
  const watermarkSVG = createWatermarkSVG(
    config.watermarkStyle,
    config.designerName,
    width,
    height,
    'top_left' // This makes watermark go bottom-right
  );

  return sharp(baseImage)
    .composite([{ input: Buffer.from(watermarkSVG), top: 0, left: 0 }])
    .jpeg({ quality: 95 })
    .toBuffer();
}

export async function generateBioSlide(config: {
  aspectRatio: AspectRatio;
  designerName: string;
  designerTitle?: string;
  studioName?: string;
  bioText: string;
  photoUrl?: string;
  watermarkStyle: WatermarkStyle;
}): Promise<Buffer> {
  const { width, height } = DIMENSIONS[config.aspectRatio];

  // Warm neutral background
  const background = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 245, g: 240, b: 235, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const photoHeight = Math.round(height * 0.45);
  const layers: sharp.OverlayOptions[] = [];

  // If photo provided, add it with fade
  if (config.photoUrl) {
    try {
      const photoBuffer = await fetchImageBuffer(config.photoUrl);
      const photoLayer = await sharp(photoBuffer)
        .resize(width, photoHeight, { fit: 'cover' })
        .toBuffer();

      layers.push({ input: photoLayer, top: 0, left: 0 });

      const fadeGradient = createPhotoFadeSVG(width, photoHeight);
      layers.push({ input: Buffer.from(fadeGradient), top: 0, left: 0 });
    } catch {
      // Skip photo if it fails to load
    }
  }

  // Text content
  const textContent = createBioSlideSVG({
    designerName: config.designerName,
    designerTitle: config.designerTitle,
    studioName: config.studioName,
    bioText: config.bioText,
    width,
    height,
    photoHeight: config.photoUrl ? photoHeight : Math.round(height * 0.2),
  });
  layers.push({ input: Buffer.from(textContent), top: 0, left: 0 });

  // Watermark
  const watermarkSVG = createWatermarkSVG(
    config.watermarkStyle,
    config.designerName,
    width,
    height,
    'top_left' // bottom-right position
  );
  layers.push({ input: Buffer.from(watermarkSVG), top: 0, left: 0 });

  return sharp(background).composite(layers).jpeg({ quality: 95 }).toBuffer();
}

export async function generateCTASlide(config: {
  aspectRatio: AspectRatio;
  projectName: string;
  designerName: string;
}): Promise<Buffer> {
  const { width, height } = DIMENSIONS[config.aspectRatio];

  const background = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 245, g: 240, b: 235, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const ctaContent = createCTAContentSVG({
    projectName: config.projectName,
    designerName: config.designerName,
    width,
    height,
  });

  return sharp(background)
    .composite([{ input: Buffer.from(ctaContent), top: 0, left: 0 }])
    .jpeg({ quality: 95 })
    .toBuffer();
}

export interface SlideResult {
  slideIndex: number;
  type: SlideType;
  buffer: Buffer;
}

export function assembleSlideSequence(
  config: ExportConfig,
  imageUrls: string[]
): { type: SlideType; imageUrl?: string }[] {
  const slides: { type: SlideType; imageUrl?: string }[] = [];

  // Hero slide is always first
  if (imageUrls[0]) {
    slides.push({ type: 'hero', imageUrl: imageUrls[0] });
  }

  // Calculate detail slots
  const detailCount =
    config.slideCount - 1 - (config.bioEnabled ? 1 : 0) - 1; // minus hero, bio, CTA

  const detailImages = imageUrls.slice(1);
  const firstHalf = Math.ceil(detailCount / 2);
  const secondHalf = detailCount - firstHalf;

  // First batch of details
  for (let i = 0; i < firstHalf; i++) {
    if (detailImages[i]) {
      slides.push({ type: 'detail', imageUrl: detailImages[i] });
    }
  }

  // Bio slide in the middle
  if (config.bioEnabled) {
    slides.push({ type: 'bio' });
  }

  // Second batch of details
  for (let i = firstHalf; i < firstHalf + secondHalf; i++) {
    if (detailImages[i]) {
      slides.push({ type: 'detail', imageUrl: detailImages[i] });
    }
  }

  // CTA slide is always last
  slides.push({ type: 'cta' });

  return slides;
}

export async function generateAllSlides(
  config: ExportConfig,
  designerPhotoUrl?: string
): Promise<SlideResult[]> {
  const slideSequence = assembleSlideSequence(config, config.selectedImageUrls);
  const results: SlideResult[] = [];

  for (let i = 0; i < slideSequence.length; i++) {
    const slide = slideSequence[i];
    let buffer: Buffer;

    switch (slide.type) {
      case 'hero':
        buffer = await generateHeroSlide({
          imageUrl: slide.imageUrl!,
          aspectRatio: config.aspectRatio,
          headline: config.headline,
          headlinePosition: config.headlinePosition,
          watermarkStyle: config.watermarkStyle,
          designerName: config.designerName,
        });
        break;

      case 'detail':
        buffer = await generateDetailSlide({
          imageUrl: slide.imageUrl!,
          aspectRatio: config.aspectRatio,
          watermarkStyle: config.watermarkStyle,
          designerName: config.designerName,
        });
        break;

      case 'bio':
        buffer = await generateBioSlide({
          aspectRatio: config.aspectRatio,
          designerName: config.designerName,
          designerTitle: config.designerTitle,
          studioName: config.studioName,
          bioText: config.bioText || '',
          photoUrl: designerPhotoUrl,
          watermarkStyle: config.watermarkStyle,
        });
        break;

      case 'cta':
        buffer = await generateCTASlide({
          aspectRatio: config.aspectRatio,
          projectName: config.projectName,
          designerName: config.designerName,
        });
        break;
    }

    results.push({ slideIndex: i, type: slide.type, buffer });
  }

  return results;
}
