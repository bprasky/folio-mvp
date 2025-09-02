import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  // STRICT GUARD: only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Seed endpoint only available in development' },
      { status: 403 }
    );
  }

  try {
    // SAFE: Find or create vendor without transaction first
    let vendor = await prisma.user.findUnique({
      where: { email: 'demo-vendor@example.com' }
    });

    if (!vendor) {
      vendor = await prisma.user.create({
        data: {
          email: 'demo-vendor@example.com',
          name: 'Demo Vendor',
          companyName: 'Demo Design Co.',
          role: 'VENDOR',
        },
      });
    }

        // SAFE: Simple approach - create just one test event
    const inserted = {
      anchor: 0,
      flex: 0,
      backfill: 0,
    };

    // Check if test event already exists
    const existingEvent = await prisma.event.findFirst({
      where: {
        title: 'Test Flexible Event',
        createdById: vendor.id,
        description: { contains: '[SEED_EVENTS_V1]' }
      }
    });

    if (!existingEvent) {
      // SAFE: Create one simple test event
      const event = await prisma.event.create({
        data: {
          title: 'Test Flexible Event',
          description: 'A test event for flexible scheduling [SEED_EVENTS_V1]',
          location: 'Virtual',
          startDate: new Date('2024-12-15T10:00:00Z'),
          endDate: new Date('2024-12-15T12:00:00Z'),
          createdById: vendor.id,
          isPublic: true,
          isApproved: true,
          eventTypes: ['WORKSHOP'],
        },
      });

      // SAFE: Create metrics
      await prisma.eventMetrics.create({
        data: {
          eventId: event.id,
          views: 100,
          impressions: 200,
          clicks: 10,
          saves: 5,
          rsvps: 15,
          bookings: 2,
        },
      });

      inserted.flex = 1;
    }

        // Additional events can be added here later

        return NextResponse.json({
      success: true,
      message: 'Events seeded successfully',
      inserted,
    });
  } catch (error) {
    console.error('Error seeding events:', error);
    return NextResponse.json(
      { error: 'Failed to seed events' },
      { status: 500 }
    );
  }
}
