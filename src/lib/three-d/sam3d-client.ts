/**
 * SAM 3D Inference Client — fal.ai
 *
 * Converts 2D product images into .glb mesh files using fal.ai hosted models:
 *   - Product-level: TripoSR (fal-ai/triposr) — single image → 3D mesh
 *   - Tag-level: SAM 3 segmentation + SAM 3D Objects — room photo + point prompt → mask + mesh
 *
 * Requires FAL_KEY environment variable.
 */

import { fal } from '@fal-ai/client';

// --- Shared interfaces (consumed by API routes) ---

export interface Sam3DRequest {
  imageUrl: string;
  productId: string;
  prompt?: string;
}

export interface Sam3DResponse {
  glbBuffer: Buffer;
  confidence: number;
}

export interface Sam3DTagRequest {
  sourceImageUrl: string; // room photo URL
  tagX: number;           // 0-1 normalized position in image
  tagY: number;           // 0-1 normalized position in image
  productId: string;
  tagId: string;
  prompt?: string;
}

export interface Sam3DTagResponse {
  glbBuffer: Buffer;
  maskPngBuffer: Buffer;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  depthEstimate: number; // 0 = foreground, 1 = background
}

// --- Helpers ---

function ensureFalKey(): void {
  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY not configured. Get an API key at https://fal.ai/dashboard/keys');
  }
  fal.config({ credentials: process.env.FAL_KEY });
}

/**
 * Fetch image dimensions by downloading the image and reading the size.
 * Uses a lightweight approach — fetches the full image but only extracts dimensions.
 * Results should be cached by callers if processing multiple tags for the same image.
 */
async function getImageDimensions(imageUrl: string): Promise<{ width: number; height: number }> {
  // Use a dynamic import for sharp to avoid bundling issues
  // If sharp is not available, fall back to a reasonable default
  try {
    const sharp = (await import('sharp')).default;
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Could not determine image dimensions');
    }
    return { width: metadata.width, height: metadata.height };
  } catch {
    // Fallback: assume a common resolution if sharp is unavailable
    console.warn('[sam3d-client] Could not determine image dimensions, using 1920x1080 default');
    return { width: 1920, height: 1080 };
  }
}

/**
 * Download a file from a URL and return it as a Buffer.
 */
async function downloadAsBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download from ${url}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

// --- Product-level: TripoSR (single product image → 3D mesh) ---

export async function callSam3DService(req: Sam3DRequest): Promise<Sam3DResponse> {
  ensureFalKey();

  console.log('[sam3d] Product-level generation starting', {
    productId: req.productId,
    imageUrl: req.imageUrl.substring(0, 80),
  });

  const result = await fal.subscribe('fal-ai/triposr', {
    input: {
      image_url: req.imageUrl,
      output_format: 'glb',
      do_remove_background: true,
      foreground_ratio: 0.9,
      mc_resolution: 256,
    },
    logs: true,
  });

  // Extract GLB URL from response
  const data = result.data as any;
  const glbUrl = data?.model_mesh?.url || data?.model_url || data?.output?.url;

  if (!glbUrl) {
    console.error('[sam3d] TripoSR returned no GLB URL', {
      productId: req.productId,
      responseKeys: data ? Object.keys(data) : 'null',
      data: JSON.stringify(data).substring(0, 500),
    });
    throw new Error('TripoSR returned no GLB output');
  }

  const glbBuffer = await downloadAsBuffer(glbUrl);

  console.log('[sam3d] Product-level generation complete', {
    productId: req.productId,
    glbSize: glbBuffer.length,
  });

  return {
    glbBuffer,
    confidence: 1.0,
  };
}

// --- Tag-level: SAM 3 segmentation + SAM 3D Objects ---

