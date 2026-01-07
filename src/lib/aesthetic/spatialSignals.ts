import { SpatialSignals } from './types';

/**
 * Extract spatial signals from room types, object density, and architectural features
 */
export function extractSpatialSignals(
  rooms: Array<{ type: string; materials?: string[] }>,
  images: Array<{
    objectCount?: number;
    hasArchitecturalFeatures?: boolean;
  }>
): SpatialSignals {
  // Count room types
  const roomTypes: Record<string, number> = {};
  for (const room of rooms) {
    const type = room.type || 'UNKNOWN';
    roomTypes[type] = (roomTypes[type] || 0) + 1;
  }
  
  // Calculate average object density
  const objectCounts = images
    .map(img => img.objectCount ?? 0)
    .filter(count => count > 0);
  
  const avgObjectDensity = objectCounts.length > 0
    ? objectCounts.reduce((a, b) => a + b, 0) / objectCounts.length
    : 0;
  
  // Calculate symmetry score (0-1)
  // Higher symmetry suggests more formal/minimal aesthetic
  const architecturalFeatures = images.filter(img => img.hasArchitecturalFeatures ?? false);
  const symmetryScore = architecturalFeatures.length / Math.max(images.length, 1);
  
  // Architectural emphasis: >50% of images have architectural features
  const architecturalEmphasis = architecturalFeatures.length > images.length * 0.5;
  
  return {
    roomTypes,
    avgObjectDensity,
    symmetryScore,
    architecturalEmphasis,
  };
}


