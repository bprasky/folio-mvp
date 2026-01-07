/**
 * Roboflow SAM 3D Configuration
 * 
 * Environment variables required:
 * - ROBOFLOW_API_KEY: Your Roboflow API key
 * - ROBOFLOW_SAM3D_ENDPOINT: Full endpoint URL for SAM 3D API
 *   Example: https://api.roboflow.com/YOUR_WORKSPACE/YOUR_PROJECT/sam-3d
 * - ROBOFLOW_SAM3D_POLL_INTERVAL_MS: Polling interval in milliseconds (default: 3000)
 * - ROBOFLOW_SAM3D_TIMEOUT_MS: Timeout in milliseconds (default: 60000)
 * - ASSET_STORAGE_BUCKET_URL: Base URL for asset storage (optional)
 */

export const ROBOFLOW_SAM3D_ENDPOINT = process.env.ROBOFLOW_SAM3D_ENDPOINT || '';
export const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY || '';
export const ROBOFLOW_SAM3D_POLL_INTERVAL_MS = Number(
  process.env.ROBOFLOW_SAM3D_POLL_INTERVAL_MS ?? 3000
);
export const ROBOFLOW_SAM3D_TIMEOUT_MS = Number(
  process.env.ROBOFLOW_SAM3D_TIMEOUT_MS ?? 60000
);
export const ASSET_STORAGE_BUCKET_URL = process.env.ASSET_STORAGE_BUCKET_URL || '';

/**
 * Validate that required Roboflow configuration is present
 */
export function validateRoboflowConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!ROBOFLOW_API_KEY) {
    missing.push('ROBOFLOW_API_KEY');
  }
  
  if (!ROBOFLOW_SAM3D_ENDPOINT) {
    missing.push('ROBOFLOW_SAM3D_ENDPOINT');
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}




