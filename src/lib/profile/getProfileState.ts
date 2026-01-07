import { ProfileState } from "@/lib/aesthetic/types";

/**
 * Determine the current state of a designer's profile
 */
export function getProfileState(
  projectCount: number,
  hasBrandAssets: boolean,
  hasAestheticProfile: boolean,
  isCustomized: boolean
): ProfileState {
  if (isCustomized) return "customized";
  if (hasAestheticProfile) return "generated";
  if (projectCount >= 2) return "ready";
  if (projectCount >= 1 && !hasBrandAssets) return "projects_only";
  if (hasBrandAssets && projectCount === 0) return "brand_only";
  if (projectCount >= 1 && hasBrandAssets) return "ready"; // 1 project + brand = enough signal
  return "empty";
}


