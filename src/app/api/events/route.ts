import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereClause: any = {};

    // Apply filters
    if (filter === 'upcoming') {
      whereClause.startDate = { gt: new Date() };
    } else if (filter === 'past') {
      whereClause.endDate = { lt: new Date() };
    } else if (filter === 'active') {
      whereClause.AND = [
        { startDate: { lte: new Date() } },
        { endDate: { gte: new Date() } }
      ];
    } else if (filter === 'signature') {
      whereClause.isSignature = true;
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      include: {
        organizer: { 
          select: { 
            id: true,
            name: true, 
            profileImage: true 
          } 
        },
        eventRSVPs: {
          select: {
            id: true,
            status: true,
            userId: true
          }
        },
        subEvents: {
          select: {
            id: true,
            title: true,
            type: true
          }
        },
        _count: {
          select: {
            eventRSVPs: true,
            subEvents: true,
            media: true,
            products: true
          }
        }
      },
      orderBy: [
        { isPinned: 'desc' },
        { isSignature: 'desc' },
        { startDate: 'asc' }
      ],
      take: limit,
      skip: offset
    });

    // Transform the data to include computed fields
    const transformedEvents = events.map(event => ({
      ...event,
      rsvpCount: event._count.eventRSVPs,
      subEventCount: event._count.subEvents,
      mediaCount: event._count.media,
      productCount: event._count.products,
      _count: undefined // Remove the _count object
    }));

    return NextResponse.json({ 
      success: true, 
      events: transformedEvents,
      pagination: {
        limit,
        offset,
        total: transformedEvents.length
      }
    });

  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch events' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.title || !data.startDate || !data.endDate || !data.location) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: title, startDate, endDate, location' },
        { status: 400 }
      );
    }

    // Create the event
    const event = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        location: data.location,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        coordinates: data.coordinates,
        thumbnail: data.thumbnail,
        banner: data.banner,
        website: data.website,
        type: data.type || 'general',
        status: data.status || 'upcoming',
        isSignature: data.isSignature || false,
        isPinned: data.isPinned || false,
        capacity: data.capacity,
        isPublic: data.isPublic !== false, // Default to true
        organizerId: data.organizerId
      },
      include: {
        organizer: { 
          select: { 
            id: true,
            name: true, 
            profileImage: true 
          } 
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      event,
      message: 'Event created successfully' 
    });

  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create event' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 