/**
 * Festival Vitality UI Types
 * For countdown, RSVP presence, and friends attending features
 */

export type RSVPAttendee = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isFollowedByCurrentUser?: boolean;
};

export type RSVPStats = {
  total: number;
  attendees: RSVPAttendee[]; // Top 3, ordered by relevance
};

export type FriendsGoing = {
  count: number; // Total friends attending
  sample: RSVPAttendee[]; // 1-3 sample profiles
};

export type VitalityData = {
  rsvpStats: RSVPStats;
  friendsGoing: FriendsGoing;
};




