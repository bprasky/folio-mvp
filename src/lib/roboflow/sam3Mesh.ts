/**
 * Roboflow SAM-3D Mesh Integration Module
 * 
 * Server-only module for generating 3D meshes from product images using Roboflow's SAM-3D Run Anywhere workflow.
 * This module handles the communication with Roboflow's hosted workflow endpoint for 3D mesh generation.
 */

'use server';

// Environment variable validation
const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
const ROBOFLOW_SAM3D_ENDPOINT = process.env.ROBOFLOW_SAM3D_ENDPOINT;
const ROBOFLOW_SAM3D_TIMEOUT_MS = Number(process.env.ROBOFLOW_SAM3D_TIMEOUT_MS || '60000');

export type Sam3MeshOptions = {
  prompt?: string; // Optional natural language hint, like "sofa", "chair", "lamp"
};

export type Sam3MeshResult = {
  meshBuffer: Buffer;
  meshFilename: string;      // e.g. `${productId}-sam3d.glb`
  meshMimeType: string;      // e.g. "model/gltf-binary" or "application/octet-stream"
  rawResponse?: unknown;     // raw JSON (or text) for debugging
};

/**
 * Generate a 3D mesh from a product image using Roboflow SAM-3D
 * 
 * @param imageUrl - URL of the product image
 * @param productId - Product ID for filename generation
 * @param options - Generation options including optional prompt
 * @returns Promise resolving to mesh buffer, filename, and mime type
 * @throws Error if generation fails or configuration is invalid
 */
