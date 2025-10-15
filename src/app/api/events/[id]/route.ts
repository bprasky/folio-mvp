import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import prisma from '@/lib/prisma';
import { EventType } from '@prisma/client';
import { z } from 'zod';
import { EVENT_SELECT_BASE } from '@/lib/db/selects';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Zod schema for PATCH validation
const updateEventSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().optional(),
  startsAt: z.string().min(1, "Start date is required").optional(),
  endsAt: z.string().min(1, "End date is required").optional(),
  city: z.string().optional(),
  venue: z.string().optional(),
  festivalId: z.string().optional(),
  eventTypes: z.array(z.string()).optional(),
  heroImageUrl: z.string().url().optional().or(z.literal('')),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  linkedProducts: z.array(z.string()).optional(),
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
  
  console.log('🔍 [events API] Session check:', {
    hasSession: !!session,
    userId: session?.user?.id,
    userRole: session?.user?.role,
    userEmail: session?.user?.email
  });
  
  if (!session?.user?.role || session.user.role !== 'ADMIN') {
    console.log('❌ [events API] Admin check failed:', {
      hasRole: !!session?.user?.role,
      role: session?.user?.role,
      expected: 'ADMIN'
    });
    return false;
  }
  
  console.log('✅ [events API] Admin check passed');
  return true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if user is ADMIN
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate id parameter
    if (!params.id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Find event by ID
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      select: {
        ...EVENT_SELECT_BASE,
        linkedProducts: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Transform to match expected response format
    const response = {
      id: event.id,
      title: event.title,
      description: event.description,
      startsAt: event.startDate,
      endsAt: event.endDate,
      city: event.location, // Assuming location contains city info
      venue: event.location, // Assuming location contains venue info
      festivalId: event.parentFestivalId,
      eventTypes: event.eventTypes,
      heroImageUrl: event.imageUrl,
      coverImageUrl: event.imageUrl,
      linkedProducts: event.linkedProducts || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/events/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if user is ADMIN
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate id parameter
    if (!params.id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate with Zod
    const validatedData = updateEventSchema.parse(body);

    // Check if event exists
    const existingEvent = await prisma.event.findUnique({
      where: { id: params.id }
    });

    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title;
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }
    if (validatedData.startsAt !== undefined) {
      updateData.startDate = new Date(validatedData.startsAt);
    }
    if (validatedData.endsAt !== undefined) {
      updateData.endDate = new Date(validatedData.endsAt);
    }
    if (validatedData.city !== undefined || validatedData.venue !== undefined) {
      // Combine city and venue into location
      const location = [validatedData.city, validatedData.venue]
        .filter(Boolean)
        .join(', ');
      updateData.location = location;
    }
    if (validatedData.festivalId !== undefined) {
      updateData.parentFestivalId = validatedData.festivalId;
    }
    if (validatedData.eventTypes !== undefined) {
      try {
        updateData.eventTypes = mapToEventTypes(validatedData.eventTypes);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Invalid event types' },
          { status: 400 }
        );
      }
    }
    if (validatedData.heroImageUrl !== undefined || validatedData.coverImageUrl !== undefined) {
      // Use heroImageUrl as primary image, fallback to coverImageUrl
      updateData.imageUrl = validatedData.heroImageUrl || validatedData.coverImageUrl;
    }
    if (validatedData.linkedProducts !== undefined) {
      updateData.linkedProducts = validatedData.linkedProducts;
    }

    // Update event
    const updatedEvent = await prisma.event.update({
      where: { id: params.id },
      data: updateData,
      select: EVENT_SELECT_BASE,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.info('[event PATCH] included keys:', Object.keys(updateData));
    }

    // Transform response to match expected format
    const response = {
      id: updatedEvent.id,
      title: updatedEvent.title,
      description: updatedEvent.description,
      startsAt: updatedEvent.startDate,
      endsAt: updatedEvent.endDate,
      city: updatedEvent.location,
      venue: updatedEvent.location,
      festivalId: updatedEvent.parentFestivalId,
      eventTypes: updatedEvent.eventTypes,
      heroImageUrl: updatedEvent.imageUrl,
      coverImageUrl: updatedEvent.imageUrl,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('PATCH /api/events/[id] error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      eventId: params.id,
      body: body
    });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if user is ADMIN
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate id parameter
    if (!params.id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Load event by id selecting eventTypes and festivalId
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      select: {
        eventTypes: true,
        parentFestivalId: true,
      }
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Check if event is a festival
    if (event.eventTypes.includes(EventType.FESTIVAL)) {
      return NextResponse.json(
        { error: 'Deleting festivals is disabled.' },
        { status: 405 }
      );
    }

    // Delete the event
    await prisma.event.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/events/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 