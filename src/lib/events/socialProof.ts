import { prisma } from "@/lib/prisma";
import { RSVPStatus } from "@prisma/client";

export interface RSVPBreakdown {
  going: number;
  interested: number;
  declined: number;
  total: number;
}

export interface AttendeeAvatar {
  id: string;
  name: string;
  profileImage: string | null;
  role: string | null;
}

export interface SocialProofData {
  breakdown: RSVPBreakdown;
  avatars: AttendeeAvatar[];
  overflow: number; // Count of attendees beyond the 5 shown
}

/**
 * Compute social proof data for an event or sub-event
 * Prioritizes "GOING" status, falls back to "INTERESTED" if needed
 */
export async function computeSocialProof(eventId: string): Promise<SocialProofData> {
  // Get all RSVPs with user data
  const rsvps = await prisma.eventRSVP.findMany({
    where: { eventId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profileImage: true,
          role: true,
        },
      },
    },
    orderBy: [
      // Prioritize GOING, then INTERESTED, then by creation date
      { createdAt: "asc" },
    ],
  });
  
  // Map to effective status (prefer enum, fallback to string mapping)
  const rsvpsWithEffectiveStatus = rsvps.map(rsvp => {
    const effectiveStatus = rsvp.statusEnum || (() => {
      const statusUpper = (rsvp.status || "").toUpperCase();
      if (statusUpper === "ATTENDING" || statusUpper === "GOING") return RSVPStatus.GOING;
      if (statusUpper === "INTERESTED") return RSVPStatus.INTERESTED;
      if (statusUpper === "DECLINED") return RSVPStatus.DECLINED;
      return RSVPStatus.GOING;
    })();
    return { ...rsvp, effectiveStatus };
  });

  // Sort manually: GOING first, then INTERESTED, then DECLINED
  rsvpsWithEffectiveStatus.sort((a, b) => {
    const order = { [RSVPStatus.GOING]: 0, [RSVPStatus.INTERESTED]: 1, [RSVPStatus.DECLINED]: 2 };
    return (order[a.effectiveStatus] ?? 99) - (order[b.effectiveStatus] ?? 99);
  });

  // Get avatars: prioritize GOING, then INTERESTED (up to 5)
  const goingRsvps = rsvpsWithEffectiveStatus.filter((r) => r.effectiveStatus === RSVPStatus.GOING);
  const interestedRsvps = rsvpsWithEffectiveStatus.filter((r) => r.effectiveStatus === RSVPStatus.INTERESTED);

  // Count by status
  const breakdown: RSVPBreakdown = {
    going: 0,
    interested: 0,
    declined: 0,
    total: rsvps.length,
  };

  rsvps.forEach((rsvp) => {
    // Prefer statusEnum, fallback to mapping from status string
    const effectiveStatus = rsvp.statusEnum || (() => {
      const statusUpper = (rsvp.status || "").toUpperCase();
      if (statusUpper === "ATTENDING" || statusUpper === "GOING") return RSVPStatus.GOING;
      if (statusUpper === "INTERESTED") return RSVPStatus.INTERESTED;
      if (statusUpper === "DECLINED") return RSVPStatus.DECLINED;
      return RSVPStatus.GOING; // Default
    })();

    switch (effectiveStatus) {
      case RSVPStatus.GOING:
        breakdown.going++;
        break;
      case RSVPStatus.INTERESTED:
        breakdown.interested++;
        break;
      case RSVPStatus.DECLINED:
        breakdown.declined++;
        break;
    }
  });

  const avatarRsvps = [
    ...goingRsvps.slice(0, 5),
    ...interestedRsvps.slice(0, Math.max(0, 5 - goingRsvps.length)),
  ].slice(0, 5);

  const avatars: AttendeeAvatar[] = avatarRsvps.map((rsvp) => ({
    id: rsvp.user.id,
    name: rsvp.user.name,
    profileImage: rsvp.user.profileImage,
    role: rsvp.user.role,
  }));

  const overflow = Math.max(0, breakdown.going + breakdown.interested - 5);

  return {
    breakdown,
    avatars,
    overflow,
  };
}

/**
 * Get role-based breakdown (if user roles exist)
 */
export async function computeRoleBreakdown(eventId: string): Promise<Record<string, number>> {
  const rsvps = await prisma.eventRSVP.findMany({
    where: {
      eventId,
      OR: [
        { statusEnum: RSVPStatus.GOING },
        { status: { in: ["attending", "ATTENDING", "going", "GOING"] } },
      ],
    },
    include: {
      user: {
        select: {
          role: true,
        },
      },
    },
  });

  const roleCounts: Record<string, number> = {};
  rsvps.forEach((rsvp) => {
    const role = rsvp.user.role || "GUEST";
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  });

  return roleCounts;
}

