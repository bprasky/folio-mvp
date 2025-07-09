import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/vendor/subevents - Create a new sub-event
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Validate required fields
    const { title, eventId, startTime, endTime, type } = data;
    if (!title || !eventId || !startTime || !endTime || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: title, eventId, startTime, endTime, type' },
        { status: 400 }
      );
    }

    // Verify the event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // TODO: Add vendor auth check - for now use a default vendor user
    const vendorUser = await prisma.user.findFirst({
      where: { profileType: 'vendor' }
    });

    if (!vendorUser) {
      return NextResponse.json(
        { error: 'No vendor user found' },
        { status: 403 }
      );
    }

    const subEvent = await prisma.subEvent.create({
      data: {
        ...data,
        createdById: vendorUser.id,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        visibility: data.visibility || 'public',
        ticketingType: data.ticketingType || 'open',
      },
      include: {
        event: {
          select: {
            id: true,
            title: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(subEvent);
  } catch (error) {
    console.error('Error creating sub-event:', error);
    return NextResponse.json(
      { error: 'Failed to create sub-event' },
      { status: 500 }
    );
  }
}

// GET /api/vendor/subevents - List vendor's sub-events
export async function GET(req: NextRequest) {
  try {
    // TODO: Get vendor ID from auth/session
    const vendorUser = await prisma.user.findFirst({
      where: { profileType: 'vendor' }
    });

    if (!vendorUser) {
      return NextResponse.json(
        { error: 'No vendor user found' },
        { status: 403 }
      );
    }

    const subEvents = await prisma.subEvent.findMany({
      where: {
        createdById: vendorUser.id
      },
      orderBy: { startTime: 'desc' },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        subEventRSVPs: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        subEventInvites: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            subEventRSVPs: true,
            subEventInvites: true
          }
        }
      }
    });

    return NextResponse.json(subEvents);
  } catch (error) {
    console.error('Error fetching sub-events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sub-events' },
      { status: 500 }
    );
  }
}

function calculateTrendingScore(subEvent: any): number {
  let score = 0;
  
  // Base score from views
  score += (subEvent.viewCount || 0) * 0.1;
  
  // RSVP engagement
  score += (subEvent._count.rsvps || 0) * 2;
  
  // Media engagement
  score += (subEvent._count.media || 0) * 1.5;
  
  // Product engagement
  const productEngagement = subEvent.products.reduce((sum: number, p: any) => {
    return sum + p.product.scanCount + p.product.likeCount + p.product.saveCount;
  }, 0);
  score += productEngagement * 0.5;
  
  // Recency boost (events in the next 7 days get a boost)
  const now = new Date();
  const eventDate = new Date(subEvent.startTime);
  const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilEvent >= 0 && daysUntilEvent <= 7) {
    score += (7 - daysUntilEvent) * 5; // Boost decreases as event gets closer
  }
  
  // Featured boost
  if (subEvent.isFeatured) {
    score += 50;
  }
  
  // Boosted boost
  if (subEvent.isBoosted) {
    score += 30;
  }
  
  return Math.round(score);
} 