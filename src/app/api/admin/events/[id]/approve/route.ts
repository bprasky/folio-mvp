export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const eventId = params.id;

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        isApproved: true,
        requiresApproval: false,
        rejectionNotes: null
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({
      message: 'Event approved successfully',
      event
    });
  } catch (error: any) {
    if (error.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.status === 403) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Error approving event:', error);
    return NextResponse.json(
      { error: 'Failed to approve event' },
      { status: 500 }
    );
  }
}
