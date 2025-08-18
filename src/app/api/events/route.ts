import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';
import { EventType } from '@prisma/client';
import { z } from 'zod';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Zod schema for POST validation
const createEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startsAt: z.string().min(1, "Start date is required"),
  endsAt: z.string().min(1, "End date is required"),
  city: z.string().optional(),
  venue: z.string().optional(),
  festivalId: z.string().optional(),
  eventTypes: z.array(z.string()).min(1, "At least one event type is required"),
  heroImageUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
});

// Helper function to map string array to EventType array
function mapToEventTypes(types: string[]): EventType[] {
  const validTypes = types.filter(type => 
    Object.values(EventType).includes(type as EventType)
  );
  
  if (validTypes.length !== types.length) {
    const invalidTypes = types.filter(type => 
      !Object.values(EventType).includes(type as EventType)
    );
    throw new Error(`Invalid event types: ${invalidTypes.join(', ')}`);
  }
  
  return validTypes as EventType[];
}

// Helper function to check if user is ADMIN
async function requireAdmin() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.role || session.user.role !== 'ADMIN') {
    return false;
  }
  
  return true;
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is ADMIN
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all events
    const events = await prisma.event.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        location: true,
        parentFestivalId: true,
        eventTypes: true,
        imageUrl: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform to match expected format
    const response = events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      startsAt: event.startDate,
      endsAt: event.endDate,
      city: event.location,
      venue: event.location,
      festivalId: event.parentFestivalId,
      eventTypes: event.eventTypes,
      heroImageUrl: event.imageUrl,
      coverImageUrl: event.imageUrl,
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/events error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if user is ADMIN
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate with Zod
    const validatedData = createEventSchema.parse(body);

    // Prepare create data
    const createData: any = {
      title: validatedData.title,
    };

    if (validatedData.description !== undefined) {
      createData.description = validatedData.description;
    }
    if (validatedData.startsAt !== undefined) {
      createData.startDate = new Date(validatedData.startsAt);
    }
    if (validatedData.endsAt !== undefined) {
      createData.endDate = new Date(validatedData.endsAt);
    }
    if (validatedData.city !== undefined || validatedData.venue !== undefined) {
      // Combine city and venue into location
      const location = [validatedData.city, validatedData.venue]
        .filter(Boolean)
        .join(', ');
      createData.location = location;
    }
    if (validatedData.festivalId !== undefined) {
      createData.parentFestivalId = validatedData.festivalId;
    }
    if (validatedData.eventTypes !== undefined) {
      try {
        createData.eventTypes = mapToEventTypes(validatedData.eventTypes);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Invalid event types' },
          { status: 400 }
        );
      }
    }
    if (validatedData.heroImageUrl !== undefined || validatedData.coverImageUrl !== undefined) {
      // Use heroImageUrl as primary image, fallback to coverImageUrl
      createData.imageUrl = validatedData.heroImageUrl || validatedData.coverImageUrl;
    }

    // Set default values for required fields
    if (!createData.startDate) {
      createData.startDate = new Date();
    }
    if (!createData.endDate) {
      createData.endDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours later
    }
    if (!createData.eventTypes || createData.eventTypes.length === 0) {
      createData.eventTypes = [EventType.OTHER];
    }

    // Create event
    const newEvent = await prisma.event.create({
      data: createData,
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        location: true,
        parentFestivalId: true,
        eventTypes: true,
        imageUrl: true,
      }
    });

    // Transform response to match expected format
    const response = {
      id: newEvent.id,
      title: newEvent.title,
      description: newEvent.description,
      startsAt: newEvent.startDate,
      endsAt: newEvent.endDate,
      city: newEvent.location,
      venue: newEvent.location,
      festivalId: newEvent.parentFestivalId,
      eventTypes: newEvent.eventTypes,
      heroImageUrl: newEvent.imageUrl,
      coverImageUrl: newEvent.imageUrl,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('POST /api/events error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 