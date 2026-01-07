/**
 * Festival Vitality Hooks
 * Shared countdown timer and lazy data fetching for RSVP/friends
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { diffParts, getFestivalState, labelFromParts, a11yLabelFromParts } from '@/lib/festivalVitality';
import { getMockRSVPStats, getMockFriendsGoing } from '@/lib/mockRSVPAdapter';
import type { FriendsGoing, RSVPStats } from '@/types/festivalVitality';

/**
 * Shared countdown timer hook
 * Uses a single interval per component tree to minimize performance impact
 * Updates every 30 seconds for minute-level accuracy
 * 
 * @param startISO - Festival start date ISO string
 * @param endISO - Festival end date ISO string
 * @returns Current festival state, time parts, and formatted labels
 */
export function useCountdown(startISO?: string, endISO?: string) {
  const [now, setNow] = useState<Date>(() => new Date());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Single 30-second interval (sufficient for minute-level countdown)
    timerRef.current = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  const state = useMemo(
    () => getFestivalState(startISO, endISO, now),
    [startISO, endISO, now]
  );

  const parts = useMemo(
    () => (startISO ? diffParts(startISO, now) : null),
    [startISO, now]
  );

  const label = useMemo(
    () => (parts ? labelFromParts(parts) : ''),
    [parts]
  );

  const a11yLabel = useMemo(
    () => (parts ? a11yLabelFromParts(parts) : ''),
    [parts]
  );

  return { state, parts, label, a11yLabel };
}

/**
 * Lazy vitality data fetcher hook
 * Fetches RSVP stats and friends going data on mount
 * Currently uses mock adapter; replace with real API when ready
 * 
 * @param festivalId - Festival ID to fetch data for
 * @param enabled - Whether to fetch data (feature flag)
 * @returns RSVP stats and friends going data (null while loading)
 */
export function useVitalityData(festivalId: string, enabled: boolean) {
  const [rsvp, setRSVP] = useState<RSVPStats | null>(null);
  const [friends, setFriends] = useState<FriendsGoing | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    (async () => {
      // Parallel fetch for better performance
      const [rsvpData, friendsData] = await Promise.all([
        getMockRSVPStats(festivalId),
        getMockFriendsGoing(festivalId),
      ]);

      if (!cancelled) {
        setRSVP(rsvpData);
        setFriends(friendsData);
        
        // Development diagnostic logging
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('[Vitality] festivalId:', festivalId, { rsvp: rsvpData, friends: friendsData });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [festivalId, enabled]);

  return { rsvp, friends };
}

