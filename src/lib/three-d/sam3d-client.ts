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
  sourceImageUrl: string; // room photo URL
  tagX: number;           // 0-1 or 0-100 position in image
  tagY: number;           // 0-1 or 0-100 position in image
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
      texture_size: '2048',
      mesh_simplify: 0.95,
      ss_guidance_strength: 7.5,
      ss_sampling_steps: 12,
      slat_guidance_strength: 3,
      slat_sampling_steps: 12,
    } as any,
    logs: true,
  });

  const data = result.data as any;
  const glbUrl = data?.model_mesh?.url;

  if (!glbUrl) {
    throw new Error(`Trellis returned no GLB. Keys: ${data ? Object.keys(data).join(',') : 'null'}`);
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

export async function callSam3DTagService(req: Sam3DTagRequest): Promise<Sam3DTagResponse> {
  ensureFalKey();

  // Convert tag coordinates (0-100 or 0-1) to pixel coordinates
  const dims = await getImageDimensions(req.sourceImageUrl);
  const normX = req.tagX > 1 ? req.tagX / 100 : req.tagX;
  const normY = req.tagY > 1 ? req.tagY / 100 : req.tagY;
  const pixelX = Math.round(normX * dims.width);
  const pixelY = Math.round(normY * dims.height);

  console.log('[sam3d] Tag-level generation starting', {
    tagId: req.tagId,
    tagCoords: { raw: { x: req.tagX, y: req.tagY }, pixels: { x: pixelX, y: pixelY } },
    imageDims: dims,
    sourceImageUrl: req.sourceImageUrl.substring(0, 80),
  });

  // Step 1: Generate 3D mesh
  // Try Trellis first (highest quality), then SAM 3D Objects, then TripoSR@512
  let glbBuffer: Buffer;

  try {
    glbBuffer = await callTrellisMesh(req.sourceImageUrl);
    console.log('[sam3d] Tag mesh via Trellis complete', { tagId: req.tagId, glbSize: glbBuffer.length });
  } catch (trellisError: any) {
    console.warn('[sam3d] Trellis failed for tag, trying SAM 3D Objects', {
      tagId: req.tagId,
      error: extractFalError(trellisError),
    });

    try {
      const meshResult = await fal.subscribe('fal-ai/sam-3/3d-objects', {
        input: {
          image_url: req.sourceImageUrl,
          point_prompts: [{ x: pixelX, y: pixelY, label: 1 }],
          detection_threshold: 0.1,
        } as any,
        logs: true,
      });
      const meshData = meshResult.data as any;
      console.log('[sam3d] SAM 3D Objects response keys:', meshData ? Object.keys(meshData) : 'null');

      const glbUrl = meshData?.model_mesh?.url
        || meshData?.model_url
        || meshData?.glb?.url
        || meshData?.output?.url
        || meshData?.mesh?.url;

      if (!glbUrl) throw new Error('No GLB URL in response');
      glbBuffer = await downloadAsBuffer(glbUrl);
    } catch (sam3dError: any) {
      console.warn('[sam3d] SAM 3D Objects also failed, falling back to TripoSR@512', {
        tagId: req.tagId,
        error: extractFalError(sam3dError),
      });

      try {
        glbBuffer = await callTripoSRMesh(req.sourceImageUrl);
      } catch (tripoError: any) {
        throw new Error(`All mesh methods failed for tag ${req.tagId}: Trellis, SAM 3D, TripoSR`);
      }
    }
  }

  // Step 2: Get segmentation mask using SAM 3 Image with same point prompt
  let maskPngBuffer: Buffer = PLACEHOLDER_PNG;
  let boundingBox = { x: normX, y: normY, width: 0.3, height: 0.3 };
  let confidence = 0.8;

  try {
    const segResult = await fal.subscribe('fal-ai/sam-3/image', {
      input: {
        image_url: req.sourceImageUrl,
        point_prompts: [{ x: pixelX, y: pixelY, label: 1 }],
        detection_threshold: 0.1,
      } as any,
      logs: true,
    });

    const segData = segResult.data as any;
    console.log('[sam3d] SAM 3 Image response keys:', segData ? Object.keys(segData) : 'null');

    const masks = segData?.masks || segData?.output?.masks || [];
    const bboxes = segData?.bboxes || segData?.output?.bboxes || [];
    const scores = segData?.confidence_scores || segData?.output?.confidence_scores || [];

    if (masks.length) {
      const maskUrl = typeof masks[0] === 'string' ? masks[0] : masks[0]?.url;
      if (maskUrl) maskPngBuffer = await downloadAsBuffer(maskUrl);
      if (bboxes.length) {
        const raw = bboxes[0];
        if (Array.isArray(raw)) boundingBox = { x: raw[0], y: raw[1], width: raw[2], height: raw[3] };
        else if (raw && typeof raw === 'object') boundingBox = raw;
      }
      confidence = scores[0] ?? 0.8;
    }
  } catch (segError: any) {
    console.warn('[sam3d] Segmentation failed (non-fatal), using placeholder mask', {
      tagId: req.tagId,
      error: extractFalError(segError),
    });
  }

  const bboxArea = boundingBox.width * boundingBox.height;
  const depthEstimate = Math.max(0, Math.min(1, 1 - bboxArea * 2));

  console.log('[sam3d] Tag-level complete', {
    tagId: req.tagId,
    glbSize: glbBuffer.length,
    maskSize: maskPngBuffer.length,
    confidence,
    depthEstimate,
  });

  return { glbBuffer, maskPngBuffer, confidence, boundingBox, depthEstimate };
}
