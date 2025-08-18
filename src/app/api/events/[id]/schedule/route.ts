import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;

    // Get the current event to find its festival
    const currentEvent = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        parentFestivalId: true,
      },
    });

    if (!currentEvent) {
      return NextResponse.json({ events: [] });
    }

    // If this event is part of a festival, get sibling events
    if (currentEvent.parentFestivalId) {
      const siblingEvents = await prisma.event.findMany({
        where: {
          parentFestivalId: currentEvent.parentFestivalId,
          id: { not: eventId }, // Exclude current event
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
        take: 10,
      });

      return NextResponse.json({
        events: siblingEvents.map(event => ({
          ...event,
          startDate: event.startDate,
          endDate: event.endDate,
        })),
      });
    }

    // If not part of a festival, return empty array
    return NextResponse.json({ events: [] });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json(
      { events: [] },
      { status: 500 }
    );
  }
}
