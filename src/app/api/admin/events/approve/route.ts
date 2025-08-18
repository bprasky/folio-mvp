import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
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