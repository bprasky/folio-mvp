/**
 * Mock RSVP Data Adapter
 * Simulates network fetching for vitality features
 * Replace with real API calls when backend is ready
 */

import fixtures from '@/mocks/rsvps/festivals.json';
import type { RSVPStats, FriendsGoing } from '@/types/festivalVitality';

/**
 * Fallback data for festivals not in the fixture file
 * Ensures the UI always renders during development
 */
const fallback: { rsvpStats: RSVPStats; friendsGoing: FriendsGoing } = {
  rsvpStats: {
    total: 87,
    attendees: [
      { id: 'u1', name: 'Cynthia Lee', avatarUrl: '/_mocks/avatars/cynthia.jpg' },
      { id: 'u2', name: 'Studio Forma', avatarUrl: '/_mocks/avatars/forma.jpg' },
      { id: 'u3', name: 'Marco D', avatarUrl: null }
    ]
  },
  friendsGoing: {
    count: 2,
    sample: [
      { id: 'u8', name: 'Ana G', avatarUrl: '/_mocks/avatars/ana.jpg', isFollowedByCurrentUser: true },
      { id: 'u9', name: 'R. Patel', avatarUrl: null, isFollowedByCurrentUser: true }
    ]
  }
};

/**
 * Fetch mock RSVP stats for a festival
 * @param festivalId - The festival ID
 * @returns RSVP stats or null if not found
 */
export async function getMockRSVPStats(festivalId: string): Promise<RSVPStats | null> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 120));
  
  const record = (fixtures as any)[festivalId] ?? fallback;
  return record?.rsvpStats ?? null;
}

/**
 * Fetch mock friends going data for a festival
 * @param festivalId - The festival ID
 * @returns Friends going data or null if not found
 */
export async function getMockFriendsGoing(festivalId: string): Promise<FriendsGoing | null> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 140));
  
  const record = (fixtures as any)[festivalId] ?? fallback;
  return record?.friendsGoing ?? null;
}

/**
 * TODO: Replace with real API calls
 * 
 * export async function getRealRSVPStats(festivalId: string): Promise<RSVPStats | null> {
 *   const res = await fetch(`/api/festivals/${festivalId}/rsvp-stats`);
 *   if (!res.ok) return null;
 *   return res.json();
 * }
 * 
 * export async function getRealFriendsGoing(festivalId: string): Promise<FriendsGoing | null> {
 *   const res = await fetch(`/api/festivals/${festivalId}/friends-going`);
 *   if (!res.ok) return null;
 *   return res.json();
 * }
 */

