import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { verb, eventId, productId } = body;

    // Validate required fields
    if (!verb || !eventId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate verb
    const validVerbs = ['VIEW_EVENT', 'VIEW_PRODUCT', 'ADD_TO_CAL', 'FOLLOW_VENDOR', 'CHECK_IN', 'RSVP', 'SAVE_PRODUCT'];
    if (!validVerbs.includes(verb)) {
      return NextResponse.json({ error: 'Invalid verb' }, { status: 400 });
    }

    // Create engagement event
    const engagementEvent = await prisma.engagementEvent.create({
      data: {
        userId: session?.user?.id || 'anonymous',
        eventId: eventId,
        productId: productId,
        verb: verb,
        meta: {
          timestamp: new Date().toISOString(),
          userAgent: request.headers.get('user-agent'),
          referer: request.headers.get('referer'),
        },
      },
    });

    return NextResponse.json({ 
      ok: true, 
      eventId: engagementEvent.id 
    });
  } catch (error) {
    console.error('Error tracking analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 