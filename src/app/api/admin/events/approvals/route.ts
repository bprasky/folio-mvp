import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const events = await prisma.event.findMany({
      where: {
        isApproved: false
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching pending events:', error);
    return NextResponse.json({ error: 'Failed to fetch pending events' }, { status: 500 });
  }
} 