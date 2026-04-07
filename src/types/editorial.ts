/**
 * Shared types for editorial components with 3D mesh support.
 *
 * Consolidates the ProjectImage / Tag interfaces that were previously
 * duplicated across HeroSpreadBlock, GalleryBlock, DetailBlock,
 * EditorialSpread, SplitEditorialBlock, and EditorialProjectLayout.
 */

export interface EditorialTag {
  id: string;
  x?: number;
  y?: number;

  // 3D mesh data (populated by SAM 3D pipeline)
  mesh3dUrl?: string | null;
  meshMaskUrl?: string | null;
  meshStatus?: string | null;
  meshConfidence?: number | null;
  meshBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  meshDepthEstimate?: number | null;

  product?: {
    id: string;
    name: string;
    imageUrl?: string | null;
    cutoutImageUrl?: string | null;
    threeDAssetUrl?: string | null;
    primaryImageUrl?: string | null;
    imageUrls?: string[];
    thumbnailUrl?: string | null;
    brand?: string | null;
    vendor?: { name?: string | null; companyName?: string | null } | null;
  } | null;
}

export interface EditorialProjectImage {
  id: string;
  url: string;
  name?: string | null;
  room?: string | null;
  orientation?: 'landscape' | 'portrait' | 'square' | 'unknown';
  tags?: EditorialTag[];
}
