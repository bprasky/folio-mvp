export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVendorContext } from '@/lib/auth/vendorContext';

/**
 * GET /api/vendor/collaborations
 * Returns list of collaborations for the vendor's organization with signal/spend data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vendorCtx = await getVendorContext();
    if (!vendorCtx?.vendorOrgId) {
      return NextResponse.json({ error: 'Vendor organization not found' }, { status: 403 });
    }

    // Get current month period
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get all vendor-side participants for this org
    const participants = await prisma.projectParticipant.findMany({
      where: {
        orgId: vendorCtx.vendorOrgId,
        side: 'VENDOR',
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            ownerId: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Phase 5D: vendorDiscoveryBudget model never existed — budget reporting disabled.
    // Downstream code uses `budget?.budgetCapUsd` and `budget ? {...} : null` — null is safe.
    const budget: { budgetCapUsd: number; spentUsd: number; status: string } | null = null;

    // For each participant, calculate signal counts and spend
    const collaborations = await Promise.all(
      participants.map(async (participant) => {
        // Query ContextSignal for this collaboration in current month
        const signals = await prisma.contextSignal.findMany({
          where: {
            collaborationParticipantId: participant.id,
            createdAt: {
              gte: periodStart,
              lte: periodEnd,
            },
            action: {
              in: ['save', 'add_to_project', 'click'],
            },
          },
          select: {
            action: true,
            valueUsd: true,
            createdAt: true,
          },
        });

        // Calculate metrics
        const savesCount = signals.filter(
          (s) => s.action === 'save' || s.action === 'add_to_project'
        ).length;
        const clicksCount = signals.filter((s) => s.action === 'click').length;
        const spendUsd = signals.reduce((sum, s) => sum + (s.valueUsd ?? 0), 0);
        const lastSignalAt =
          signals.length > 0
            ? signals.reduce((latest, s) => (s.createdAt > latest ? s.createdAt : latest), signals[0].createdAt)
            : null;

        // Calculate budget usage
        const budgetCapUsd = participant.budgetCapUsd ?? budget?.budgetCapUsd ?? 0;
        const budgetUsedPct = budgetCapUsd > 0 ? (spendUsd / budgetCapUsd) * 100 : 0;

        return {
          id: participant.id,
          project: {
            id: participant.project.id,
            name: participant.project.title,
          },
          designer: participant.project.owner
            ? {
                id: participant.project.owner.id,
                name: participant.project.owner.name,
                email: participant.project.owner.email,
              }
            : null,
          status: participant.collaborationStatus,
          spendEnabled: participant.spendEnabled,
          spendPerSaveUsd: participant.spendPerSaveUsd,
          spendPerClickUsd: participant.spendPerClickUsd,
          budgetCapUsd: participant.budgetCapUsd,
          signals: {
            savesCount,
            clicksCount,
            spendUsd,
            budgetUsedPct,
            lastSignalAt,
          },
          activatedAt: participant.activatedAt,
          pausedAt: participant.pausedAt,
          createdAt: participant.createdAt,
        };
      })
    );

    return NextResponse.json({
      collaborations,
      budget: budget
        ? {
            budgetCapUsd: budget.budgetCapUsd,
            spentUsd: budget.spentUsd,
            remainingUsd: budget.budgetCapUsd - budget.spentUsd,
            status: budget.status,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching collaborations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}








