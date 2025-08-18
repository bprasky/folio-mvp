import { Event } from './fetchEvents';

export type TileSize = 'XL' | 'L' | 'M' | 'S';

export interface FibonacciTile {
  event: Event;
  size: TileSize;
  priority: number;
  gridArea: string;
  position: { row: number; col: number; rowSpan: number; colSpan: number };
}

/**
 * Calculate event priority based on buzz badges and engagement
 */
export function calculateEventPriority(event: Event): number {
  let priority = 0;
  
  // Base priority from RSVP count
  const rsvpCount = event.rsvps?.length || 0;
  priority += Math.min(rsvpCount * 2, 100); // Cap at 100 points
  
  // Priority from badges
  const badges = getBuzzBadges(event);
  badges.forEach(badge => {
    switch (badge.label) {
      case '🔥 Trending':
        priority += 150;
        break;
      case '👑 Editor\'s Pick':
        priority += 200;
        break;
      case '💫 Sponsored':
        priority += 120;
        break;
      case '📈 Rising':
        priority += 80;
        break;
      case '⭐ Popular':
        priority += 100;
        break;
      case '🆕 New':
        priority += 50;
        break;
    }
  });
  
  // Boost level priority
  if (event.boostLevel === 'priority') priority += 300;
  else if (event.boostLevel === 'boosted') priority += 150;
  
  return priority;
}

/**
 * Get buzz badges for an event (imported from fetchEvents)
 */
function getBuzzBadges(event: Event): { label: string; color: string }[] {
  const badges = [];
  const now = new Date();
  const created = new Date(event.createdAt);
  const ageHours = (now.getTime() - created.getTime()) / (1000 * 3600);
  const rsvpCount = event.rsvps?.length || 0;

  // New: created within last 72 hours
  if (ageHours < 72) {
    badges.push({ label: '🆕 New', color: 'bg-blue-100 text-blue-800' });
  }
  
  // Rising: RSVP growth > 20% in last 24h
  if (event.rsvp_change_24h && event.rsvp_change_24h > 20) {
    badges.push({ label: '📈 Rising', color: 'bg-green-100 text-green-800' });
  }
  
  // Trending: in the top 10% of all RSVP counts (assuming >50 RSVPs for now)
  if (rsvpCount > 50) {
    badges.push({ label: '🔥 Trending', color: 'bg-orange-100 text-orange-800' });
  }
  
  // Popular: >100 RSVPs
  if (rsvpCount > 100) {
    badges.push({ label: '⭐ Popular', color: 'bg-purple-100 text-purple-800' });
  }
  
  // Sponsored: if event.isSponsored === true
  if (event.isSponsored) {
    badges.push({ label: '💫 Sponsored', color: 'bg-yellow-400 text-white' });
  }
  
  // Editor's Pick (random for now, could be based on boostLevel in future)
  if (Math.random() > 0.95) {
    badges.push({ label: '👑 Editor\'s Pick', color: 'bg-yellow-100 text-yellow-800' });
  }

  return badges;
}

/**
 * Get tile size based on priority and position
 */
export function getTileSize(priority: number, index: number): TileSize {
  // High priority events get larger tiles
  if (priority >= 300) return 'XL';
  if (priority >= 200) return 'L';
  if (priority >= 100) return 'M';
  
  // Fallback to Fibonacci pattern for lower priority events
  if (index === 0) return 'XL';
  if ([1, 2, 5, 9].includes(index)) return 'M';
  if ([3, 4, 6, 7, 8].includes(index)) return 'S';
  
  // For indices beyond 9, cycle through the pattern
  const cycleIndex = index % 10;
  return getTileSize(0, cycleIndex);
}

/**
 * Get CSS grid classes for a tile size
 */
export function getTileGridClasses(size: TileSize): string {
  switch (size) {
    case 'XL':
      return 'col-span-2 row-span-2';
    case 'L':
      return 'col-span-2 row-span-1';
    case 'M':
      return 'col-span-1 row-span-1';
    case 'S':
      return 'col-span-1 row-span-1';
  }
}

/**
 * Create a Fibonacci grid layout with proper positioning
 */
