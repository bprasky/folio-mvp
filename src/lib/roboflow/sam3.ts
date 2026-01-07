/**
 * Roboflow SAM 3 Integration Module
 * 
 * Server-only module for generating 3D meshes from product images using Roboflow's SAM 3.
 * This module handles the communication with Roboflow's hosted model endpoint.
 */

'use server';

import { requireEnv } from '@/lib/env';

// Environment variable validation
const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
const ROBOFLOW_SAM3_ENDPOINT = process.env.ROBOFLOW_SAM3_ENDPOINT;
const ROBOFLOW_TIMEOUT_MS = Number(process.env.ROBOFLOW_TIMEOUT_MS || '30000');

export type Sam3Options = {
  prompt: string;
  // Optional future fields: maskOnly, meshFormat, etc.
};

export type Sam3Result = {
  meshBuffer: Buffer;
  meshFilename: string;
  rawResponse?: unknown;
};

/**
 * Generate a 3D mesh from a product image using Roboflow SAM 3
 * 
 * @param imageUrl - URL of the product image
 * @param options - Generation options including prompt
 * @returns Promise resolving to mesh buffer and filename
 * @throws Error if generation fails or configuration is invalid
 */
export async function generateProductMeshFromImage(
  imageUrl: string,
  options: Sam3Options
): Promise<Sam3Result> {
  // Validate environment variables
  if (!ROBOFLOW_API_KEY || !ROBOFLOW_SAM3_ENDPOINT) {
    throw new Error(
      `Missing required Roboflow configuration. ` +
      `Required: ROBOFLOW_API_KEY, ROBOFLOW_SAM3_ENDPOINT`
    );
  }

  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('Invalid imageUrl: must be a non-empty string');
  }

  try {
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ROBOFLOW_TIMEOUT_MS);

    // Make POST request to Roboflow SAM-3 endpoint
    const response = await fetch(ROBOFLOW_SAM3_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ROBOFLOW_API_KEY}`,
      },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt: options.prompt,
        // Add any additional parameters based on Roboflow API docs
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[Roboflow SAM3] API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(
        `Roboflow SAM3 API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const rawResponse = await response.json().catch(async () => {
      // If JSON parsing fails, might be binary response
      const buffer = Buffer.from(await response.arrayBuffer());
      return { buffer, isBinary: true };
    });

    // Handle case where Roboflow returns a downloadable URL
    if (rawResponse && !rawResponse.isBinary && typeof rawResponse === 'object') {
      const meshUrl = rawResponse.mesh_url || rawResponse.meshUrl || rawResponse.url;
      
      if (meshUrl && typeof meshUrl === 'string') {
        // Fetch the mesh file from the URL
        const meshResponse = await fetch(meshUrl, {
          signal: controller.signal,
        });

        if (!meshResponse.ok) {
          throw new Error(`Failed to fetch mesh from URL: ${meshResponse.status}`);
        }

        const meshBuffer = Buffer.from(await meshResponse.arrayBuffer());
        const contentDisposition = meshResponse.headers.get('content-disposition');
        let meshFilename = 'mesh.glb'; // default

        // Try to extract filename from content-disposition header
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch && filenameMatch[1]) {
            meshFilename = filenameMatch[1].replace(/['"]/g, '');
          }
        }

        // Infer filename from content-type if not found
        if (meshFilename === 'mesh.glb') {
          if (contentType.includes('gltf') || contentType.includes('glb')) {
            meshFilename = 'mesh.glb';
          } else if (contentType.includes('obj')) {
            meshFilename = 'mesh.obj';
          }
        }

        return {
          meshBuffer,
          meshFilename,
          rawResponse: { meshUrl, contentType },
        };
      }
    }

    // Handle case where Roboflow returns raw bytes directly
    if (rawResponse.isBinary && rawResponse.buffer) {
      let meshFilename = 'mesh.glb';
      if (contentType.includes('obj')) {
        meshFilename = 'mesh.obj';
      }

      return {
        meshBuffer: rawResponse.buffer,
        meshFilename,
        rawResponse: { contentType },
      };
    }

    // If response is JSON but doesn't have expected structure, log and throw
    console.error('[Roboflow SAM3] Unexpected response format:', {
      contentType,
      hasMeshUrl: !!(rawResponse?.mesh_url || rawResponse?.meshUrl),
      keys: rawResponse && typeof rawResponse === 'object' ? Object.keys(rawResponse) : [],
    });

    throw new Error(
      'Unexpected response format from Roboflow SAM3 API. ' +
      'Expected mesh_url or binary data, but received: ' +
      JSON.stringify(rawResponse).substring(0, 200)
    );
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Roboflow SAM3 request timed out after ${ROBOFLOW_TIMEOUT_MS}ms`);
    }

    console.error('[Roboflow SAM3] Generation error:', {
      imageUrl,
      error: error.message,
      stack: error.stack,
    });

    throw new Error(
      `Failed to generate 3D mesh: ${error.message || 'Unknown error'}`
    );
  }
}




