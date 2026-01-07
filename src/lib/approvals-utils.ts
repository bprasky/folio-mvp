// Room types dictionary for extraction
// Longer phrases first to avoid partial matches (e.g., "living room" before "living")
export const ROOM_KEYWORDS: Record<string, string> = {
  'primary bedroom': 'BEDROOM',
  'master bedroom': 'BEDROOM',
  'guest bedroom': 'BEDROOM',
  'guest room': 'BEDROOM',
  'living room': 'LIVING',
  'family room': 'LIVING',
  'dining room': 'DINING',
  'powder room': 'BATH',
  'home office': 'OFFICE',
  'media room': 'MEDIA',
  'kitchen': 'KITCHEN',
  'living': 'LIVING',
  'dining': 'DINING',
  'bedroom': 'BEDROOM',
  'bathroom': 'BATH',
  'bath': 'BATH',
  'powder': 'BATH',
  'entry': 'ENTRY',
  'entryway': 'ENTRY',
  'foyer': 'ENTRY',
  'office': 'OFFICE',
  'study': 'OFFICE',
  'outdoor': 'OUTDOOR',
  'patio': 'OUTDOOR',
  'deck': 'OUTDOOR',
  'backyard': 'OUTDOOR',
  'laundry': 'LAUNDRY',
  'mudroom': 'ENTRY',
  'garage': 'GARAGE',
  'nursery': 'BEDROOM',
  'theater': 'MEDIA',
  'basement': 'BASEMENT',
  'attic': 'ATTIC',
  'closet': 'CLOSET',
  'pantry': 'PANTRY',
};

// Throttle: max rooms to auto-create from a single note
export const MAX_AUTO_CREATE_ROOMS = 2;

/**
 * =============================================================================
 * DEMO HEURISTICS — Documented for Future Reference
 * =============================================================================
 * 
 * These constants and patterns are used for demo/MVP detection logic.
 * They may need to be replaced with proper metadata fields in production.
 * 
 * CONCEPT_IMAGE_MARKER:
 *   - Used to identify AI-generated concept images by filename
 *   - Detection: image.name?.includes(CONCEPT_IMAGE_MARKER)
 *   - Future: Consider adding `role: 'concept'` field to ProjectImage schema
 * 
 * Room extraction (ROOM_KEYWORDS):
 *   - Dictionary-based room detection from meeting note text
 *   - Future: Consider NLP-based extraction or user confirmation
 * =============================================================================
 */

/**
 * DEMO HEURISTIC: Concept image filename marker
 * Used to detect AI-generated concept images by name convention.
 * 
 * When generating concept images, we set name = `${roomName} - ${CONCEPT_IMAGE_MARKER}`
 * When detecting concept images, we check image.name?.includes(CONCEPT_IMAGE_MARKER)
 * 
 * @see src/app/api/rooms/[id]/approvals/generate-concept-image/route.ts
 */
export const CONCEPT_IMAGE_MARKER = 'Concept Image';

// Room readiness states
export type RoomReadiness = 'EMPTY' | 'NOTED' | 'STRUCTURED' | 'VISUAL' | 'READY_TO_SPECIFY';

export interface RoomWithReadiness {
  id: string;
  name: string;
  type: string | null;
  readiness: RoomReadiness;
  noteCount: number;
  skeletonCount: number;
  imageCount: number;
  tagCount: number;
}

export interface PendingApproval {
  id: string;
  type: 'CREATE_ROOM' | 'GENERATE_SKELETONS' | 'GENERATE_CONCEPT_IMAGE' | 'DRAFT_EDITORIAL' | 'PUBLISH_EDITORIAL' | 'TAGGABLE_ITEMS_READY';
  title: string;
  description: string;
  source?: {
    noteId: string;
    noteTitle: string | null;
    excerpt?: string;
    timestamp?: Date;
  };
  payload: Record<string, any>;
}

/**
 * Normalize room name for comparison and storage
 * e.g., "kitchen" -> "Kitchen", "primary bed" -> "Primary Bedroom"
 */
