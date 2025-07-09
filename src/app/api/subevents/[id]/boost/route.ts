import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { boosted } = await request.json();

    // Calculate boost expiration (7 days from now)
    const boostExpiresAt = boosted ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;

    // Use raw SQL to avoid Prisma client issues
    const result = await prisma.$executeRaw`
      UPDATE sub_events 
      SET "isBoosted" = ${boosted}, "boostExpiresAt" = ${boostExpiresAt}
      WHERE id = ${id}
    `;

    const updatedSubEvent = await prisma.subEvent.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    return NextResponse.json({
      subEvent: updatedSubEvent,
      message: boosted ? 'Sub-event boosted successfully' : 'Boost removed successfully'
    });

  } catch (error) {
    console.error('Error updating sub-event boost:', error);
    return NextResponse.json(
      { error: 'Failed to update sub-event boost' },
      { status: 500 }
    );
  }
} 