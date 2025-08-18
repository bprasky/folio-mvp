import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { EVENT_SELECT_BASE } from '@/lib/db/selects';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const festivals = await prisma.event.findMany({
      where: {
        isApproved: true,
        endDate: {
          gte: new Date(),
        },
      },
      orderBy: {
        startDate: 'asc',
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
        subevents: {
          select: {
            id: true,
          },
        },
        rsvps: true,
      },
    });

    return NextResponse.json(festivals);
  } catch (error) {
    console.error('Error fetching festivals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch festivals' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // ...festival creation logic...
}

export async function PATCH(req: NextRequest) {
  // ...festival update logic...
} 