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

  // Multi-word specific matches first (order matters — check before single-word)
  if (lower.includes('wine cellar') || lower.includes('wine room')) return 'WINE_CELLAR';
  if (lower.includes('walk-in closet') || lower.includes('walk in closet')) return 'WALK_IN_CLOSET';
  if (lower.includes('home theater') || lower.includes('home theatre')) return 'HOME_THEATER';
  if (lower.includes('butler')) return 'BUTLER_PANTRY';
  if (lower.includes('sun room') || lower.includes('sunroom')) return 'SUNROOM';
  if (lower.includes('powder')) return 'POWDER_ROOM';
  if (lower.includes('play room') || lower.includes('playroom')) return 'PLAYROOM';
  if (lower.includes('mud room') || lower.includes('mudroom')) return 'MUDROOM';

  // Single-word matches
  if (lower.includes('kitchen')) return 'KITCHEN';
  if (lower.includes('bath')) return 'BATH';
  if (lower.includes('living') || lower.includes('family')) return 'LIVING';
  if (lower.includes('nursery')) return 'NURSERY';
  if (lower.includes('bedroom') || lower.includes('bed room')) return 'BEDROOM';
  if (lower.includes('dining')) return 'DINING';
  if (lower.includes('study')) return 'STUDY';
  if (lower.includes('office')) return 'OFFICE';
  if (lower.includes('entry') || lower.includes('foyer')) return 'ENTRY';
  if (lower.includes('bar')) return 'BAR';
  if (lower.includes('pantry')) return 'PANTRY';
  if (lower.includes('laundry')) return 'LAUNDRY';
  if (lower.includes('theater') || lower.includes('theatre')) return 'HOME_THEATER';
  if (lower.includes('gym') || lower.includes('fitness')) return 'GYM';
  if (lower.includes('pool')) return 'POOL';
  if (lower.includes('library')) return 'LIBRARY';
  if (lower.includes('lounge')) return 'LOUNGE';
  if (lower.includes('closet')) return 'WALK_IN_CLOSET';

  return null;
}





