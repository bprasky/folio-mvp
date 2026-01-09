export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { assertCanCreate } from '@/lib/authz/createGuard';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Check create permission using the new permission system
    const guardResult = await assertCanCreate('event');
    if (!guardResult.allowed || !guardResult.user) {
      return guardResult.error!;
    }

    const userId = guardResult.user.id;

    // Debug: Log the content type and try to parse the body
    const contentType = request.headers.get('content-type');
    console.log('Content-Type:', contentType);

    let body: any;
    if (contentType?.includes('application/json')) {
      body = await request.json();
    } else if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
      // Parse JSON strings back to objects
      Object.keys(body).forEach((key: string) => {
        if (typeof body[key] === 'string' && (body[key].startsWith('[') || body[key].startsWith('{'))) {
          try {
            body[key] = JSON.parse(body[key]);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }
      });
    } else {
      // Try JSON as fallback
      try {
        body = await request.json();
      } catch (e) {
        console.error('Failed to parse request body:', e);
        return NextResponse.json(
          { error: 'Invalid request format' },
          { status: 400 }
        );
      }
    }

    console.log('Parsed body:', body);
    const { title, description, location, startDate, endDate, parentFestivalId, eventType } = body;

    // Validate required fields
    if (!title || !description || !location || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    // If parentFestivalId is provided, validate it exists and dates are within festival range
    if (parentFestivalId) {
      const parentFestival = await prisma.event.findFirst({
        where: {
          id: parentFestivalId,
          eventTypes: {
            has: 'FESTIVAL'
          },
          isApproved: true,
        },
      });

      if (!parentFestival) {
        return NextResponse.json(
          { error: 'Parent festival not found or not approved' },
          { status: 404 }
        );
      }

      // Check if event dates are within festival range
      if (start < parentFestival.startDate || end > parentFestival.endDate) {
        return NextResponse.json(
          { error: 'Event dates must be within the festival period' },
          { status: 400 }
        );
      }
    }

    // Create the event (vendor events require approval)
    const event = await prisma.event.create({
      data: {
        title,
        description,
        location,
        startDate: start,
        endDate: end,
        eventTypes: eventType ? [eventType.toUpperCase()] : ['OTHER'],
        isPublic: true,
        isApproved: true, // Vendor events auto-approved for now
        requiresApproval: false,
        createdById: userId,
        parentFestivalId: parentFestivalId || null,
        // Add default values for new fields
        isVirtual: false,
        timezone: null,
        mapLink: null,
        capacity: null,
        inviteType: 'open',
        targetUserRoles: [],
        isSponsored: false,
        promotionTier: 0,
        displayBoostUntil: null,
        eventTags: [],
        designStyles: [],
        rsvpDeadline: null,
        waitlistEnabled: false,
        allowReshare: true,
        eventHashtag: null,
        createdByReputationScore: null,
        mediaGallery: [],
        linkedProducts: [],
        allowChat: false,
        chatGroupLink: null,
        postEventMessage: null,
        includesFood: false,
        rejectionNotes: null,
        imageUrl: null,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        parentFestival: parentFestivalId ? {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
          },
        } : undefined,
      },
    });

    return NextResponse.json({
      event,
      message: 'Event created successfully!'
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating vendor event:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to create event';
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
} 