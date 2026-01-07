import { prisma } from "@/lib/prisma";
import { EventVisibilityType } from "@prisma/client";

/**
 * Get the effective event type (visibility) for an event or sub-event.
 * Sub-events inherit their parent's eventType if not explicitly set.
 */
export async function getEffectiveEventType(eventId: string): Promise<EventVisibilityType | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      eventType: true,
      parentFestivalId: true,
      parentFestival: {
        select: {
          eventType: true,
        },
      },
    },
  });

  if (!event) return null;

  // If event has its own eventType, use it
  if (event.eventType) {
    return event.eventType;
  }

  // If it's a sub-event, inherit from parent
  if (event.parentFestivalId && event.parentFestival?.eventType) {
    return event.parentFestival.eventType;
  }

  // Default fallback: infer from legacy fields
  // This is a migration helper - can be removed once all events have eventType set
  return null; // Will be handled by backfill migration
}

/**
 * Ensure sub-events inherit parent eventType if not explicitly set.
 * This should be called during sub-event creation.
 */
export async function ensureSubEventInheritance(
  eventId: string,
  parentFestivalId: string | null
): Promise<EventVisibilityType | null> {
  if (!parentFestivalId) return null;

  const parent = await prisma.event.findUnique({
    where: { id: parentFestivalId },
    select: { eventType: true },
  });

  if (!parent || !parent.eventType) return null;

  // Update sub-event to inherit parent's eventType if not set
  const subEvent = await prisma.event.findUnique({
    where: { id: eventId },
    select: { eventType: true },
  });

  if (subEvent && !subEvent.eventType) {
    await prisma.event.update({
      where: { id: eventId },
      data: { eventType: parent.eventType },
    });
    return parent.eventType;
  }

  return subEvent?.eventType || null;
}


