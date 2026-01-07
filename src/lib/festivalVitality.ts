/**
 * Festival Vitality Utilities
 * Time calculations and state management for festival countdown
 */

export type FestivalState = 'pre' | 'live' | 'post';

/**
 * Determine the current state of a festival relative to now
 * @param startISO - ISO string of festival start date
 * @param endISO - ISO string of festival end date
 * @param now - Current time (default: new Date())
 * @returns Festival state: pre-event, live, or post-event
 */
export function getFestivalState(
  startISO?: string,
  endISO?: string,
  now = new Date()
): FestivalState {
  if (!startISO) return 'pre';
  
  const start = new Date(startISO).getTime();
  const end = endISO ? new Date(endISO).getTime() : start;
  const t = now.getTime();
  
  if (t < start) return 'pre';
  if (t >= start && t <= end) return 'live';
  return 'post';
}

/**
 * Calculate time difference parts (days, hours, minutes)
 * @param targetISO - ISO string of target date
 * @param now - Current time (default: new Date())
 * @returns Object with days, hours, mins, and total minutes
 */
export function diffParts(targetISO: string, now = new Date()) {
  const target = new Date(targetISO).getTime();
  const diff = Math.max(0, target - now.getTime());
  
  const minutes = Math.floor(diff / 60000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  
  return { days, hours, mins, minutesTotal: minutes };
}

/**
 * Generate human-readable countdown label from time parts
 * @param parts - Time difference parts from diffParts()
 * @returns Formatted countdown string (e.g., "3d 4h 12m", "14h 32m", "45m")
 */
export function labelFromParts(parts: ReturnType<typeof diffParts>): string {
  if (parts.minutesTotal <= 0) return 'Starts soon';
  if (parts.days > 0) return `${parts.days}d ${parts.hours}h ${parts.mins}m`;
  if (parts.hours > 0) return `${parts.hours}h ${parts.mins}m`;
  return `${parts.mins}m`;
}

/**
 * Generate accessibility label for countdown
 * @param parts - Time difference parts
 * @returns Screen reader friendly label
 */
export function a11yLabelFromParts(parts: ReturnType<typeof diffParts>): string {
  if (parts.minutesTotal <= 0) return 'Starts soon';
  
  const segments: string[] = [];
  if (parts.days > 0) segments.push(`${parts.days} day${parts.days !== 1 ? 's' : ''}`);
  if (parts.hours > 0) segments.push(`${parts.hours} hour${parts.hours !== 1 ? 's' : ''}`);
  if (parts.mins > 0) segments.push(`${parts.mins} minute${parts.mins !== 1 ? 's' : ''}`);
  
  return `Starts in ${segments.join(', ')}`;
}




