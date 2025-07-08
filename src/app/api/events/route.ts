import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/events - Get all events
export async function GET(request: NextRequest) {
  try {
    const events = await prisma.event.findMany({
      where: {
        status: 'published'
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        },
        featuredDesigner: {
          select: {
            id: true,
            name: true,
            profileImage: true
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
          take: 4 // Limit to 4 preview products
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
      productIds = []
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
        status: 'published'
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            profileImage: true
          }
        },
        featuredDesigner: {
          select: {
            id: true,
            name: true,
            profileImage: true
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