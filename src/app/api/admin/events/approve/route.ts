export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { eventId, approved } = body;

    if (!eventId || approved === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        isApproved: approved,
      },
    });

    return NextResponse.json({
      event,
      message: approved ? 'Event approved successfully' : 'Event rejected successfully'
    });
  } catch (error: any) {
    if (error.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.status === 403) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Error updating event approval:', error);
    return NextResponse.json({ error: 'Failed to update event approval' }, { status: 500 });
  }
}
