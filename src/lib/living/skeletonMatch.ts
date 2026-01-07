/**
 * Skeleton matching utilities for auto-resolving skeletons when tagging products
 */

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface SkeletonBbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Normalize tag point coordinates to 0-1 range
 * 
 * Rules:
 * - If tagX <= 1 && tagY <= 1 => assume already normalized, return as-is
 * - Else if imageWidth && imageHeight => normalize by dividing
 * - Else return null (cannot normalize)
 */
export function normalizeTagPoint(
  tagX: number,
  tagY: number,
  imageWidth?: number | null,
  imageHeight?: number | null
): NormalizedPoint | null {
  // If coordinates are already normalized (<= 1), return as-is
  if (tagX <= 1 && tagY <= 1) {
    return { x: tagX, y: tagY };
  }

  // If we have image dimensions, normalize by dividing
  if (imageWidth && imageHeight && imageWidth > 0 && imageHeight > 0) {
    return {
      x: tagX / imageWidth,
      y: tagY / imageHeight,
    };
  }

  // Cannot normalize without dimensions
  return null;
}

/**
 * Check if a point is inside a bounding box
 */
function isPointInBbox(point: NormalizedPoint, bbox: SkeletonBbox): boolean {
  return (
    point.x >= bbox.x &&
    point.x <= bbox.x + bbox.w &&
    point.y >= bbox.y &&
    point.y <= bbox.y + bbox.h
  );
}

/**
 * Compute distance from point to bbox center
 */
function distanceToBboxCenter(point: NormalizedPoint, bbox: SkeletonBbox): number {
  const centerX = bbox.x + bbox.w / 2;
  const centerY = bbox.y + bbox.h / 2;
  const dx = point.x - centerX;
  const dy = point.y - centerY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute bbox area
 */
function bboxArea(bbox: SkeletonBbox): number {
  return bbox.w * bbox.h;
}

/**
 * Pick the best matching skeleton for a tag point
 * 
 * Algorithm:
 * 1) If point is inside any bbox => choose the bbox with smallest area (most specific match)
 * 2) Else compute distance from point to bbox center and choose smallest distance
 * 3) Apply threshold: if distance > 0.25 (normalized) => return null (avoid wrong resolution)
 * 
 * @param skeletons Array of skeletons with bbox data
 * @param point Normalized point (0-1 coordinates)
 * @returns The matching skeleton or null if no good match
 */
export function pickMatchingSkeleton(
  skeletons: Array<{ id: string; bbox: SkeletonBbox }>,
  point: NormalizedPoint
): { id: string; bbox: SkeletonBbox } | null {
  if (skeletons.length === 0) {
    return null;
  }

  const DISTANCE_THRESHOLD = 0.25; // Normalized distance threshold

  // Step 1: Check if point is inside any bbox
  const containingSkeletons = skeletons.filter((s) =>
    isPointInBbox(point, s.bbox)
  );

  if (containingSkeletons.length > 0) {
    // Choose the bbox with smallest area (most specific match)
    containingSkeletons.sort((a, b) => bboxArea(a.bbox) - bboxArea(b.bbox));
    return containingSkeletons[0];
  }

  // Step 2: Find skeleton with minimum distance to bbox center
  let bestSkeleton: { id: string; bbox: SkeletonBbox } | null = null;
  let minDistance = Infinity;

  for (const skeleton of skeletons) {
    const distance = distanceToBboxCenter(point, skeleton.bbox);
    if (distance < minDistance) {
      minDistance = distance;
      bestSkeleton = skeleton;
    }
  }

  // Step 3: Apply threshold - reject if too far
  if (bestSkeleton && minDistance <= DISTANCE_THRESHOLD) {
    return bestSkeleton;
  }

  // No good match found
  return null;
}





