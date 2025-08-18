import { PrismaClient } from '@prisma/client';
import { EVENT_SELECT_FULL } from '@/lib/db/selects';

const prisma = new PrismaClient();

export interface EventWithRelations {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
  imageUrl?: string | null;
  heroImageUrl?: string | null;
  isPublic: boolean;
  isApproved: boolean;
  createdById: string;
  parentFestivalId?: string | null;
  createdBy: {
    id: string;
    name: string;
    companyName?: string | null;
  };
  parentFestival?: {
    id: string;
    title: string;
    description?: string | null;
    location?: string | null;
    startDate: Date;
    endDate: Date;
    imageUrl?: string | null;
    heroImageUrl?: string | null;
  } | null;
  rsvps: Array<{
    id: string;
    status: string;
    userId: string;
    user: {
      id: string;
      name: string;
    };
  }>;
}

export interface FeaturedProduct {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  vendor: {
    id: string;
    name: string;
    companyName?: string | null;
  };
  rank: number;
}

export interface TrendingProduct {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  vendor: {
    id: string;
    name: string;
    companyName?: string | null;
  };
  views: number;
  saves: number;
  score: number;
  isSpiking: boolean;
}

export interface SiblingEvent {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  location: string;
  imageUrl?: string | null;
}

export interface UserEventRecap {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  vendor: {
    id: string;
    name: string;
    companyName?: string | null;
  };
  project: {
    id: string;
    name: string;
  };
  savedAt: Date;
}

export interface LiveActivityItem {
  id: string;
  user: {
    id: string;
    name: string;
  };
  product: {
    id: string;
    name: string;
  };
  project: {
    id: string;
    name: string;
  };
  createdAt: Date;
}

export async function getEvent(eventId: string): Promise<EventWithRelations | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: EVENT_SELECT_FULL,
  });

  if (!event) return null;

  // Gate visibility (don't put non-unique filters inside findUnique.where)
  if (!event.isApproved || !event.isPublic) {
    return null;
  }

  // Transform to match EventWithRelations interface
  return {
    ...event,
    isApproved: event.isApproved ?? false, // Convert null to false
    heroImageUrl: event.imageUrl, // Map imageUrl to heroImageUrl for compatibility
  };
}

export async function getFestivalForEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      parentFestival: {
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          startDate: true,
          endDate: true,
          imageUrl: true,
        },
      },
    },
  });
  
  return event?.parentFestival || null;
}

export async function getFeaturedProductsForEvent(eventId: string): Promise<FeaturedProduct[]> {
  // For now, we'll get products from the event's linked products or vendor products
  // In a real implementation, you'd have an EventFeaturedProduct table
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      createdBy: {
        select: {
          id: true,
          name: true,
          companyName: true,
        },
      },
      linkedProducts: true,
    },
  });

  if (!event) return [];

  // Get products from the event creator (vendor)
  const products = await prisma.product.findMany({
    where: {
      vendorId: event.createdBy.id,
      isPending: false,
    },
    take: 8,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          companyName: true,
        },
      },
    },
  });

  return products.map((product, index) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    price: product.price,
    vendor: product.vendor!,
    rank: index + 1,
  }));
}

export async function getTrendingProductsForEvent(eventId: string): Promise<TrendingProduct[]> {
  // For now, we'll get products from the event's vendor with basic scoring
  // In a real implementation, you'd have EventProductStat table with views/saves
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      createdBy: {
        select: {
          id: true,
          name: true,
          companyName: true,
        },
      },
    },
  });

  if (!event) return [];

  const products = await prisma.product.findMany({
    where: {
      vendorId: event.createdBy.id,
      isPending: false,
    },
    take: 6,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          companyName: true,
        },
      },
    },
  });

  // Mock trending data - in real implementation, this would come from EventProductStat
  return products.map((product, index) => {
    const views = Math.floor(Math.random() * 100) + 10;
    const saves = Math.floor(Math.random() * 20) + 1;
    const score = saves * 3 + views * 1;
    const isSpiking = Math.random() > 0.7; // 30% chance of spiking

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      price: product.price,
      vendor: product.vendor!,
      views,
      saves,
      score,
      isSpiking,
    };
  }).sort((a, b) => b.score - a.score);
}

