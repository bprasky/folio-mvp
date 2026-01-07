/**
 * Client-side utility for generating 2D cutout assets
 */

export type Generate2DCutoutsResponse = {
  success: boolean;
  projectId: string;
  message?: string;
  processedCount?: number; // Count of products that actually had cutouts generated this run
  skippedCount?: number;  // Products skipped because cutoutImageUrl already existed
  stats?: {
    attempted: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  results: Array<{
    productId: string;
    status: 'success' | 'skipped' | 'failed';
    reason?: 'already_has_cutout';
    cutoutUrl?: string;
    error?: string;
  }>;
  summary?: {
    success: number;
    skipped: number;
    failed: number;
  };
  error?: string;
};

export async function generate2dCutoutsForProject(
  projectId: string,
  options?: {
    productIds?: string[];
    promptOverride?: string;
    force?: boolean; // If true, regenerate cutouts even if they already exist
  }
): Promise<Generate2DCutoutsResponse> {
  const search = options?.force ? "?force=true" : "";
  const response = await fetch(`/api/projects/${projectId}/generate-2d-cutouts${search}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productIds: options?.productIds,
      promptOverride: options?.promptOverride,
    }),
  });

  // API now returns 200 even on failures (soft failure for demo robustness)
  const data = await response.json();

  // If response was not ok, or if success is false, treat as warning but don't throw
  if (!response.ok) {
    console.warn('[generate2dCutouts] API returned non-200:', {
      status: response.status,
      data,
    });
  }

  return data;
}

