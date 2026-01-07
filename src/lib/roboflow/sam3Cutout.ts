/**
 * Roboflow SAM 3 Cutout Integration Module
 * 
 * Server-only module for generating 2D cutout images from product images using Roboflow's SAM 3.
 * This module handles the communication with Roboflow's hosted workflow endpoint for mask visualization.
 */

'use server';

// Environment variable validation
const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
const ROBOFLOW_RUN_URL = process.env.ROBOFLOW_RUN_URL; // Workflow endpoint URL
const ROBOFLOW_TIMEOUT_MS = Number(process.env.ROBOFLOW_TIMEOUT_MS || '30000');

export type Sam3CutoutOptions = {
  prompt?: string; // Optional natural language prompt like "sofa", "chair"
};

export type Sam3CutoutResult = {
  cutoutBuffer: Buffer;
  cutoutFilename: string; // e.g. `${productId}-cutout.png`
  rawResponse?: unknown; // full Roboflow JSON for debugging
};

/**
 * Generate a 2D cutout from a product image using Roboflow SAM 3
 * 
 * @param imageUrl - URL of the product image
 * @param productId - Product ID for filename generation
 * @param options - Generation options including optional prompt
 * @returns Promise resolving to cutout buffer and filename
 * @throws Error if generation fails or configuration is invalid
 */
