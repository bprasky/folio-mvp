/**
 * RSVP Presence Component
 * Shows overlapping avatars + count for festival attendees
 * Brand-safe: 24px circles, stone palette, 2px white borders
 */

'use client';

import type { RSVPStats } from '@/types/festivalVitality';

/**
 * Generate initials from a name (max 2 characters)
 * @param name - Full name
 * @returns Uppercase initials (e.g., "Jane Doe" -> "JD")
 */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map(part => part[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

export interface RSVPPresenceProps {
  data: RSVPStats | null;
}

export function RSVPPresence({ data }: RSVPPresenceProps) {
  if (!data || data.total <= 0) return null;

  const top = (data.attendees ?? []).slice(0, 3);
  const extra = Math.max(0, data.total - top.length);

  return (
    <div className="flex items-center" aria-label={`${data.total} people attending`}>
      {/* Overlapping avatar group */}
      <div className="flex -space-x-2" role="list" aria-label="Attendees">
        {top.map(attendee => (
          <div
            key={attendee.id}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-stone-200 overflow-hidden"
            role="listitem"
          >
            {attendee.avatarUrl ? (
              <img
                src={attendee.avatarUrl}
                alt={attendee.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] font-medium text-stone-700">
                {initials(attendee.name)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Count display */}
      <span className="ml-2 text-xs text-stone-700 font-medium">
        {extra > 0 ? `+${extra}` : data.total} attending
      </span>
    </div>
  );
}




