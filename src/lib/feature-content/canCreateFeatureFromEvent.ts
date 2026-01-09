import prisma from '@/lib/prisma';

export interface EventFeatureEligibility {
  eligible: boolean;
  reason?: string;
  event?: {
    id: string;
    title: string;
    endDate: Date;
    createdById: string;
  };
}

/**
 * Checks if a Feature can be created from an Event.
 * Event hosts can create Features after the event date has passed.
 *
 * @param eventId - The ID of the event to check
 * @param userId - The ID of the user attempting to create the feature
 * @returns Eligibility status and reason
 */
export async function canCreateFeatureFromEvent(
  eventId: string,
  userId: string
): Promise<EventFeatureEligibility> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      endDate: true,
      createdById: true,
      features: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!event) {
    return {
      eligible: false,
      reason: 'Event not found',
    };
  }

  // Check if user is the event creator (host)
  if (event.createdById !== userId) {
    return {
      eligible: false,
      reason: 'Only the event host can create a Feature from this event',
      event: {
        id: event.id,
        title: event.title,
        endDate: event.endDate,
        createdById: event.createdById,
      },
    };
  }

  // Check if event date has passed
  const now = new Date();
  if (event.endDate > now) {
    return {
      eligible: false,
      reason: 'Feature can only be created after the event has ended',
      event: {
        id: event.id,
        title: event.title,
        endDate: event.endDate,
        createdById: event.createdById,
      },
    };
  }

  // Check if a Feature already exists for this event
  if (event.features.length > 0) {
    return {
      eligible: false,
      reason: 'A Feature has already been created for this event',
      event: {
        id: event.id,
        title: event.title,
        endDate: event.endDate,
        createdById: event.createdById,
      },
    };
  }

  return {
    eligible: true,
    event: {
      id: event.id,
      title: event.title,
      endDate: event.endDate,
      createdById: event.createdById,
    },
  };
}

/**
 * Get events that are eligible for Feature creation for a given user.
 * Returns past events created by the user that don't have Features yet.
 */
export async function getEligibleEventsForFeature(userId: string) {
  const now = new Date();

  const events = await prisma.event.findMany({
    where: {
      createdById: userId,
      endDate: { lt: now },
      features: { none: {} },
    },
    select: {
      id: true,
      title: true,
      description: true,
      endDate: true,
      imageUrl: true,
      eventTypes: true,
      location: true,
    },
    orderBy: { endDate: 'desc' },
    take: 20,
  });

  return events;
}
