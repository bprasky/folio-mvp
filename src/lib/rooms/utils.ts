/**
 * Utility functions for room operations
 */

/**
 * Check if a string is a valid UUID
 */
export function isUuid(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  // UUID v4 pattern: 8-4-4-4-12 hex digits
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Infer room type from room name
 * Returns a room type string or null
 */
export function inferRoomType(roomName: string): string | null {
  const lower = roomName.toLowerCase();

  if (lower.includes('kitchen')) return 'KITCHEN';
  if (lower.includes('bath') || lower.includes('powder')) return 'BATH';
  if (lower.includes('living') || lower.includes('family')) return 'LIVING';
  if (lower.includes('bedroom') || lower.includes('bed') || lower.includes('nursery')) return 'BEDROOM';
  if (lower.includes('dining')) return 'DINING';
  if (lower.includes('office') || lower.includes('study')) return 'OFFICE';
  if (lower.includes('entry') || lower.includes('foyer') || lower.includes('mudroom')) return 'ENTRY';

  return null;
}





