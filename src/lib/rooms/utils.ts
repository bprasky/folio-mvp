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





