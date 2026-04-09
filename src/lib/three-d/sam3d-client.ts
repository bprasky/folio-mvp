/**
 * SAM 3D Inference Client — fal.ai
 *
 * Converts 2D product images into .glb mesh files using fal.ai hosted models:
 *   - Primary: Trellis (fal-ai/trellis) — highest quality textured PBR meshes
 *   - Fallback: TripoSR (fal-ai/triposr) at mc_resolution 512
 *   - Tag-level: SAM 3D Objects (fal-ai/sam-3/3d-objects) — room photo + prompt → mask + mesh
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
  sourceImageUrl: string;      // room photo URL (fallback for segmentation)
  catalogImageUrl?: string;    // clean catalog/vendor product image (preferred for mesh)
  tagX: number;                // 0-1 or 0-100 position in image
  tagY: number;                // 0-1 or 0-100 position in image
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
  meshSource: 'trellis' | 'triposr'; // which service produced the mesh
  trellisError?: string; // if Trellis failed, why
}

// --- Helpers ---

function ensureFalKey(): void {
  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY not configured. Get an API key at https://fal.ai/dashboard/keys');
  }
  fal.config({ credentials: process.env.FAL_KEY });
}

/**
 * Extract detailed error information from fal.ai errors.
 */
function extractFalError(error: any): string {
  const parts: string[] = [error.message || 'Unknown fal.ai error'];
  if (error.body) {
    try {
      const body = typeof error.body === 'string' ? JSON.parse(error.body) : error.body;
      if (body.detail) parts.push(`Detail: ${JSON.stringify(body.detail)}`);
      if (body.message) parts.push(`Message: ${body.message}`);
    } catch {
      parts.push(`Body: ${String(error.body).substring(0, 300)}`);
    }
  }
  if (error.status) parts.push(`Status: ${error.status}`);
  return parts.join(' | ');
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

/**
 * Fetch image dimensions using sharp (with fallback).
 */
async function getImageDimensions(imageUrl: string): Promise<{ width: number; height: number }> {
  try {
    const sharp = (await import('sharp')).default;
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) throw new Error('No dimensions');
    return { width: metadata.width, height: metadata.height };
  } catch (e) {
    console.warn('[sam3d] Could not determine image dimensions, using 1024x1024 default', e);
    return { width: 1024, height: 1024 };
  }
}

// --- Trellis: highest quality textured PBR mesh ---

async function callTrellisMesh(imageUrl: string): Promise<Buffer> {
  const result = await fal.subscribe('fal-ai/trellis', {
    input: {
      image_url: imageUrl,
      texture_size: 2048,
      mesh_simplify: 0.9,
      ss_guidance_strength: 7.5,
      ss_sampling_steps: 20,
      slat_guidance_strength: 3,
      slat_sampling_steps: 20,
    } as any,
    logs: true,
  });

  const data = result.data as any;
  console.log('[sam3d] Trellis raw response keys:', data ? Object.keys(data) : 'null');

  // Trellis may return mesh in different fields
  const glbUrl = data?.model_mesh?.url
    || data?.glb_url
    || data?.mesh?.url
    || data?.output?.model_mesh?.url;

  if (!glbUrl) {
    throw new Error(`Trellis returned no GLB. Keys: ${data ? Object.keys(data).join(',') : 'null'} | Data: ${JSON.stringify(data).substring(0, 500)}`);
  }

  return downloadAsBuffer(glbUrl);
}

// --- TripoSR fallback at max resolution ---

async function callTripoSRMesh(imageUrl: string): Promise<Buffer> {
  const result = await fal.subscribe('fal-ai/triposr', {
    input: {
      image_url: imageUrl,
      output_format: 'glb',
      do_remove_background: true,
      foreground_ratio: 0.9,
      mc_resolution: 512,
    },
    logs: true,
  });

  const data = result.data as any;
  const glbUrl = data?.model_mesh?.url || data?.model_url || data?.output?.url;

  if (!glbUrl) {
    throw new Error(`TripoSR returned no GLB. Keys: ${data ? Object.keys(data).join(',') : 'null'}`);
  }

  return downloadAsBuffer(glbUrl);
}

// --- Product-level: Trellis primary, TripoSR@512 fallback ---

