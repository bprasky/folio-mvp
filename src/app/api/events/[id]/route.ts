import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      include: {
        organizer: { 
          select: { 
            id: true,
            name: true, 
            profileImage: true 
          } 
        },
        eventRSVPs: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true
              }
            }
          }
        },
        subEvents: {
          include: {
            media: true,
            products: {
              include: {
                product: true
              }
            },
            rsvps: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    profileImage: true
                  }
                }
              }
            }
          }
        },
        media: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImage: true
              }
            }
          }
        },
        products: {
          include: {
            product: true
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
      }
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Transform the data to include computed fields
    const transformedEvent = {
      ...event,
      rsvpCount: event._count.eventRSVPs,
      subEventCount: event._count.subEvents,
      mediaCount: event._count.media,
      productCount: event._count.products,
      _count: undefined // Remove the _count object
    };

    return NextResponse.json({ 
      success: true, 
      event: transformedEvent
    });

  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    
    // Check if event exists
    const existingEvent = await prisma.event.findUnique({
      where: { id: params.id }
    });

    if (!existingEvent) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Update the event
    const updatedEvent = await prisma.event.update({
      where: { id: params.id },
      data: {
        title: data.title,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        location: data.location,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        coordinates: data.coordinates,
        thumbnail: data.thumbnail,
        banner: data.banner,
        website: data.website,
        type: data.type,
        status: data.status,
        isSignature: data.isSignature,
        isPinned: data.isPinned,
        capacity: data.capacity,
        isPublic: data.isPublic,
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
      event: updatedEvent,
      message: 'Event updated successfully' 
    });

  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update event' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if event exists
    const existingEvent = await prisma.event.findUnique({
      where: { id: params.id }
    });

    if (!existingEvent) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Delete the event (cascade will handle related records)
    await prisma.event.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Event deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete event' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 