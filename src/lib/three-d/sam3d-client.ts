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