export async function callSam3DService(req: Sam3DRequest): Promise<Sam3DResponse> {
  ensureFalKey();

  console.log('[sam3d] Product-level generation starting (Trellis primary)', {
    productId: req.productId,
    imageUrl: req.imageUrl.substring(0, 80),
  });

  let glbBuffer: Buffer;

  try {
    glbBuffer = await callTrellisMesh(req.imageUrl);
    console.log('[sam3d] Trellis complete', { productId: req.productId, glbSize: glbBuffer.length });
  } catch (trellisError: any) {
    console.warn('[sam3d] Trellis failed, falling back to TripoSR@512', {
      productId: req.productId,
      error: extractFalError(trellisError),
    });

    try {
      glbBuffer = await callTripoSRMesh(req.imageUrl);
      console.log('[sam3d] TripoSR@512 fallback complete', { productId: req.productId, glbSize: glbBuffer.length });
    } catch (tripoError: any) {
      throw new Error(`Both Trellis and TripoSR failed: ${extractFalError(trellisError)} | ${extractFalError(tripoError)}`);
    }
  }

  return { glbBuffer, confidence: 1.0 };
}

// --- Tag-level: SAM 3D Objects with point prompts ---

const PLACEHOLDER_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

/**
 * Use SAM segmentation to isolate a product from a room photo, then
 * create a clean product-on-white-background image for 3D generation.
 * Returns the isolated image URL (uploaded to fal storage), mask, bbox, and confidence.
 */
async function isolateProductFromRoom(
  sourceImageUrl: string,
  pixelX: number,
  pixelY: number,
  dims: { width: number; height: number },
  tagId: string,
): Promise<{
  isolatedImageUrl: string;
  maskPngBuffer: Buffer;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
}> {
  const segResult = await fal.subscribe('fal-ai/sam-3/image', {
    input: {
      image_url: sourceImageUrl,
      point_prompts: [{ x: pixelX, y: pixelY, label: 1 }],
      detection_threshold: 0.3,
    } as any,
    logs: true,
  });

  const segData = segResult.data as any;
  console.log('[sam3d] SAM segmentation response keys:', segData ? Object.keys(segData) : 'null');

  const masks = segData?.masks || segData?.output?.masks || [];
  const bboxes = segData?.bboxes || segData?.output?.bboxes || [];
  const scores = segData?.confidence_scores || segData?.output?.confidence_scores || [];

  if (!masks.length) throw new Error('SAM returned no masks');

  const maskUrl = typeof masks[0] === 'string' ? masks[0] : masks[0]?.url;
  if (!maskUrl) throw new Error('SAM returned no mask URL');

  const maskPngBuffer = await downloadAsBuffer(maskUrl);
  const confidence = scores[0] ?? 0.8;

  let boundingBox = { x: 0, y: 0, width: 1, height: 1 };
  if (bboxes.length) {
    const raw = bboxes[0];
    if (Array.isArray(raw)) boundingBox = { x: raw[0], y: raw[1], width: raw[2], height: raw[3] };
    else if (raw && typeof raw === 'object') boundingBox = raw;
  }

  // Use sharp to apply mask and isolate product on white background
  const sharp = (await import('sharp')).default;
  const sourceResponse = await fetch(sourceImageUrl);
  if (!sourceResponse.ok) throw new Error(`Failed to fetch source image: ${sourceResponse.status}`);
  const sourceBuffer = Buffer.from(await sourceResponse.arrayBuffer());

  // Resize mask to match source image dimensions
  const maskResized = await sharp(maskPngBuffer)
    .resize(dims.width, dims.height, { fit: 'fill' })
    .ensureAlpha()
    .toBuffer();

  // Extract just the alpha channel from the mask (white = product, black = background)
  const maskAlpha = await sharp(maskResized)
    .extractChannel(0) // Use red channel as alpha
    .toBuffer();

  // Create product-only image: apply mask as alpha, then flatten on white background
  const isolated = await sharp(sourceBuffer)
    .ensureAlpha()
    .joinChannel(maskAlpha) // Replace alpha with mask
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // White background
    .png()
    .toBuffer();

  // Crop to bounding box with padding for cleaner input to Trellis
  const pad = 0.1; // 10% padding around bbox
  const cropX = Math.max(0, Math.floor((boundingBox.x - pad) * dims.width));
  const cropY = Math.max(0, Math.floor((boundingBox.y - pad) * dims.height));
  const cropW = Math.min(dims.width - cropX, Math.ceil((boundingBox.width + pad * 2) * dims.width));
  const cropH = Math.min(dims.height - cropY, Math.ceil((boundingBox.height + pad * 2) * dims.height));

  let finalImage = isolated;
  if (cropW > 50 && cropH > 50) {
    finalImage = await sharp(isolated)
      .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
      .png()
      .toBuffer();
    console.log('[sam3d] Cropped product image', { cropX, cropY, cropW, cropH, size: finalImage.length });
  }

  // Upload isolated image to fal storage
  const blob = new Blob([new Uint8Array(finalImage)], { type: 'image/png' });
  const file = new File([blob], `isolated-${tagId}.png`, { type: 'image/png' });
  const isolatedImageUrl = await fal.storage.upload(file);
  console.log('[sam3d] Uploaded isolated product image to fal storage', {
    tagId,
    imageSize: finalImage.length,
    url: isolatedImageUrl.substring(0, 80),
  });

  return { isolatedImageUrl, maskPngBuffer, boundingBox, confidence };
}

