/**
 * Client-side utility for generating 3D assets
 */

export type Generate3DAssetsResponse = {
  success?: boolean;
  projectId: string;
  processedCount: number; // Count of products that actually had meshes generated this run
  skippedCount: number;  // Products skipped because threeDAssetUrl already existed
  results: Array<{
    productId: string;
    status: 'success' | 'skipped' | 'failed';
    reason?: 'already_has_mesh';
    meshUrl?: string;
    error?: string;
  }>;
  stats?: {
    attempted: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  summary?: {
    success: number;
    skipped: number;
    failed: number;
  };
  message?: string;
  error?: string;
};

export async function generate3DAssetsForProject(
  projectId: string,
  options?: {
    productIds?: string[];
    promptOverride?: string;
  }
): Promise<Generate3DAssetsResponse> {
  const response = await fetch(`/api/projects/${projectId}/generate-3d-assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productIds: options?.productIds,
      promptOverride: options?.promptOverride,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}

