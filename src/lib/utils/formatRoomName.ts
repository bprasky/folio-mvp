/**
 * Formats a raw room name for user-facing display.
 * Replaces underscores with spaces and converts to title case.
 *
 * Examples:
 *   "DINING_ROOM" → "Dining Room"
 *   "living_room" → "Living Room"
 *   "bathroom"    → "Bathroom"
 *   "entry"       → "Entry"
 *   "LIVING ROOM" → "Living Room"
 */
export function formatRoomName(raw: string): string {
  if (!raw) return raw;
  return raw
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
