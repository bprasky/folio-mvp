/**
 * roomPriority.ts - Room priority weights for editorial hierarchy
 * 
 * Determines which rooms should appear first in the layout.
 * Higher priority = appears earlier, gets more prominence.
 */

/**
 * Get priority score for a room name
 * Higher score = higher priority in layout
 */
export function roomPriority(roomName: string | null | undefined): number {
  if (!roomName) return 0;
  
  const normalized = roomName.toLowerCase().trim();
  
  // +4: Exterior / Facade / Entry / Great Room / Living Room (best openers)
  if (
    normalized.includes('exterior') ||
    normalized.includes('facade') ||
    normalized.includes('entry') ||
    normalized.includes('foyer') ||
    normalized.includes('great room') ||
    normalized === 'living room' ||
    normalized === 'living'
  ) {
    return 4;
  }
  
  // +3: Primary Bedroom / Master / Suite / Dining / Courtyard / Pool / Terrace
  if (
    normalized.includes('master') ||
    normalized.includes('primary bedroom') ||
    normalized.includes('suite') ||
    normalized.includes('dining') ||
    normalized.includes('courtyard') ||
    normalized.includes('pool') ||
    normalized.includes('terrace') ||
    normalized.includes('patio')
  ) {
    return 3;
  }
  
  // +2: Office / Library / Hall / Stair
  if (
    normalized.includes('office') ||
    normalized.includes('library') ||
    normalized.includes('hall') ||
    normalized.includes('stair') ||
    normalized.includes('staircase')
  ) {
    return 2;
  }
  
  // +1: Kitchen (not leading, but not last)
  if (normalized.includes('kitchen')) {
    return 1;
  }
  
  // +1: Bath / Powder
  if (
    normalized.includes('bath') ||
    normalized.includes('powder') ||
    normalized.includes('toilet')
  ) {
    return 1;
  }
  
  // 0: Closet / Utility / Laundry (lowest priority)
  if (
    normalized.includes('closet') ||
    normalized.includes('utility') ||
    normalized.includes('laundry') ||
    normalized.includes('storage')
  ) {
    return 0;
  }
  
  // Default: medium priority for unknown rooms
  return 2;
}

/**
 * Group images by room and sort by priority
 */
export function groupImagesByRoom<T extends { room?: string | null }>(
  images: T[],
  roomMap: Map<string, string>
): Array<{ roomName: string | null; priority: number; images: T[] }> {
  const groups = new Map<string | null, T[]>();
  
  // Group images by room
  images.forEach(image => {
    const roomName = image.room 
      ? (roomMap.get(image.room) || roomMap.get(image.room.toLowerCase()) || image.room)
      : null;
    
    if (!groups.has(roomName)) {
      groups.set(roomName, []);
    }
    groups.get(roomName)!.push(image);
  });
  
  // Convert to array and sort by priority
  return Array.from(groups.entries())
    .map(([roomName, images]) => ({
      roomName,
      priority: roomPriority(roomName),
      images,
    }))
    .sort((a, b) => {
      // Sort by priority descending, then by room name for stability
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return (a.roomName || '').localeCompare(b.roomName || '');
    });
}