export async function generateProductMeshFromImageUrl(
  imageUrl: string,
  productId: string,
  options?: Sam3MeshOptions
): Promise<Sam3MeshResult> {
  // Validate environment variables
  if (!ROBOFLOW_API_KEY || !ROBOFLOW_SAM3D_ENDPOINT) {
    throw new Error(
      `Missing required Roboflow configuration. ` +
      `Required: ROBOFLOW_API_KEY, ROBOFLOW_SAM3D_ENDPOINT`
    );
  }

  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('Invalid imageUrl: must be a non-empty string');
  }

  if (!productId || typeof productId !== 'string') {
    throw new Error('Invalid productId: must be a non-empty string');
  }

  try {
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ROBOFLOW_SAM3D_TIMEOUT_MS);

    // Build request body using exact Roboflow "Run Anywhere" JSON format
    // Default prompt is "furniture product" unless caller provides one
    const promptString = options?.prompt || 'furniture product';
    
    const requestBody = {
      api_key: ROBOFLOW_API_KEY,
      inputs: {
        image: { type: 'url', value: imageUrl },
        prompts: [promptString],
      },
    };

    // Make POST request to Roboflow workflow endpoint
    // Using exact format from Roboflow "Run Anywhere" curl example
    const response = await fetch(ROBOFLOW_SAM3D_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '<no body>');
      console.error('[SAM-3D MESH] Roboflow error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        imageUrl,
        productId,
        roboflowUrl: ROBOFLOW_SAM3D_ENDPOINT ? 'configured' : 'MISSING',
      });
      throw new Error(
        `Roboflow SAM-3D Mesh API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 500)}`
      );
    }

    // Parse JSON response
    let rawResponse: any;
    try {
      rawResponse = await response.json();
    } catch (jsonError) {
      // If JSON parsing fails, might be binary response
      const buffer = Buffer.from(await response.arrayBuffer());
      rawResponse = { buffer, isBinary: true };
    }

    // Log full response structure for debugging (safe stringification)
    if (rawResponse && typeof rawResponse === 'object' && !rawResponse.isBinary) {
      console.debug('[SAM-3D MESH] Raw Roboflow response keys:', Object.keys(rawResponse));
    }

    // Helper to try multiple candidate fields for mesh URL
    const findMeshUrl = (data: any): string | null => {
      if (!data || typeof data !== 'object') return null;

      // Try various possible field paths in order of likelihood
      const possiblePaths = [
        // Top-level fields
        data.mesh_url,
        data.meshUrl,
        // Outputs array
        data.outputs?.[0]?.mesh_url,
        data.outputs?.[0]?.mesh,
        // Predictions array
        data.predictions?.[0]?.mesh_url,
        data.predictions?.[0]?.mesh,
        // Data wrapper
        data.data?.mesh_url,
        data.data?.meshUrl,
        data.data?.outputs?.[0]?.mesh_url,
        data.data?.outputs?.[0]?.mesh,
        data.data?.predictions?.[0]?.mesh_url,
        data.data?.predictions?.[0]?.mesh,
      ];

      for (const path of possiblePaths) {
        if (path && typeof path === 'string' && path.length > 0) {
          return path;
        }
      }

      // Search recursively for any string field that ends with .glb or .obj
      const findUrlRecursive = (obj: any, depth = 0): string | null => {
        if (depth > 6 || !obj || typeof obj !== 'object') return null;
        
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string') {
            // Check if it's a URL (http/https) or ends with mesh extension
            if (
              (value.startsWith('http://') || value.startsWith('https://')) &&
              (value.match(/\.(glb|obj)$/i))
            ) {
              return value;
            }
          }
          
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const found = findUrlRecursive(value, depth + 1);
            if (found) return found;
          } else if (Array.isArray(value)) {
            // Search array items
            for (let i = 0; i < value.length; i++) {
              const found = findUrlRecursive(value[i], depth + 1);
              if (found) return found;
            }
          }
        }
        return null;
      };

      return findUrlRecursive(data);
    };

    // Try to find mesh URL in response
    const meshUrl = findMeshUrl(rawResponse);

    if (meshUrl) {
      // Fetch the mesh file from the URL
      const meshResponse = await fetch(meshUrl, {
        signal: controller.signal,
      });

      if (!meshResponse.ok) {
        throw new Error(`Failed to fetch mesh from URL: ${meshResponse.status} ${meshResponse.statusText}`);
      }

      // Get Content-Type from response headers, defaulting to "application/octet-stream"
      const contentType = meshResponse.headers.get('content-type') || 'application/octet-stream';
      
      // Buffer the response
      const meshBuffer = Buffer.from(await meshResponse.arrayBuffer());

      // Infer filename extension from the URL (".glb" or ".obj"). Default ".glb"
      let ext = '.glb';
      if (meshUrl.toLowerCase().endsWith('.obj')) {
        ext = '.obj';
      } else if (meshUrl.toLowerCase().endsWith('.glb')) {
        ext = '.glb';
      }

      // Determine MIME type
      let meshMimeType = 'application/octet-stream';
      if (contentType.includes('gltf') || contentType.includes('glb')) {
        meshMimeType = 'model/gltf-binary';
      } else if (contentType.includes('obj')) {
        meshMimeType = 'model/obj';
      } else if (contentType.startsWith('model/')) {
        meshMimeType = contentType;
      }

      console.log('[SAM-3D MESH] Successfully fetched mesh from URL:', {
        url: meshUrl.substring(0, 100),
        bufferSize: meshBuffer.length,
        mimeType: meshMimeType,
      });

      return {
        meshBuffer,
        meshFilename: `${productId}-sam3d${ext}`,
        meshMimeType,
        rawResponse: { meshUrl, ...rawResponse },
      };
    }

    // If no mesh URL is found and the content-type from the original response
    // indicates a binary model (e.g. model/* or application/octet-stream),
    // treat the original response body as the mesh buffer
    const originalContentType = response.headers.get('content-type') || '';
    if (
      originalContentType.startsWith('model/') ||
      originalContentType === 'application/octet-stream' ||
      rawResponse.isBinary
    ) {
      let meshBuffer: Buffer;
      let meshMimeType = 'application/octet-stream';
      let ext = '.glb';

      if (rawResponse.isBinary && rawResponse.buffer) {
        meshBuffer = rawResponse.buffer;
      } else {
        // Re-fetch as array buffer if we already consumed it
        const bufferResponse = await fetch(ROBOFLOW_SAM3D_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        meshBuffer = Buffer.from(await bufferResponse.arrayBuffer());
      }

      // Determine MIME type and extension from content-type
      if (originalContentType.includes('gltf') || originalContentType.includes('glb')) {
        meshMimeType = 'model/gltf-binary';
        ext = '.glb';
      } else if (originalContentType.includes('obj')) {
        meshMimeType = 'model/obj';
        ext = '.obj';
      } else if (originalContentType.startsWith('model/')) {
        meshMimeType = originalContentType;
        ext = '.glb'; // default
      }

      console.log('[SAM-3D MESH] Successfully received binary mesh:', {
        bufferSize: meshBuffer.length,
        mimeType: meshMimeType,
      });

      return {
        meshBuffer,
        meshFilename: `${productId}-sam3d${ext}`,
        meshMimeType,
        rawResponse: { contentType: originalContentType, isBinary: true },
      };
    }

    // If neither path yields anything, throw
    const responseSummary = rawResponse && typeof rawResponse === 'object' && !rawResponse.isBinary
      ? {
          keys: Object.keys(rawResponse),
          stringified: JSON.stringify(rawResponse, null, 2).substring(0, 3000),
        }
      : { type: typeof rawResponse, isBinary: rawResponse?.isBinary };

    console.error('[SAM-3D MESH] Roboflow response does not contain a mesh URL or binary model data:', {
      contentType: response.headers.get('content-type'),
      hasMeshUrl: !!meshUrl,
      imageUrl,
      productId,
      responseSummary,
      requestBody: {
        hasImageUrl: !!requestBody.inputs.image.value,
        prompt: requestBody.inputs.prompts[0],
      },
    });

    throw new Error(
      `[sam3Mesh] Roboflow response does not contain a mesh URL or binary model data. ` +
      `Response keys: ${rawResponse && typeof rawResponse === 'object' ? Object.keys(rawResponse).join(', ') : 'unknown'}. ` +
      `Check server logs for full response structure. ` +
      `Ensure your Roboflow workflow has a mesh output configured.`
    );
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Roboflow SAM-3D Mesh request timed out after ${ROBOFLOW_SAM3D_TIMEOUT_MS}ms`);
    }

    console.error('[Roboflow SAM-3D Mesh] Generation error:', {
      imageUrl,
      productId,
      error: error.message,
      stack: error.stack,
    });

    throw new Error(
      `Failed to generate 3D mesh: ${error.message || 'Unknown error'}`
    );
  }
}




