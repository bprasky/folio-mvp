export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { normalizeRole, canAccessAdmin } from '@/lib/permissions';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canAccessAdmin(normalizeRole(session.user.role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
  } catch (error) {
    console.error('Error updating event approval:', error);
    return NextResponse.json({ error: 'Failed to update event approval' }, { status: 500 });
  }
} 