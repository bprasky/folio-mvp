import { prisma } from "@/lib/prisma";
import { EventVisibilityType } from "@prisma/client";

/**
 * Resolve visibility for an event with fallback logic.
 * Priority: visibility -> eventType (legacy) -> infer from isPublic/inviteType
 */
export function resolveVisibility(
  visibility: EventVisibilityType | null,
  eventType: EventVisibilityType | null, // Legacy alias
  isPublic: boolean | null,
  inviteType: string | null
): EventVisibilityType {
  // Use canonical visibility field if set
  if (visibility) return visibility;
  
  // Fallback to legacy eventType field
  if (eventType) return eventType;
  
  // Infer from legacy fields
  if (isPublic === false && inviteType === "invite-only") {
    return EventVisibilityType.INVITE_ONLY;
  }
  if (isPublic === false && inviteType === "followers") {
    return EventVisibilityType.PRIVATE;
  }
  
  // Default to PUBLIC
  return EventVisibilityType.PUBLIC;
}

/**
 * Resolve visibility for a sub-event, inheriting from parent if needed.
 */
export async function resolveSubEventVisibility(
  eventId: string,
  parentFestivalId: string | null
): Promise<EventVisibilityType> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      visibility: true,
      eventType: true, // Legacy
      isPublic: true,
      inviteType: true,
      parentFestival: parentFestivalId ? {
        select: {
          visibility: true,
          eventType: true, // Legacy
          isPublic: true,
          inviteType: true,
        },
      } : undefined,
    },
  });

  if (!event) return EventVisibilityType.PUBLIC;

  // Try own visibility first
  const ownVisibility = resolveVisibility(
    event.visibility,
    event.eventType,
    event.isPublic,
    event.inviteType
  );

  // If own visibility is explicitly set, use it
  if (event.visibility || event.eventType) {
    return ownVisibility;
  }

  // If sub-event and parent exists, inherit from parent
  if (parentFestivalId && event.parentFestival) {
    return resolveVisibility(
      event.parentFestival.visibility,
      event.parentFestival.eventType,
      event.parentFestival.isPublic,
      event.parentFestival.inviteType
    );
  }

  return ownVisibility;
}


