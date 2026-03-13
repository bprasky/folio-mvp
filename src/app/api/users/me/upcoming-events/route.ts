export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/users/me/upcoming-events
 * Returns up to 3 upcoming event RSVPs for the current user (for badge display)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ rsvps: [] });
    }

    const rsvps = await prisma.eventRSVP.findMany({
      where: {
        userId: session.user.id,
        status: 'attending',
        event: { endDate: { gte: new Date() } },
      },
      select: {
        eventId: true,
        event: {
          select: {
            title: true,
            startDate: true,
            location: true,
          },
        },
      },
      orderBy: { event: { startDate: 'asc' } },
      take: 3,
    });

    return NextResponse.json({
      rsvps: rsvps.map(r => ({
        eventId: r.eventId,
        eventTitle: r.event.title,
        eventStartDate: r.event.startDate.toISOString(),
        eventLocation: r.event.location,
      })),
    });
  } catch {
    return NextResponse.json({ rsvps: [] });
  }
}