export function createFibonacciGrid(events: Event[]): FibonacciTile[] {
  // Calculate priority for each event
  const eventsWithPriority = events.map(event => ({
    event,
    priority: calculateEventPriority(event)
  }));
  
  // Sort by priority (highest first)
  eventsWithPriority.sort((a, b) => b.priority - a.priority);
  
  // Define Fibonacci pattern positions
  const fibonacciPattern = [
    { size: 'XL', row: 0, col: 0, rowSpan: 2, colSpan: 2 }, // 2x2
    { size: 'M', row: 0, col: 2, rowSpan: 1, colSpan: 1 },  // 1x1
    { size: 'M', row: 1, col: 2, rowSpan: 1, colSpan: 1 },  // 1x1
    { size: 'S', row: 2, col: 0, rowSpan: 1, colSpan: 1 },  // 1x1
    { size: 'S', row: 2, col: 1, rowSpan: 1, colSpan: 1 },  // 1x1
    { size: 'L', row: 2, col: 2, rowSpan: 1, colSpan: 2 },  // 2x1
    { size: 'S', row: 3, col: 0, rowSpan: 1, colSpan: 1 },  // 1x1
    { size: 'S', row: 3, col: 1, rowSpan: 1, colSpan: 1 },  // 1x1
    { size: 'S', row: 3, col: 2, rowSpan: 1, colSpan: 1 },  // 1x1
    { size: 'M', row: 3, col: 3, rowSpan: 1, colSpan: 1 },  // 1x1
  ];
  
  const tiles: FibonacciTile[] = [];
  
  eventsWithPriority.forEach(({ event, priority }, index) => {
    // Get position from Fibonacci pattern (cycle if more events than pattern)
    const patternIndex = index % fibonacciPattern.length;
    const pattern = fibonacciPattern[patternIndex];
    
    // Override size based on priority for high-priority events
    let size = pattern.size as TileSize;
    if (priority >= 300) size = 'XL';
    else if (priority >= 200) size = 'L';
    else if (priority >= 100) size = 'M';
    
    // Adjust position based on actual size
    let position = { row: pattern.row, col: pattern.col, rowSpan: pattern.rowSpan, colSpan: pattern.colSpan };
    if (size === 'XL') {
      position = { row: pattern.row, col: pattern.col, rowSpan: 2, colSpan: 2 };
    } else if (size === 'L') {
      position = { row: pattern.row, col: pattern.col, rowSpan: 1, colSpan: 2 };
    } else {
      position = { row: pattern.row, col: pattern.col, rowSpan: 1, colSpan: 1 };
    }
    
    tiles.push({
      event,
      size,
      priority,
      gridArea: `event-${index}`,
      position
    });
  });
  
  return tiles;
}

/**
 * Arrange events for Fibonacci layout with priority-based ordering
 */
export function arrangeEventsForFibonacci(events: Event[]): FibonacciTile[] {
  return createFibonacciGrid(events);
}

/**
 * Get responsive grid classes for Fibonacci layout
 */
export function getFibonacciGridClasses(): string {
  return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr';
}

/**
 * Get hover animation classes based on tile size
 */
export function getHoverAnimationClasses(size: TileSize): string {
  const baseClasses = 'transition-all duration-300 ease-out';
  
  switch (size) {
    case 'XL':
      return `${baseClasses} hover:scale-[1.02] hover:shadow-2xl hover:shadow-folio-accent/20`;
    case 'L':
      return `${baseClasses} hover:scale-[1.015] hover:shadow-xl hover:shadow-folio-accent/15`;
    case 'M':
      return `${baseClasses} hover:scale-[1.01] hover:shadow-lg hover:shadow-folio-accent/10`;
    case 'S':
      return `${baseClasses} hover:scale-[1.005] hover:shadow-md`;
  }
}

/**
 * Get typography classes based on tile size
 */
export function getTypographyClasses(size: TileSize): {
  title: string;
  description: string;
  date: string;
  location: string;
} {
  switch (size) {
    case 'XL':
      return {
        title: 'text-2xl font-bold',
        description: 'text-base',
        date: 'text-sm',
        location: 'text-sm'
      };
    case 'L':
      return {
        title: 'text-xl font-bold',
        description: 'text-sm',
        date: 'text-xs',
        location: 'text-xs'
      };
    case 'M':
      return {
        title: 'text-lg font-semibold',
        description: 'text-sm',
        date: 'text-xs',
        location: 'text-xs'
      };
    case 'S':
      return {
        title: 'text-base font-semibold',
        description: 'text-xs',
        date: 'text-xs',
        location: 'text-xs'
      };
  }
} 