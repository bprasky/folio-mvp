import { prisma } from "@/lib/prisma";
import { EVENT_SELECT_FEED } from "@/lib/db/selects";
import { EventType } from '@prisma/client';

export interface Event {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
  isVirtual: boolean;
  eventTypes: string[];
  isPublic: boolean;
  isApproved: boolean | null;
  imageUrl: string | null;
  createdBy: {
    id: string;
    name: string;
    companyName: string | null;
    role: string;
  };
  parentFestival?: {
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
  } | null;
  rsvps: any[];
}

export interface Festival {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
  eventTypes: string[];
  isPublic: boolean;
  isApproved: boolean | null;
  imageUrl: string | null;
  createdBy: {
    id: string;
    name: string;
    companyName: string | null;
  };
  subevents: any[];
  rsvps: any[];
}

export async function fetchEvents(userRole?: string, userId?: string): Promise<any[]> {
  const baseWhere = {
    NOT: {
      eventTypes: {
        has: EventType.FESTIVAL
      }
    },
    startDate: {
      gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14), // 14 days ago
    },
    OR: [
      { isPublic: true },
      ...(userId ? [{ createdById: userId }] : []),
    ],
  };

  const events = await prisma.event.findMany({
    where: baseWhere,
    orderBy: { startDate: 'asc' },
    select: EVENT_SELECT_FEED,
  });

  return events;
}

export async function fetchUserRSVPs(userId: string) {
  if (!userId) return [];
  
  const rows = await prisma.eventRSVP.findMany({
    where: { userId },
    select: {
      id: true,
      eventId: true,
      userId: true,
      status: true,
      createdAt: true,
    },
  });

  return rows;
}

export async function createRSVP(eventId: string, userId: string, status: string = 'attending', notes?: string) {
  try {
    const rsvp = await prisma.eventRSVP.upsert({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      update: {
        status,
        notes,
      },
      create: {
        userId,
        eventId,
        status,
        notes,
      },
    });
    return rsvp;
  } catch (error) {
    console.error('Error creating RSVP:', error);
    throw error;
  }
}

export function getEventTypeIcon(type: string): string {
  switch (type.toLowerCase()) {
    case 'booth': return '🏪';
    case 'product launch': return '🚀';
    case 'happy hour': return '🍸';
    case 'lunch & learn': return '🥗';
    case 'design panel': return '🎤';
    case 'demonstration': return '🖥️';
    case 'workshop': return '🔧';
    case 'networking': return '🤝';
    case 'exhibition': return '🎨';
    default: return '📅';
  }
} 