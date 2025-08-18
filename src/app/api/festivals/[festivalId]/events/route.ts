import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { festivalId: string } }
) {
  try {
    const { festivalId } = params;

    // Get all events that belong to this festival (excluding the parent festival itself)
    const events = await prisma.event.findMany({
      where: {
        parentFestivalId: festivalId,
        isApproved: true,
        NOT: { eventTypes: { has: 'FESTIVAL' } }
      },
      select: {
        id: true,
        title: true,
        name: true,
        description: true,
        location: true,
        startDate: true,
        endDate: true,
        imageUrl: true,
        eventTypes: true,
        createdAt: true,
        _count: {
          select: {
            rsvps: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Transform the data to match the expected format
    const formattedEvents = events.map(event => ({
      id: event.id,
      name: event.title ?? event.name, // Map title to name for UI compatibility
      date: event.startDate.toISOString().split('T')[0],
      time: event.startDate.toTimeString().split(' ')[0].substring(0, 5),
      location: event.location,
      description: event.description,
      imageUrl: event.imageUrl,
      eventTypes: event.eventTypes,
      rsvp_count: event._count.rsvps,
      rsvp_change_24h: 0, // TODO: Calculate from RSVP history
      created_at: event.createdAt.toISOString(),
      createdBy: event.createdBy,
    }));

    return NextResponse.json(formattedEvents);
  } catch (error) {
    console.error('Error fetching festival events:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 