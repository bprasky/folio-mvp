/**
 * Friends Going Component
 * Shows count of friends/followers attending the festival
 * Brand-safe: muted text, minimal presence, mock-labeled initially
 */

'use client';

import type { FriendsGoing } from '@/types/festivalVitality';

export interface FriendsGoingProps {
  data: FriendsGoing | null;
  isMock?: boolean;
}

export function FriendsGoing({ data, isMock }: FriendsGoingProps) {
  if (!data || data.count <= 0) return null;

  const label = data.count === 1 
    ? '1 you follow is going' 
    : `${data.count} you follow are going`;

  return (
    <div className="mt-1 text-[var(--type-meta)] md:text-[var(--type-meta)] text-stone-700 font-medium">
      {label}
      {isMock && <span className="ml-1 opacity-60 font-normal">[mock]</span>}
    </div>
  );
}

