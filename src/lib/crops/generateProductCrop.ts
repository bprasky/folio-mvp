import sharp from "sharp";
import { getCategoryDefaultScale } from "./categoryDefaults";

export interface CropOptions {
  tag: {
    x: number;
    y: number;
    cropX?: number | null;
    cropY?: number | null;
    cropScale?: number | null;
    cropAspect?: string | null;
    category?: string | null;
  };
  sourceImageUrl: string;
  outputSize?: number;
}

export interface CropResult {
  buffer: Buffer;
  width: number;
  height: number;
}

function parseAspect(aspect: string | null | undefined): { w: number; h: number } {
  if (!aspect) return { w: 1, h: 1 };
  const parts = aspect.split(":");
  if (parts.length !== 2) return { w: 1, h: 1 };
  const w = parseInt(parts[0], 10);
  const h = parseInt(parts[1], 10);
  if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return { w: 1, h: 1 };
  return { w, h };
}

export async function generateProductCrop(options: CropOptions): Promise<CropResult> {
  const { tag, sourceImageUrl, outputSize = 600 } = options;

  // Fetch source image
  const response = await fetch(sourceImageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch source image: ${response.status} ${response.statusText}`);
  }
  const imageBuffer = Buffer.from(await response.arrayBuffer());

  // Get image metadata
  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width!;
  const imgHeight = metadata.height!;

  // Calculate crop center (use manual override if set)
  const centerX = (tag.cropX ?? tag.x) * imgWidth;
  const centerY = (tag.cropY ?? tag.y) * imgHeight;

  // Calculate crop scale
  const scale = tag.cropScale ?? getCategoryDefaultScale(tag.category);

  // Calculate crop dimensions based on aspect ratio
  const aspect = parseAspect(tag.cropAspect);
  const aspectRatio = aspect.w / aspect.h;

  // Scale is relative to the shorter image dimension
  const baseDim = Math.min(imgWidth, imgHeight) * scale;
  let cropWidth: number;
  let cropHeight: number;

  if (aspectRatio >= 1) {
    cropHeight = baseDim;
    cropWidth = baseDim * aspectRatio;
  } else {
    cropWidth = baseDim;
    cropHeight = baseDim / aspectRatio;
  }

  // Ensure crop doesn't exceed image bounds
  cropWidth = Math.min(cropWidth, imgWidth);
  cropHeight = Math.min(cropHeight, imgHeight);

  // Calculate top-left corner, clamping to image bounds
  let left = Math.round(centerX - cropWidth / 2);
  let top = Math.round(centerY - cropHeight / 2);
  left = Math.max(0, Math.min(left, imgWidth - cropWidth));
  top = Math.max(0, Math.min(top, imgHeight - cropHeight));

  const extractWidth = Math.round(cropWidth);
  const extractHeight = Math.round(cropHeight);

  // Extract crop region, resize, and convert to webp
  const outputWidth = outputSize;
  const outputHeight = Math.round(outputSize / aspectRatio);

  const result = await sharp(imageBuffer)
    .extract({
      left: Math.round(left),
      top: Math.round(top),
      width: extractWidth,
      height: extractHeight,
    })
    .resize(outputWidth, outputHeight, { fit: "cover" })
    .webp({ quality: 85 })
    .toBuffer();

  return {
    buffer: result,
    width: outputWidth,
    height: outputHeight,
  };
}
