export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/pending-invites
 * Returns list of vendor invite candidates with aggregates
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'PENDING' | 'READY' | 'INVITED' | 'ARCHIVED' | null;
    const sortBy = searchParams.get('sortBy') || 'signals'; // 'signals' | 'newest' | 'oldest'

    const where: any = {};
    if (status) {
      where.status = status;
    }

    // Fetch candidates with aggregates
    const candidates = await prisma.vendorInviteCandidate.findMany({
      where,
      include: {
        signals: {
          include: {
            designer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            project: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        contacts: {
          include: {
            designer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            project: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        firstSeenByDesigner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        firstSeenInProject: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Compute aggregates
    type CandidateWithRelations = (typeof candidates)[number];
    const candidatesWithAggregates = candidates.map((candidate: CandidateWithRelations) => {
      const uniqueDesigners = new Set(candidate.signals.map((s) => s.designerId));
      const uniqueProjects = new Set(
        candidate.signals.map((s) => s.projectId).filter((id): id is string => !!id)
      );
      const uniqueDomains = new Set(
        candidate.contacts.map((c) => c.domain).filter((d): d is string => !!d)
      );

      const lastSeenAt =
        candidate.lastSeenAt ||
        (candidate.signals.length > 0
          ? candidate.signals[0].createdAt
          : candidate.createdAt);

      return {
        id: candidate.id,
        vendorName: candidate.vendorName,
        vendorWebsite: candidate.vendorWebsite,
        repEmail: candidate.repEmail, // Deprecated - use contacts instead
        repName: candidate.repName, // Deprecated - use contacts instead
        status: candidate.status,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
        firstSeenByDesigner: candidate.firstSeenByDesigner,
        firstSeenInProject: candidate.firstSeenInProject,
        aggregates: {
          designerCount: uniqueDesigners.size,
          projectCount: uniqueProjects.size,
          signalCount: candidate.signals.length,
          contactCount: candidate.contacts.length,
          uniqueDomainsCount: uniqueDomains.size,
          multiDesigner: uniqueDesigners.size >= 2,
          lastSeenAt,
        },
        signals: candidate.signals.map((signal) => ({
          id: signal.id,
          designer: signal.designer,
          project: signal.project,
          tagId: signal.tagId,
          createdAt: signal.createdAt,
        })),
        contacts: candidate.contacts.map((contact) => ({
          id: contact.id,
          email: contact.email,
          name: contact.name,
          domain: contact.domain,
          designer: contact.designer,
          project: contact.project,
          source: contact.source,
          createdAt: contact.createdAt,
        })),
      };
    });

    // Sort
    if (sortBy === 'signals') {
      candidatesWithAggregates.sort((a, b) => {
        if (b.aggregates.signalCount !== a.aggregates.signalCount) {
          return b.aggregates.signalCount - a.aggregates.signalCount;
        }
        return b.aggregates.lastSeenAt.getTime() - a.aggregates.lastSeenAt.getTime();
      });
    } else if (sortBy === 'newest') {
      candidatesWithAggregates.sort(
        (a, b) => b.aggregates.lastSeenAt.getTime() - a.aggregates.lastSeenAt.getTime()
      );
    } else if (sortBy === 'oldest') {
      candidatesWithAggregates.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );
    }

    return NextResponse.json({
      candidates: candidatesWithAggregates,
      total: candidatesWithAggregates.length,
    });
  } catch (error: any) {
    console.error('Failed to fetch pending invites:', error);
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Failed to fetch pending invites' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/pending-invites
 * Update candidate status (mark ready, archive, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();

    const { candidateId, status } = await request.json();

    if (!candidateId || !status) {
      return NextResponse.json(
        { error: 'candidateId and status are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['PENDING', 'READY', 'INVITED', 'ARCHIVED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const candidate = await prisma.vendorInviteCandidate.update({
      where: { id: candidateId },
      data: { status },
      select: {
        id: true,
        vendorName: true,
        status: true,
      },
    });

    return NextResponse.json({ success: true, candidate });
  } catch (error: any) {
    console.error('Failed to update candidate status:', error);
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Failed to update candidate status' },
      { status: 500 }
    );
  }
}

