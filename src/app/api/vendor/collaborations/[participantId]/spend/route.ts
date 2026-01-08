export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVendorContext } from '@/lib/auth/vendorContext';

/**
 * PATCH /api/vendor/collaborations/[participantId]/spend
 * Updates spend settings for a collaboration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { participantId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vendorCtx = await getVendorContext();
    if (!vendorCtx?.vendorOrgId) {
      return NextResponse.json({ error: 'Vendor organization not found' }, { status: 403 });
    }

    const { participantId } = params;
    const body = await request.json();

    // Validate participant belongs to vendor org
    const participant = await prisma.projectParticipant.findUnique({
      where: { id: participantId },
      include: {
        org: {
          select: {
            id: true,
            type: true,
          },
        },
      },
    });

    if (!participant) {
      return NextResponse.json({ error: 'Collaboration not found' }, { status: 404 });
    }

    if (participant.orgId !== vendorCtx.vendorOrgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (participant.side !== 'VENDOR') {
      return NextResponse.json({ error: 'Invalid collaboration' }, { status: 400 });
    }

    // Validate input
    const updates: any = {};

    if (body.spendEnabled !== undefined) {
      updates.spendEnabled = Boolean(body.spendEnabled);
    }

    if (body.spendPerSaveUsd !== undefined) {
      const value = parseFloat(body.spendPerSaveUsd);
      if (isNaN(value) || value < 0) {
        return NextResponse.json({ error: 'spendPerSaveUsd must be non-negative' }, { status: 400 });
      }
      updates.spendPerSaveUsd = value;
    }

    if (body.spendPerClickUsd !== undefined) {
      const value = parseFloat(body.spendPerClickUsd);
      if (isNaN(value) || value < 0) {
        return NextResponse.json({ error: 'spendPerClickUsd must be non-negative' }, { status: 400 });
      }
      updates.spendPerClickUsd = value;
    }

    if (body.budgetCapUsd !== undefined) {
      const value = parseFloat(body.budgetCapUsd);
      if (isNaN(value) || value < 0) {
        return NextResponse.json({ error: 'budgetCapUsd must be non-negative' }, { status: 400 });
      }
      updates.budgetCapUsd = value;
    }

    if (body.collaborationStatus !== undefined) {
      const validStatuses = ['PENDING', 'ACTIVE', 'PAUSED', 'ENDED'];
      if (!validStatuses.includes(body.collaborationStatus)) {
        return NextResponse.json({ error: 'Invalid collaborationStatus' }, { status: 400 });
      }
      updates.collaborationStatus = body.collaborationStatus;

      // Update lifecycle timestamps
      if (body.collaborationStatus === 'ACTIVE' && participant.collaborationStatus !== 'ACTIVE') {
        updates.activatedAt = new Date();
      } else if (body.collaborationStatus === 'PAUSED' && participant.collaborationStatus !== 'PAUSED') {
        updates.pausedAt = new Date();
      }
    }

    // Update participant
    const updated = await prisma.projectParticipant.update({
      where: { id: participantId },
      data: updates,
      include: {
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: updated.id,
      collaborationStatus: updated.collaborationStatus,
      spendEnabled: updated.spendEnabled,
      spendPerSaveUsd: updated.spendPerSaveUsd,
      spendPerClickUsd: updated.spendPerClickUsd,
      budgetCapUsd: updated.budgetCapUsd,
      activatedAt: updated.activatedAt,
      pausedAt: updated.pausedAt,
    });
  } catch (error) {
    console.error('Error updating collaboration spend:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}








