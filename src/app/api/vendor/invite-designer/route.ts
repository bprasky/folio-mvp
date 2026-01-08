export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/vendor/invite-designer
 * Marks a designer as invited to an event (for demo purposes)
 * In production, this would send an actual email invitation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { designerId, designerEmail, vendorId, eventId } = body;

    if (!designerId && !designerEmail) {
      return NextResponse.json(
        { error: 'Designer ID or email is required' },
        { status: 400 }
      );
    }

    // For demo: create or update EventDesignerEdge to mark as invited
    if (eventId) {
      try {
        await prisma.eventDesignerEdge.upsert({
          where: {
            eventId_designerId: {
              eventId,
              designerId: designerId || designerEmail, // Use email as fallback
            },
          },
          update: {
            edgeType: 'invited',
            weight: 1.0,
          },
          create: {
            eventId,
            designerId: designerId || designerEmail,
            edgeType: 'invited',
            weight: 1.0,
          },
        });
      } catch (edgeError: any) {
        // Fail-soft if EventDesignerEdge doesn't exist or has issues
        console.warn('[invite-designer] Edge creation skipped:', edgeError?.code || edgeError?.message);
      }
    }

    // TODO: In production, send actual email invitation
    // For demo, we just mark it as invited in the database

    return NextResponse.json({
      success: true,
      message: 'Designer invited successfully',
    });
  } catch (error: any) {
    console.error('[invite-designer] Error:', error);
    return NextResponse.json(
      { error: 'Failed to invite designer', details: error.message },
      { status: 500 }
    );
  }
}