export async function generateProductCutoutFromImage(
  imageUrl: string,
  productId: string,
  options?: Sam3CutoutOptions
): Promise<Sam3CutoutResult> {
  // Validate environment variables
  if (!ROBOFLOW_API_KEY || !ROBOFLOW_RUN_URL) {
    throw new Error(
      `Missing required Roboflow configuration. ` +
      `Required: ROBOFLOW_API_KEY, ROBOFLOW_RUN_URL`
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
    const timeoutId = setTimeout(() => controller.abort(), ROBOFLOW_TIMEOUT_MS);

    // Build request body using exact Roboflow "Run Anywhere" JSON format
    // Default prompt is "main object" unless caller provides one
    const promptString = options?.prompt || 'main object';
    
    const requestBody = {
      api_key: ROBOFLOW_API_KEY,
      inputs: {
        image: { type: 'url', value: imageUrl },
        prompts: [promptString],
      },
    };

    // Make POST request to Roboflow workflow endpoint
    // Using exact format from Roboflow "Run Anywhere" curl example
    const response = await fetch(ROBOFLOW_RUN_URL, {
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
      console.error('[2D CUTOUT] Roboflow error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        imageUrl,
        productId,
        roboflowUrl: ROBOFLOW_RUN_URL ? 'configured' : 'MISSING',
      });
      throw new Error(
        `Roboflow SAM3 Cutout API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 500)}`
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
      const responsePreview = JSON.stringify(rawResponse, null, 2).substring(0, 2000);
      console.log('[2D CUTOUT] Roboflow response structure:', {
        keys: Object.keys(rawResponse),
        outputsType: Array.isArray(rawResponse.outputs) ? 'array' : typeof rawResponse.outputs,
        outputsLength: Array.isArray(rawResponse.outputs) ? rawResponse.outputs.length : 'N/A',
        outputsPreview: rawResponse.outputs ? JSON.stringify(rawResponse.outputs, null, 2).substring(0, 1500) : 'none',
        preview: responsePreview,
        fullResponse: rawResponse, // Include full response for detailed inspection
      });
      
      // Specifically inspect outputs array if it exists
      if (Array.isArray(rawResponse.outputs) && rawResponse.outputs.length > 0) {
        console.log('[2D CUTOUT] Inspecting outputs array:', {
          length: rawResponse.outputs.length,
          firstOutputKeys: rawResponse.outputs[0] ? Object.keys(rawResponse.outputs[0]) : [],
          firstOutputPreview: JSON.stringify(rawResponse.outputs[0], null, 2).substring(0, 1000),
          allOutputs: rawResponse.outputs.map((out: any, idx: number) => ({
            index: idx,
            keys: out ? Object.keys(out) : [],
            hasUrl: out?.url ? true : false,
            hasImageUrl: out?.image_url ? true : false,
            hasMaskVisualization: out?.mask_visualization ? true : false,
          })),
        });
      }
    }

    // Handle case where Roboflow returns a downloadable URL to the mask visualization
    // Try multiple possible field names based on Roboflow response patterns
    let maskVisualizationUrl: string | null = null;

    if (rawResponse && typeof rawResponse === 'object' && !rawResponse.isBinary) {
      // Try various possible field paths in order of likelihood
      // Based on Roboflow workflow output configurations
      const possiblePaths = [
        // Top-level outputs array - check mask_visualization.value (base64 data)
        ...(Array.isArray(rawResponse.outputs) ? rawResponse.outputs.map((out: any) => {
          // Check if mask_visualization exists and has a value field (base64 encoded)
          if (out?.mask_visualization?.value && typeof out.mask_visualization.value === 'string') {
            return out.mask_visualization.value;
          }
          // Also check for URL fields
          return out?.mask_visualization ||
                 out?.maskVisualization ||
                 out?.url ||
                 out?.image_url ||
                 out?.imageUrl ||
                 out?.output_url ||
                 out?.outputUrl ||
                 out?.mask_url ||
                 out?.maskUrl;
        }).filter(Boolean) : []),
        // Top-level outputs object (if not array)
        rawResponse.outputs?.mask_visualization,
        rawResponse.outputs?.maskVisualization,
        rawResponse.outputs?.url,
        rawResponse.outputs?.image_url,
        // Standard workflow outputs with data wrapper
        rawResponse.data?.outputs?.mask_visualization,
        rawResponse.data?.outputs?.[0]?.mask_visualization,
        rawResponse.data?.outputs?.[0]?.url,
        rawResponse.data?.outputs?.[0]?.image_url,
        rawResponse.data?.outputs?.[0]?.imageUrl,
        rawResponse.data?.mask_visualization,
        rawResponse.data?.maskVisualization,
        rawResponse.data?.mask_url,
        rawResponse.data?.maskUrl,
        // Direct response fields
        rawResponse.mask_visualization,
        rawResponse.maskVisualization,
        rawResponse.mask_url,
        rawResponse.maskUrl,
        rawResponse.url,
        rawResponse.image_url,
        rawResponse.imageUrl,
        rawResponse.output_url,
        rawResponse.outputUrl,
        // Predictions structure
        rawResponse.data?.predictions?.[0]?.mask_visualization,
        rawResponse.predictions?.[0]?.mask_visualization,
        rawResponse.predictions?.[0]?.url,
        // Output arrays (legacy)
        rawResponse.output?.[0]?.mask_visualization,
        rawResponse.output?.[0]?.maskVisualization,
        rawResponse.output?.[0]?.url,
        // Nested structures
        rawResponse.data?.result?.mask_visualization,
        rawResponse.result?.mask_visualization,
        rawResponse.data?.result?.url,
        rawResponse.result?.url,
        // Overlay variants
        rawResponse.data?.outputs?.[0]?.overlay,
        rawResponse.overlay,
      ];

      for (const path of possiblePaths) {
        if (path && typeof path === 'string' && path.length > 0) {
          maskVisualizationUrl = path;
          console.log('[2D CUTOUT] Found mask visualization URL:', {
            path: path.substring(0, 100),
            foundIn: 'one of the standard paths',
          });
          break;
        }
      }

      // If no direct match, search recursively for any field containing a URL ending with image extensions
      // Also check if outputs contains base64 image data
      if (!maskVisualizationUrl) {
        // First, specifically check outputs array for base64 data
        if (Array.isArray(rawResponse.outputs)) {
          for (let i = 0; i < rawResponse.outputs.length; i++) {
            const output = rawResponse.outputs[i];
            if (output && typeof output === 'object') {
              // Check for base64 fields
              for (const [key, value] of Object.entries(output)) {
                if (typeof value === 'string' && value.length > 100) {
                  // Could be base64 image data
                  if (
                    key.toLowerCase().includes('base64') ||
                    key.toLowerCase().includes('image') ||
                    key.toLowerCase().includes('mask') ||
                    key.toLowerCase().includes('data')
                  ) {
                    console.log('[2D CUTOUT] Found potential base64 data in outputs:', {
                      index: i,
                      key,
                      length: value.length,
                      preview: value.substring(0, 50),
                    });
                  }
                }
              }
            }
          }
        }
        
        const findImageUrl = (obj: any, depth = 0, path = ''): string | null => {
          if (depth > 6 || !obj || typeof obj !== 'object') return null;
          
          for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            
            if (typeof value === 'string') {
              // Check if it's a URL (http/https) or data URI, or ends with image extension
              if (
                value.startsWith('http://') ||
                value.startsWith('https://') ||
                value.startsWith('data:image/') ||
                value.match(/\.(png|jpg|jpeg|gif|webp)$/i)
              ) {
                console.log('[2D CUTOUT] Found potential image URL in response:', {
                  path: currentPath,
                  url: value.substring(0, 100),
                });
                return value;
              }
            }
            
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              const found = findImageUrl(value, depth + 1, currentPath);
              if (found) return found;
            } else if (Array.isArray(value)) {
              // Search array items
              for (let i = 0; i < value.length; i++) {
                const found = findImageUrl(value[i], depth + 1, `${currentPath}[${i}]`);
                if (found) return found;
              }
            }
          }
          return null;
        };
        
        maskVisualizationUrl = findImageUrl(rawResponse);
      }
    }

    // Handle base64-encoded image data in response
    // Specifically check outputs[].mask_visualization.value structure
    let base64Image: string | null = null;
    if (rawResponse && typeof rawResponse === 'object' && !rawResponse.isBinary) {
      // First, check the specific structure: outputs[0].mask_visualization.value
      if (Array.isArray(rawResponse.outputs) && rawResponse.outputs.length > 0) {
        for (const output of rawResponse.outputs) {
          if (output?.mask_visualization?.value && typeof output.mask_visualization.value === 'string') {
            const base64Value = output.mask_visualization.value;
            // Check if it's already a data URI or raw base64
            if (base64Value.startsWith('data:image/')) {
              base64Image = base64Value;
            } else if (base64Value.length > 100) {
              // Raw base64 - determine image type from base64 signature
              // JPEG starts with /9j/, PNG starts with iVBORw0KGgo, etc.
              let mimeType = 'image/png'; // default
              if (base64Value.startsWith('/9j/')) {
                mimeType = 'image/jpeg';
              } else if (base64Value.startsWith('iVBORw0KGgo')) {
                mimeType = 'image/png';
              }
              base64Image = `data:${mimeType};base64,${base64Value}`;
            }
            
            if (base64Image) {
              console.log('[2D CUTOUT] Found base64 image in mask_visualization.value:', {
                type: output.mask_visualization.type,
                length: base64Value.length,
                mimeType: base64Image.startsWith('data:image/') ? base64Image.split(';')[0] : 'unknown',
              });
              break;
            }
          }
        }
      }
      
      // Fallback: search recursively for base64 data
      if (!base64Image) {
        const findBase64 = (obj: any, depth = 0): string | null => {
          if (depth > 6 || !obj || typeof obj !== 'object') return null;
          
          for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
              // Check if it's a base64 data URI
              if (value.startsWith('data:image/')) {
                return value;
              }
              // Check if it's raw base64 (might be in fields like 'base64', 'image_data', etc.)
              if (key.toLowerCase().includes('base64') || key.toLowerCase().includes('image_data')) {
                if (value.length > 100) { // Likely base64 image data
                  // Determine mime type from base64 signature
                  let mimeType = 'image/png';
                  if (value.startsWith('/9j/')) {
                    mimeType = 'image/jpeg';
                  } else if (value.startsWith('iVBORw0KGgo')) {
                    mimeType = 'image/png';
                  }
                  return value.startsWith('data:') ? value : `data:${mimeType};base64,${value}`;
                }
              }
            }
            if (typeof value === 'object' && value !== null) {
              const found = findBase64(value, depth + 1);
              if (found) return found;
            }
          }
          return null;
        };
        
        base64Image = findBase64(rawResponse);
        if (base64Image) {
          console.log('[2D CUTOUT] Found base64 image data in response (fallback search)');
        }
      }
    }

    if (maskVisualizationUrl && typeof maskVisualizationUrl === 'string') {
      try {
        // Fetch the mask visualization image from the URL
        const maskResponse = await fetch(maskVisualizationUrl, {
          signal: controller.signal,
        });

        if (!maskResponse.ok) {
          throw new Error(`Failed to fetch mask visualization from URL: ${maskResponse.status} ${maskResponse.statusText}`);
        }

        const cutoutBuffer = Buffer.from(await maskResponse.arrayBuffer());
        const cutoutFilename = `${productId}-cutout.png`;

        console.log('[2D CUTOUT] Successfully fetched mask visualization from URL:', {
          url: maskVisualizationUrl.substring(0, 100),
          bufferSize: cutoutBuffer.length,
        });

        return {
          cutoutBuffer,
          cutoutFilename,
          rawResponse: { maskVisualizationUrl, ...rawResponse },
        };
      } catch (fetchError: any) {
        console.error('[2D CUTOUT] Failed to fetch mask visualization URL:', {
          url: maskVisualizationUrl.substring(0, 100),
          error: fetchError.message,
        });
        // Continue to try base64 or other methods
      }
    }

    // Handle base64-encoded image
    if (base64Image) {
      try {
        // Extract base64 data from data URI if present
        const base64Data = base64Image.includes(',')
          ? base64Image.split(',')[1]
          : base64Image;
        
        const cutoutBuffer = Buffer.from(base64Data, 'base64');
        const cutoutFilename = `${productId}-cutout.png`;

        console.log('[2D CUTOUT] Successfully decoded base64 image data:', {
          bufferSize: cutoutBuffer.length,
        });

        return {
          cutoutBuffer,
          cutoutFilename,
          rawResponse: { base64Found: true, ...rawResponse },
        };
      } catch (base64Error: any) {
        console.error('[2D CUTOUT] Failed to decode base64 image:', {
          error: base64Error.message,
        });
      }
    }

    // Handle case where Roboflow returns raw PNG bytes directly
    if (rawResponse.isBinary && rawResponse.buffer) {
      const cutoutFilename = `${productId}-cutout.png`;
      return {
        cutoutBuffer: rawResponse.buffer,
        cutoutFilename,
        rawResponse: { contentType: response.headers.get('content-type') },
      };
    }

    // If response is JSON but doesn't have expected structure, log full response and throw
    const responseSummary = rawResponse && typeof rawResponse === 'object' && !rawResponse.isBinary
      ? {
          keys: Object.keys(rawResponse),
          stringified: JSON.stringify(rawResponse, null, 2).substring(0, 3000),
          fullResponse: rawResponse, // Include for detailed inspection
        }
      : { type: typeof rawResponse, isBinary: rawResponse?.isBinary };

    console.error('[2D CUTOUT] Roboflow response does not contain mask_visualization URL:', {
      contentType: response.headers.get('content-type'),
      hasMaskVisualization: !!maskVisualizationUrl,
      imageUrl,
      productId,
      responseSummary,
      // Also log the request we sent for debugging
      requestBody: {
        hasImageUrl: !!requestBody.inputs.image.value,
        prompt: requestBody.inputs.prompts[0],
      },
    });

    throw new Error(
      `Roboflow response does not contain a mask_visualization URL. ` +
      `Response keys: ${rawResponse && typeof rawResponse === 'object' ? Object.keys(rawResponse).join(', ') : 'unknown'}. ` +
      `Check server logs for full response structure. ` +
      `Ensure your Roboflow workflow has a "Mask Visualization" output block configured.`
    );
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Roboflow SAM3 Cutout request timed out after ${ROBOFLOW_TIMEOUT_MS}ms`);
    }

    console.error('[Roboflow SAM3 Cutout] Generation error:', {
      imageUrl,
      productId,
      error: error.message,
      stack: error.stack,
    });

    throw new Error(
      `Failed to generate 2D cutout: ${error.message || 'Unknown error'}`
    );
  }
}

