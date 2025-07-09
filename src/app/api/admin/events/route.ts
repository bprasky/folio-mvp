import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { SmartImageSearch } from '@/lib/imageSearch';

const prisma = new PrismaClient();

// POST /api/admin/events - Create a new event
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Validate required fields
    const { title, startDate, endDate, location } = data;
    if (!title || !startDate || !endDate || !location) {
      return NextResponse.json(
        { error: 'Missing required fields: title, startDate, endDate, location' },
        { status: 400 }
      );
    }

    // TODO: Add admin auth check - for now use a default admin user
    const adminUser = await prisma.user.findFirst({
      where: { profileType: 'admin' }
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: 'No admin user found' },
        { status: 403 }
      );
    }

    // Smart image auto-population
    let eventData = { ...data };
    
    // If no banner or thumbnail provided, try to auto-populate
    if (!data.banner || !data.thumbnail) {
      console.log('🖼️ Auto-populating images for event:', title);
      
      try {
        const autoImages = await SmartImageSearch.autoPopulateImages(data, 'event');
        
        if (autoImages.banner && !data.banner) {
          eventData.banner = autoImages.banner;
          console.log('✅ Auto-populated banner image');
        }
        
        if (autoImages.thumbnail && !data.thumbnail) {
          eventData.thumbnail = autoImages.thumbnail;
          console.log('✅ Auto-populated thumbnail image');
        }
      } catch (imageError) {
        console.warn('⚠️ Image auto-population failed:', imageError);
        // Continue with event creation even if image search fails
      }
    }

    const event = await prisma.event.create({
      data: {
        title: eventData.title,
        description: eventData.description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location: eventData.location,
        capacity: eventData.capacity,
        isPublic: eventData.isPublic,
        type: eventData.type,
        status: 'upcoming',
        createdById: adminUser.id,
        organizerId: adminUser.id,
        banner: eventData.banner,
        thumbnail: eventData.thumbnail
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        organizer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        subEvents: {
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

// GET /api/admin/events - List all events with details
export async function GET() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        subEvents: {
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            subEventRSVPs: true,
            subEventInvites: true
          }
        },
        _count: {
          select: {
            subEvents: true
          }
        }
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