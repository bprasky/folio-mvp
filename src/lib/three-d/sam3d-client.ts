/**
 * SAM 3D Inference Client — fal.ai
 *
 * Converts 2D product images into .glb mesh files using fal.ai hosted models:
 *   - Product-level: TripoSR (fal-ai/triposr) — single image → 3D mesh
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

// --- Product-level: TripoSR (single product image → 3D mesh) ---

export async function callSam3DService(req: Sam3DRequest): Promise<Sam3DResponse> {
  ensureFalKey();

  console.log('[sam3d] Product-level generation starting', {
    productId: req.productId,
    imageUrl: req.imageUrl.substring(0, 80),
  });

  try {
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

    const data = result.data as any;
    const glbUrl = data?.model_mesh?.url || data?.model_url || data?.output?.url;

    if (!glbUrl) {
      throw new Error(`TripoSR returned no GLB. Keys: ${data ? Object.keys(data).join(',') : 'null'}`);
    }

    const glbBuffer = await downloadAsBuffer(glbUrl);

    console.log('[sam3d] Product-level complete', { productId: req.productId, glbSize: glbBuffer.length });
    return { glbBuffer, confidence: 1.0 };
  } catch (error: any) {
    throw new Error(`TripoSR failed: ${extractFalError(error)}`);
  }
}

// --- Tag-level: SAM 3D Objects (segmentation + 3D in one call) ---

export async function callSam3DTagService(req: Sam3DTagRequest): Promise<Sam3DTagResponse> {
  ensureFalKey();

  const prompt = req.prompt || 'furniture product';

  console.log('[sam3d] Tag-level generation starting', {
    tagId: req.tagId,
    productId: req.productId,
    tagX: req.tagX,
    tagY: req.tagY,
    prompt,
    sourceImageUrl: req.sourceImageUrl.substring(0, 80),
  });

  // Step 1: Generate 3D mesh using SAM 3D Objects with text prompt
  // This model handles segmentation + 3D reconstruction in a single call
  let meshData: any;
  try {
    const meshResult = await fal.subscribe('fal-ai/sam-3/3d-objects', {
      input: {
        image_url: req.sourceImageUrl,
        prompt,
      } as any,
      logs: true,
    });
    meshData = meshResult.data as any;
  } catch (error: any) {
    const detail = extractFalError(error);
    console.error('[sam3d] SAM 3D Objects failed', { tagId: req.tagId, error: detail });
    throw new Error(`SAM 3D Objects failed: ${detail}`);
  }

  console.log('[sam3d] SAM 3D Objects response keys:', meshData ? Object.keys(meshData) : 'null');

  // Extract GLB URL — try multiple possible response shapes
  const glbUrl = meshData?.model_mesh?.url
    || meshData?.model_url
    || meshData?.glb?.url
    || meshData?.output?.url
    || meshData?.mesh?.url;

  if (!glbUrl) {
    const preview = JSON.stringify(meshData).substring(0, 500);
    console.error('[sam3d] No GLB URL in response', { tagId: req.tagId, data: preview });
    throw new Error(`SAM 3D Objects returned no GLB. Response: ${preview}`);
  }

  const glbBuffer = await downloadAsBuffer(glbUrl);

  // Step 2: Get segmentation mask using SAM 3 Image
  let maskPngBuffer: Buffer;
  let boundingBox = { x: 0.5, y: 0.5, width: 0.5, height: 0.5 };
  let confidence = 0.8;

  try {
    const segResult = await fal.subscribe('fal-ai/sam-3/image', {
      input: {
        image_url: req.sourceImageUrl,
        prompt,
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
      if (maskUrl) {
        maskPngBuffer = await downloadAsBuffer(maskUrl);
      } else {
        // Create a 1x1 transparent PNG as placeholder
        maskPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      }

      if (bboxes.length) {
        const rawBbox = bboxes[0];
        if (Array.isArray(rawBbox)) {
          boundingBox = { x: rawBbox[0], y: rawBbox[1], width: rawBbox[2], height: rawBbox[3] };
        } else if (rawBbox && typeof rawBbox === 'object') {
          boundingBox = rawBbox;
        }
      }
      confidence = scores[0] ?? 0.8;
    } else {
      console.warn('[sam3d] No masks returned, using placeholder', { tagId: req.tagId });
      maskPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    }
  } catch (segError: any) {
    // Segmentation failure is non-fatal — we still have the 3D mesh
    console.warn('[sam3d] Segmentation failed, using placeholder mask', {
      tagId: req.tagId,
      error: extractFalError(segError),
    });
    maskPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  }

  // Estimate depth from bounding box area
  const bboxArea = boundingBox.width * boundingBox.height;
  const depthEstimate = Math.max(0, Math.min(1, 1 - bboxArea * 2));

  console.log('[sam3d] Tag-level generation complete', {
    tagId: req.tagId,
    glbSize: glbBuffer.length,
    maskSize: maskPngBuffer.length,
    confidence,
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
