/**
 * Roboflow SAM 3D Client
 * 
 * Handles 2D → 3D generation via Roboflow's Meta SAM 3D API.
 * Supports both synchronous and asynchronous generation workflows.
 */

import {
  ROBOFLOW_SAM3D_ENDPOINT,
  ROBOFLOW_API_KEY,
  ROBOFLOW_SAM3D_POLL_INTERVAL_MS,
  ROBOFLOW_SAM3D_TIMEOUT_MS,
  validateRoboflowConfig,
} from '@/lib/config/roboflow';

export type Sam3DGenerationResult = {
  glbUrl: string;
  thumbnailUrl?: string;
  meta?: Record<string, any>;
};

export type Sam3DJobStatus = {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  jobId?: string;
  glbUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  meta?: Record<string, any>;
};

/**
 * Generate 3D model from a 2D image URL using Roboflow SAM 3D
 * 
 * @param imageUrl - URL of the source 2D image
 * @returns Promise resolving to 3D asset URLs and metadata
 * @throws Error if generation fails or configuration is invalid
 */
export async function generate3DFromImage(
  imageUrl: string
): Promise<Sam3DGenerationResult> {
  // Validate configuration
  const configCheck = validateRoboflowConfig();
  if (!configCheck.valid) {
    throw new Error(
      `Roboflow configuration incomplete. Missing: ${configCheck.missing.join(', ')}`
    );
  }

  try {
    // Step 1: Submit generation request
    const submitResponse = await fetch(ROBOFLOW_SAM3D_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ROBOFLOW_API_KEY}`,
      },
      body: JSON.stringify({
        image_url: imageUrl,
        // Add any additional parameters based on Roboflow API docs
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(
        `Roboflow API error: ${submitResponse.status} - ${errorText}`
      );
    }

    const submitData = await submitResponse.json();

    // Step 2: Check if response is synchronous or asynchronous
    // If jobId is present, poll for completion
    if (submitData.jobId || submitData.job_id) {
      const jobId = submitData.jobId || submitData.job_id;
      return await pollForCompletion(jobId);
    }

    // Step 3: If synchronous, extract URLs directly
    if (submitData.glbUrl || submitData.glb_url) {
      return {
        glbUrl: submitData.glbUrl || submitData.glb_url,
        thumbnailUrl: submitData.thumbnailUrl || submitData.thumbnail_url,
        meta: submitData.meta || {},
      };
    }

    throw new Error('Unexpected response format from Roboflow API');
  } catch (error: any) {
    console.error('Error generating 3D from image:', error);
    throw new Error(
      `Failed to generate 3D model: ${error.message || 'Unknown error'}`
    );
  }
}

/**
 * Poll for job completion
 * 
 * @param jobId - Job ID returned from initial request
 * @returns Promise resolving to 3D asset URLs and metadata
 */
async function pollForCompletion(jobId: string): Promise<Sam3DGenerationResult> {
  const startTime = Date.now();
  const pollEndpoint = `${ROBOFLOW_SAM3D_ENDPOINT}/${jobId}`;

  while (Date.now() - startTime < ROBOFLOW_SAM3D_TIMEOUT_MS) {
    try {
      const statusResponse = await fetch(pollEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ROBOFLOW_API_KEY}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusData: Sam3DJobStatus = await statusResponse.json();

      if (statusData.status === 'completed') {
        if (!statusData.glbUrl) {
          throw new Error('Job completed but no GLB URL returned');
        }

        return {
          glbUrl: statusData.glbUrl,
          thumbnailUrl: statusData.thumbnailUrl,
          meta: statusData.meta || {},
        };
      }

      if (statusData.status === 'failed') {
        throw new Error(
          statusData.error || '3D generation job failed'
        );
      }

      // Status is 'pending' or 'processing', wait and poll again
      await new Promise((resolve) =>
        setTimeout(resolve, ROBOFLOW_SAM3D_POLL_INTERVAL_MS)
      );
    } catch (error: any) {
      // If it's a final error (completed/failed), throw it
      if (error.message.includes('completed') || error.message.includes('failed')) {
        throw error;
      }
      // Otherwise, log and continue polling
      console.warn('Polling error (will retry):', error.message);
      await new Promise((resolve) =>
        setTimeout(resolve, ROBOFLOW_SAM3D_POLL_INTERVAL_MS)
      );
    }
  }

  throw new Error(
    `3D generation timed out after ${ROBOFLOW_SAM3D_TIMEOUT_MS}ms`
  );
}