export async function getSiblingEventsForEvent(eventId: string): Promise<SiblingEvent[]> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      parentFestivalId: true,
      startDate: true,
    },
  });

  if (!event?.parentFestivalId) return [];

  // Get other events from the same festival on the same day
  const startOfDay = new Date(event.startDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(event.startDate);
  endOfDay.setHours(23, 59, 59, 999);

  const siblings = await prisma.event.findMany({
    where: {
      parentFestivalId: event.parentFestivalId,
      id: { not: eventId },
      startDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      isApproved: true,
      isPublic: true,
    },
    select: {
      id: true,
      title: true,
      description: true,
      startDate: true,
      endDate: true,
      location: true,
      imageUrl: true,
    },
    orderBy: {
      startDate: 'asc',
    },
    take: 5,
  });

  return siblings;
}

export async function getUserEventRecap(userId: string, eventId: string): Promise<UserEventRecap[]> {
  // For now, we'll get products from user's folders that might be related to this event
  // In a real implementation, you'd have ProjectItem with metadata.eventId
  const userFolders = await prisma.folder.findMany({
    where: { designerId: userId },
    include: {
      products: {
        include: {
          product: {
            include: {
              vendor: {
                select: {
                  id: true,
                  name: true,
                  companyName: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      },
    },
  });

  const recaps: UserEventRecap[] = [];
  
  for (const folder of userFolders) {
    for (const folderProduct of folder.products) {
      recaps.push({
        id: folderProduct.product.id,
        name: folderProduct.product.name,
        description: folderProduct.product.description,
        imageUrl: folderProduct.product.imageUrl,
        price: folderProduct.product.price,
        vendor: folderProduct.product.vendor!,
        project: {
          id: folder.id,
          name: folder.name,
        },
        savedAt: folderProduct.createdAt,
      });
    }
  }

  return recaps.slice(0, 8); // Limit to 8 items
}

export async function getLiveActivity(eventId: string, limit: number = 20): Promise<LiveActivityItem[]> {
  // For now, we'll return mock data
  // In a real implementation, you'd query EngagementEvent table
  const mockActivity: LiveActivityItem[] = [
    {
      id: '1',
      user: { id: 'user1', name: 'Sarah Chen' },
      product: { id: 'prod1', name: 'Modern Sofa' },
      project: { id: 'proj1', name: 'Living Room Redesign' },
      createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    },
    {
      id: '2',
      user: { id: 'user2', name: 'Mike Johnson' },
      product: { id: 'prod2', name: 'Accent Chair' },
      project: { id: 'proj2', name: 'Home Office' },
      createdAt: new Date(Date.now() - 12 * 60 * 1000), // 12 minutes ago
    },
    {
      id: '3',
      user: { id: 'user3', name: 'Emma Davis' },
      product: { id: 'prod3', name: 'Coffee Table' },
      project: { id: 'proj3', name: 'Family Room' },
      createdAt: new Date(Date.now() - 18 * 60 * 1000), // 18 minutes ago
    },
  ];

  return mockActivity.slice(0, limit);
}

export function formatEventDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatEventTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatEventDateTime(startDate: Date, endDate: Date): string {
  const start = formatEventDate(startDate);
  const startTime = formatEventTime(startDate);
  const endTime = formatEventTime(endDate);
  
  if (startDate.toDateString() === endDate.toDateString()) {
    return `${start} • ${startTime} - ${endTime}`;
  } else {
    const end = formatEventDate(endDate);
    return `${start} ${startTime} - ${end} ${endTime}`;
  }
} 