import { prisma } from "@/lib/prisma";
import { Festival } from './fetchEvents';

export async function fetchFestivals(): Promise<Festival[]> {
  try {
    const now = new Date();
    
    const festivals = await prisma.event.findMany({
      where: {
        eventTypes: {
          has: 'FESTIVAL'
        },
        isApproved: true,
        endDate: { gte: now }, // Only future or ongoing festivals
      },
      orderBy: {
        startDate: 'asc',
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
        subevents: {
          select: {
            id: true,
          },
        },
        rsvps: true,
      },
    });

    return festivals;
  } catch (error) {
    console.error('Error fetching festivals:', error);
    return [];
  }
}

export function getFestivalTags(festival: any): { label: string; color: string; glow?: boolean }[] {
  const tags = [];
  const now = new Date();
  const start = new Date(festival.startDate);
  const end = new Date(festival.endDate);
  const created = new Date(festival.createdAt);
  const ageHours = (now.getTime() - created.getTime()) / (1000 * 3600);

  if (start <= now && end >= now) {
    tags.push({ label: 'LIVE', color: 'bg-green-500 text-white shadow-glow', glow: true });
  }
  
  if (ageHours < 48) {
    tags.push({ label: 'New', color: 'bg-blue-100 text-blue-800' });
  }
  
  if (festival.subevents.length > 10) {
    tags.push({ label: 'Flagship', color: 'bg-purple-100 text-purple-800' });
  }
  
  if (festival.location.toLowerCase().includes('international') || festival.location.toLowerCase().includes('global')) {
    tags.push({ label: 'International', color: 'bg-orange-100 text-orange-800' });
  }

  return tags;
}

export function getFestivalStatus(festival: any): 'live' | 'upcoming' | 'past' {
  const now = new Date();
  const start = new Date(festival.startDate);
  const end = new Date(festival.endDate);
  
  if (start <= now && end >= now) {
    return 'live';
  } else if (start > now) {
    return 'upcoming';
  } else {
    return 'past';
  }
}

export function formatFestivalDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
} 