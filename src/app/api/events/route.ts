import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/events - Get all events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get('type');
    const parentEventId = searchParams.get('parentEventId');
    const includeApproved = searchParams.get('includeApproved') === 'true';

    const whereClause: any = {
      AND: [
        {
          OR: [
            { status: 'published' },
            ...(includeApproved ? [{ approvalStatus: 'approved' }] : [])
          ]
        }
      ]
    };

    if (eventType) {
      whereClause.AND.push({ eventType });
    }

    if (parentEventId) {
      whereClause.AND.push({ parentEventId });
    } else if (eventType === 'festival') {
      whereClause.AND.push({ parentEventId: null });
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            profileType: true
          }
        },
        featuredDesigner: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        },
        parentEvent: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        },
        childEvents: {
          where: {
            approvalStatus: 'approved'
          },
          select: {
            id: true,
            title: true,
            slug: true,
            date: true,
            location: true,
            coverImage: true,
            hostType: true,
            hostName: true
          }
        },
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                price: true,
                brand: true
              }
            }
          },
          take: 4
        },
        _count: {
          select: {
            attendees: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

// POST /api/events - Create a new event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      title,
      slug,
      description,
      date,
      location,
      coverImage,
      hostType,
      hostId,
      hostName,
      maxAttendees,
      isPublic,
      featuredDesignerId,
      createdById,
      createdByRole,
      productIds = [],
      eventType = 'event',
      parentEventId
    } = body;

    // Validate required fields
    if (!title || !slug || !date || !location || !coverImage || !hostType || !hostName || !createdById) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existingEvent = await prisma.event.findUnique({
      where: { slug }
    });

    if (existingEvent) {
      return NextResponse.json(
        { error: 'An event with this slug already exists' },
        { status: 400 }
      );
    }

    // Determine status and approval based on creator role
    let status = 'draft';
    let approvalStatus = 'pending';
    
    if (createdByRole === 'admin') {
      status = 'published';
      approvalStatus = 'approved';
    } else if (createdByRole === 'vendor' || createdByRole === 'lender') {
      // Vendors and lenders need approval
      status = 'draft';
      approvalStatus = 'pending';
    }

    // Create the event
    const event = await prisma.event.create({
      data: {
        title,
        slug,
        description,
        date: new Date(date),
        location,
        coverImage,
        hostType,
        hostId,
        hostName,
        maxAttendees,
        isPublic: isPublic ?? true,
        featuredDesignerId,
        createdById,
        status,
        eventType,
        parentEventId,
        approvalStatus
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            profileType: true
          }
        },
        featuredDesigner: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        },
        parentEvent: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        }
      }
    });

    // Add featured products if provided
    if (productIds.length > 0) {
      await prisma.eventProduct.createMany({
        data: productIds.map((productId: string) => ({
          eventId: event.id,
          productId
        }))
      });
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}