export async function callSam3DTagService(req: Sam3DTagRequest): Promise<Sam3DTagResponse> {
  ensureFalKey();

  console.log('[sam3d] Tag-level generation starting', {
    tagId: req.tagId,
    productId: req.productId,
    tagX: req.tagX,
    tagY: req.tagY,
  });

  // Convert coordinates to pixel values
  // Tags store coords as 0-100 percentages OR 0-1 normalized — handle both
  const dims = await getImageDimensions(req.sourceImageUrl);
  const normX = req.tagX > 1 ? req.tagX / 100 : req.tagX;
  const normY = req.tagY > 1 ? req.tagY / 100 : req.tagY;
  const pixelX = Math.round(normX * dims.width);
  const pixelY = Math.round(normY * dims.height);

  console.log('[sam3d] Converted coordinates', {
    normalized: { x: req.tagX, y: req.tagY },
    pixels: { x: pixelX, y: pixelY },
    imageDims: dims,
  });

  // Step 1: SAM 3 segmentation — get mask and bounding box
  const segResult = await fal.subscribe('fal-ai/sam-3/image', {
    input: {
      image_url: req.sourceImageUrl,
      point_prompts: [[pixelX, pixelY, 1]],
      prompt: req.prompt,
    } as any,
    logs: true,
  });

  const segData = segResult.data as any;
  const masks = segData?.masks || segData?.output?.masks || [];
  const bboxes = segData?.bboxes || segData?.output?.bboxes || [];
  const scores = segData?.confidence_scores || segData?.output?.confidence_scores || [];

  if (!masks.length) {
    console.error('[sam3d] SAM segmentation returned no masks', {
      tagId: req.tagId,
      responseKeys: segData ? Object.keys(segData) : 'null',
    });
    throw new Error(`SAM 3 segmentation returned no mask for tag ${req.tagId}`);
  }

  // Download the best mask as PNG buffer
  const maskUrl = typeof masks[0] === 'string' ? masks[0] : masks[0]?.url;
  if (!maskUrl) {
    throw new Error(`SAM 3 segmentation returned invalid mask format for tag ${req.tagId}`);
  }
  const maskPngBuffer = await downloadAsBuffer(maskUrl);

  // Parse bounding box (fal.ai returns normalized [cx, cy, width, height])
  const rawBbox = bboxes[0] || [0.5, 0.5, 0.5, 0.5];
  const boundingBox = Array.isArray(rawBbox)
    ? { x: rawBbox[0], y: rawBbox[1], width: rawBbox[2], height: rawBbox[3] }
    : rawBbox;

  const confidence = scores[0] ?? 0.8;

  console.log('[sam3d] Segmentation complete', {
    tagId: req.tagId,
    maskSize: maskPngBuffer.length,
    boundingBox,
    confidence,
  });

  // Step 2: SAM 3D Objects — generate 3D mesh using same point prompt
  const meshResult = await fal.subscribe('fal-ai/sam-3/3d-objects', {
    input: {
      image_url: req.sourceImageUrl,
      point_prompts: [[pixelX, pixelY, 1]],
      prompt: req.prompt,
    } as any,
    logs: true,
  });

  const meshData = meshResult.data as any;
  const glbUrl = meshData?.model_url || meshData?.glb?.url || meshData?.output?.url;

  if (!glbUrl) {
    console.error('[sam3d] SAM 3D Objects returned no GLB URL', {
      tagId: req.tagId,
      responseKeys: meshData ? Object.keys(meshData) : 'null',
      data: JSON.stringify(meshData).substring(0, 500),
    });
    throw new Error(`SAM 3D Objects returned no GLB for tag ${req.tagId}`);
  }

  const glbBuffer = await downloadAsBuffer(glbUrl);

  // Estimate depth from bounding box: larger objects are typically closer
  // Normalize: area 0→1, invert so larger = closer to 0
  const bboxArea = boundingBox.width * boundingBox.height;
  const depthEstimate = Math.max(0, Math.min(1, 1 - bboxArea * 2));

  console.log('[sam3d] Tag-level generation complete', {
    tagId: req.tagId,
    glbSize: glbBuffer.length,
    depthEstimate,
  });

  return {
    glbBuffer,
    maskPngBuffer,
    confidence,
    boundingBox,
    depthEstimate,
  };
}
