/**
 * SAM 3D Inference Client — Stub
 *
 * This module defines the interface for calling a GPU-hosted SAM 3D service
 * that converts a 2D product image into a .glb mesh file.
 *
 * Currently stubbed. Replace the implementation body with your chosen
 * provider once provisioned:
 *   - Option A: Modal (https://modal.com)
 *   - Option B: Replicate (https://replicate.com)
 *   - Option C: Self-hosted RunPod / GPU endpoint
 *
 * The service should:
 *   1. Download the image from imageUrl
 *   2. Run SAM segmentation to isolate the product
 *   3. Run 3D reconstruction (SAM 3D / TripoSR / similar)
 *   4. Export to .glb format
 *   5. Return the binary buffer
 */

export interface Sam3DRequest {
  imageUrl: string;
  productId: string;
  prompt?: string;
}

export interface Sam3DResponse {
  glbBuffer: Buffer;
  confidence: number;
}

// --- Tag-level interface (per-tag mask + mesh from room photo) ---

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

export async function callSam3DTagService(_req: Sam3DTagRequest): Promise<Sam3DTagResponse> {
  const endpoint = process.env.SAM3D_ENDPOINT;

  if (!endpoint) {
    throw new Error(
      'SAM 3D tag service not yet configured. Set SAM3D_ENDPOINT in environment.'
    );
  }

  // Once configured, the service should:
  // 1. Download source image from req.sourceImageUrl
  // 2. Run SAM segmentation at (req.tagX, req.tagY) point prompt
  // 3. Extract product mask as PNG
  // 4. Run SAM 3D Objects on the masked region
  // 5. Export .glb mesh + compute bounding box + depth estimate
  // 6. Return all outputs

  throw new Error(
    'SAM 3D tag service not yet configured. Set SAM3D_ENDPOINT in environment.'
  );
}

// --- Product-level interface (mesh from product hero image) ---

export async function callSam3DService(_req: Sam3DRequest): Promise<Sam3DResponse> {
  const endpoint = process.env.SAM3D_ENDPOINT;

  if (!endpoint) {
    throw new Error(
      'SAM 3D service not yet configured. Set SAM3D_ENDPOINT in environment.'
    );
  }

  // Once an endpoint is configured, implement the call here:
  // const response = await fetch(endpoint, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ image_url: req.imageUrl, prompt: req.prompt }),
  // });
  // const buffer = Buffer.from(await response.arrayBuffer());
  // return { glbBuffer: buffer, confidence: 1.0 };

  throw new Error(
    'SAM 3D service not yet configured. Set SAM3D_ENDPOINT in environment.'
  );
}