export function normalizeRoomName(name: string): string {
  const lower = name.toLowerCase().trim();
  
  // Map common variations to canonical names
  const canonicalNames: Record<string, string> = {
    'kitchen': 'Kitchen',
    'living room': 'Living Room',
    'living': 'Living Room',
    'family room': 'Family Room',
    'dining room': 'Dining Room',
    'dining': 'Dining Room',
    'primary bedroom': 'Primary Bedroom',
    'master bedroom': 'Primary Bedroom',
    'primary bed': 'Primary Bedroom',
    'master bed': 'Primary Bedroom',
    'bedroom': 'Bedroom',
    'guest bedroom': 'Guest Bedroom',
    'guest room': 'Guest Bedroom',
    'bathroom': 'Bathroom',
    'bath': 'Bathroom',
    'powder room': 'Powder Room',
    'powder': 'Powder Room',
    'entry': 'Entry',
    'entryway': 'Entry',
    'foyer': 'Entry',
    'office': 'Office',
    'study': 'Office',
    'home office': 'Home Office',
    'outdoor': 'Outdoor',
    'patio': 'Patio',
    'deck': 'Deck',
    'backyard': 'Backyard',
    'laundry': 'Laundry',
    'mudroom': 'Mudroom',
    'garage': 'Garage',
    'nursery': 'Nursery',
    'media room': 'Media Room',
    'theater': 'Theater',
    'basement': 'Basement',
    'attic': 'Attic',
    'closet': 'Closet',
    'pantry': 'Pantry',
  };
  
  return canonicalNames[lower] || name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Normalize room name to a deduplication key
 * Used for case-insensitive matching and deduplication
 * e.g., " kitchen " -> "kitchen", "Primary Bedroom" -> "primary bedroom"
 */
export function normalizeRoomKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Collapse multiple spaces to single space
}

/**
 * Extract room keywords from text
 * Returns deduplicated, normalized room names with excerpts
 */
export function extractRoomsFromText(text: string): Array<{ roomType: string; roomName: string; excerpt: string }> {
  const results: Array<{ roomType: string; roomName: string; excerpt: string }> = [];
  const lowerText = text.toLowerCase();
  const seenRoomNames = new Set<string>();
  
  // Sort keywords by length (longest first) to match multi-word phrases first
  const sortedKeywords = Object.entries(ROOM_KEYWORDS).sort(
    ([a], [b]) => b.length - a.length
  );
  
  for (const [keyword, roomType] of sortedKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    let match;
    while ((match = regex.exec(lowerText)) !== null) {
      // Normalize the room name
      const roomName = normalizeRoomName(keyword);
      const normalizedKey = roomName.toLowerCase();
      
      // Skip if we already have this room (deduplication)
      if (seenRoomNames.has(normalizedKey)) continue;
      seenRoomNames.add(normalizedKey);
      
      // Extract surrounding context (50 chars before and after)
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + keyword.length + 50);
      const excerpt = text.slice(start, end).trim();
      
      results.push({ roomType, roomName, excerpt });
    }
  }
  
  return results;
}

/**
 * Compute room readiness state
 */
export function computeRoomReadiness(room: {
  noteCount: number;
  skeletonCount: number;
  imageCount: number;
  tagCount: number;
}): RoomReadiness {
  if (room.tagCount > 0 && room.skeletonCount > 0 && room.imageCount > 0) {
    return 'READY_TO_SPECIFY';
  }
  if (room.imageCount > 0) {
    return 'VISUAL';
  }
  if (room.skeletonCount > 0) {
    return 'STRUCTURED';
  }
  if (room.noteCount > 0) {
    return 'NOTED';
  }
  return 'EMPTY';
}

/**
 * Get editorial readiness hint for Overview
 * Returns a hint message if editorial isn't available yet
 */
/**
 * Check if an approval type is verifiable (can be confirmed as complete)
 * Only verifiable approvals should appear in Overview
 */
export function isVerifiableApprovalType(type: string): boolean {
  const verifiableTypes = [
    'CREATE_ROOM',           // Verifiable: room exists
    'GENERATE_SKELETONS',    // Verifiable: skeleton count > 0
    'GENERATE_CONCEPT_IMAGE', // Verifiable: concept image exists
    'TAGGABLE_ITEMS_READY',  // Verifiable: skeletons resolved by confirmedProductId
    'DRAFT_EDITORIAL',       // Verifiable: draft post exists
    'PUBLISH_EDITORIAL',     // Verifiable: post status becomes PUBLISHED
  ];
  return verifiableTypes.includes(type);
}

export function getEditorialHint(imageCount: number, tagCount: number, isPublished: boolean): string | null {
  if (isPublished) return null;
  if (imageCount === 0) {
    return 'Upload photos to unlock editorial drafts.';
  }
  if (tagCount === 0) {
    return 'Tag at least 1 product in your photos to unlock editorial drafts.';
  }
  return null;
}

