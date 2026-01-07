import { prisma } from "@/lib/prisma";
import { EventVisibilityType } from "@prisma/client";
import { resolveVisibility } from "./visibility";

/**
 * Check if a user can RSVP to an event based on visibility and invite status.
 */
export async function canUserRSVP(
  eventId: string,
  userId: string | null,
  userEmail: string | null
): Promise<{ allowed: boolean; reason?: string }> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      visibility: true,
      eventType: true, // Legacy
      isPublic: true,
      inviteType: true,
      requiresApproval: true,
      createdById: true,
      parentFestivalId: true,
      parentFestival: {
        select: {
          visibility: true,
          eventType: true,
        },
      },
    },
  });

  if (!event) {
    return { allowed: false, reason: "Event not found" };
  }

  // Resolve visibility (including parent inheritance for sub-events)
  let resolvedVisibility = resolveVisibility(
    event.visibility,
    event.eventType,
    event.isPublic,
    event.inviteType
  );

  // If sub-event and own visibility not set, inherit from parent
  if (!event.visibility && !event.eventType && event.parentFestivalId && event.parentFestival) {
    resolvedVisibility = resolveVisibility(
      event.parentFestival.visibility,
      event.parentFestival.eventType,
      null,
      null
    );
  }

  // PUBLIC events: anyone can RSVP
  if (resolvedVisibility === EventVisibilityType.PUBLIC) {
    return { allowed: true };
  }

  // Must be authenticated for INVITE_ONLY/PRIVATE
  if (!userId && !userEmail) {
    return { allowed: false, reason: "Sign in required" };
  }

  // Creator/admin can always RSVP
  if (userId && userId === event.createdById) {
    return { allowed: true };
  }

  // Check if user is invited
  const invite = await prisma.eventInvite.findFirst({
    where: {
      eventId,
      OR: [
        userId ? { userId } : {},
        userEmail ? { email: userEmail } : {},
      ],
    },
  });

  if (invite) {
    return { allowed: true };
  }

  // INVITE_ONLY/PRIVATE require invite
  if (resolvedVisibility === EventVisibilityType.INVITE_ONLY) {
    return { allowed: false, reason: "Invite required" };
  }

  if (resolvedVisibility === EventVisibilityType.PRIVATE) {
    return { allowed: false, reason: "Invite required" };
  }

  return { allowed: false, reason: "Not authorized" };
}

