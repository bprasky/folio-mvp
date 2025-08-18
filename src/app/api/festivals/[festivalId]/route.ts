import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import { EVENT_SELECT_BASE } from '@/lib/db/selects';

const prisma = new PrismaClient();

export async function GET(request: NextRequest, { params }: { params: { festivalId: string } }) {
  const { festivalId } = params;

  try {
    const festival = await prisma.event.findUnique({
      where: { id: festivalId },
      select: {
        ...EVENT_SELECT_BASE,
        createdBy: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
    });

    if (!festival) {
      return NextResponse.json({ error: 'Festival not found' }, { status: 404 });
    }

    // Check if it's a festival
    if (!festival.eventTypes?.includes('FESTIVAL')) {
      return NextResponse.json({ error: 'Not a festival' }, { status: 400 });
    }

    return NextResponse.json(festival);
  } catch (error) {
    console.error('Error fetching festival:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { festivalId: string } }) {
  const { festivalId } = params;
  
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, location, startDate, endDate, imageUrl } = body;

    // Validate required fields
    if (!title || !description || !location || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Update the festival
    const updatedFestival = await prisma.event.update({
      where: { id: festivalId },
      data: {
        title,
        description,
        location,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        imageUrl: imageUrl || null,
      },
      select: {
        ...EVENT_SELECT_BASE,
        createdBy: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
    });

    return NextResponse.json(updatedFestival);
  } catch (error) {
    console.error('Error updating festival:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 