export async function callSam3DTagService(req: Sam3DTagRequest): Promise<Sam3DTagResponse> {
  ensureFalKey();

  // Convert tag coordinates (0-100 or 0-1) to pixel coordinates
  const dims = await getImageDimensions(req.sourceImageUrl);
  const normX = req.tagX > 1 ? req.tagX / 100 : req.tagX;
  const normY = req.tagY > 1 ? req.tagY / 100 : req.tagY;
  const pixelX = Math.round(normX * dims.width);
  const pixelY = Math.round(normY * dims.height);

  const hasCatalogImage = !!req.catalogImageUrl;

  console.log('[sam3d] Tag-level generation starting', {
    tagId: req.tagId,
    hasCatalogImage,
    catalogImageUrl: req.catalogImageUrl?.substring(0, 80),
    tagCoords: { raw: { x: req.tagX, y: req.tagY }, pixels: { x: pixelX, y: pixelY } },
    imageDims: dims,
    sourceImageUrl: req.sourceImageUrl.substring(0, 80),
  });

  // Determine mesh input: prefer catalog image (clean product photo) over room photo
  let maskPngBuffer: Buffer = PLACEHOLDER_PNG;
  let boundingBox = { x: normX, y: normY, width: 0.3, height: 0.3 };
  let confidence = 0.8;
  let meshInputUrl: string;

  if (hasCatalogImage) {
    // Catalog image is already a clean product photo — send directly to Trellis
    meshInputUrl = req.catalogImageUrl!;
    confidence = 1.0;
    console.log('[sam3d] Using catalog image for mesh (best quality)', { tagId: req.tagId });
  } else {
    // No catalog image — isolate product from room photo via SAM segmentation
    meshInputUrl = req.sourceImageUrl; // fallback if isolation fails
    try {
      const isolation = await isolateProductFromRoom(
        req.sourceImageUrl, pixelX, pixelY, dims, req.tagId,
      );
      meshInputUrl = isolation.isolatedImageUrl;
      maskPngBuffer = isolation.maskPngBuffer;
      boundingBox = isolation.boundingBox;
      confidence = isolation.confidence;
      console.log('[sam3d] Product isolated from room photo', { tagId: req.tagId, confidence });
    } catch (segError: any) {
      console.warn('[sam3d] Product isolation failed, using full room photo (lowest quality)', {
        tagId: req.tagId,
        error: extractFalError(segError),
      });
    }
  }

  // Generate 3D mesh via Trellis only — no fallback, fail loudly
  let glbBuffer: Buffer;
  const meshSource: 'trellis' | 'triposr' = 'trellis';
  let trellisErrorMsg: string | undefined;

  try {
    glbBuffer = await callTrellisMesh(meshInputUrl);
    console.log('[sam3d] Tag mesh via Trellis complete', { tagId: req.tagId, glbSize: glbBuffer.length });
  } catch (trellisError: any) {
    trellisErrorMsg = extractFalError(trellisError);
    console.error('[sam3d] Trellis failed (no fallback)', {
      tagId: req.tagId,
      error: trellisErrorMsg,
    });
    throw new Error(`Trellis failed for tag ${req.tagId}: ${trellisErrorMsg}`);
  }

  const bboxArea = boundingBox.width * boundingBox.height;
  const depthEstimate = Math.max(0, Math.min(1, 1 - bboxArea * 2));

  console.log('[sam3d] Tag-level complete', {
    tagId: req.tagId,
    meshSource,
    glbSize: glbBuffer.length,
    maskSize: maskPngBuffer.length,
    confidence,
    usedCatalog: hasCatalogImage,
    depthEstimate,
  });

  return { glbBuffer, maskPngBuffer, confidence, boundingBox, depthEstimate, meshSource, trellisError: trellisErrorMsg };
}
