export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const DEFAULT_DORMANCY_THRESHOLD_DAYS = 30;

/**
 * GET /api/org/[orgId]/designer-relationships
 *
 * Returns aggregated designer relationships for a vendor org,
 * computed from VisitRecord data across all org reps.
 *
 * Groups by designer org/individual, showing reps, status, activity.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

    // Verify user is a member of this org
    const membership = await prisma.organizationUser.findFirst({
      where: { organizationId: orgId, userId: session.user.id, isActive: true },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get org settings for dormancy threshold
    const orgSettings = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { dormancyThresholdDays: true },
    });

    // Get all org member IDs (reps)
    const members = await prisma.organizationUser.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { userId: true, user: { select: { id: true, name: true } } },
    });
    const memberIds = members.map((m) => m.userId);

    // Get territory assignments for this org
    const territoryAssignments = await prisma.orgTerritoryAssignment.findMany({
      where: { vendorOrgId: orgId },
      select: { designerOrgId: true, repUserId: true },
    });
    const assignmentByDesignerOrg = new Map(
      territoryAssignments.map((a) => [a.designerOrgId, a.repUserId])
    );

    const DESIGN_ORG_TYPES = ['DESIGN_FIRM', 'ARCHITECTURE_FIRM'];

    // Get all visit records where any of our reps connected with designers
    const visits = await prisma.visitRecord.findMany({
      where: {
        OR: [
          { initiatorUserId: { in: memberIds } },
          { recipientUserId: { in: memberIds } },
        ],
      },
      include: {
        initiatorUser: {
          select: { id: true, name: true, profileImage: true, role: true, title: true },
        },
        recipientUser: {
          select: { id: true, name: true, profileImage: true, role: true, title: true },
        },
        initiatorOrg: { select: { id: true, name: true, type: true, logo: true } },
        recipientOrg: { select: { id: true, name: true, type: true, logo: true } },
        event: { select: { id: true, title: true } },
        _count: { select: { productShares: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const dormancyDays = orgSettings?.dormancyThresholdDays || DEFAULT_DORMANCY_THRESHOLD_DAYS;
    const dormancyThreshold = new Date(now.getTime() - dormancyDays * 24 * 60 * 60 * 1000);

    // Aggregate by designer org (or individual designer if no org)
    const relationshipMap = new Map<string, {
      designerOrg: { id: string; name: string; type: string; logo: string | null } | null;
      designerUser: { id: string; name: string; profileImage: string | null; role: string; title: string | null } | null;
      reps: Map<string, {
        repUserId: string;
        repName: string;
        visitCount: number;
        lastActivity: Date;
        productShareCount: number;
      }>;
      lastActivity: Date;
      totalVisits: number;
      totalProductShares: number;
      status: 'active' | 'new' | 'dormant';
    }>();

    for (const visit of visits) {
      const isOurRep = memberIds.includes(visit.initiatorUserId);
      const designerUser = isOurRep ? visit.recipientUser : visit.initiatorUser;
      const designerOrg = isOurRep ? visit.recipientOrg : visit.initiatorOrg;
      const repUser = isOurRep ? visit.initiatorUser : visit.recipientUser;

      // Use designer org ID if available, otherwise use designer user ID
      const key = designerOrg?.id || `user:${designerUser.id}`;

      if (!relationshipMap.has(key)) {
        relationshipMap.set(key, {
          designerOrg: designerOrg && DESIGN_ORG_TYPES.includes(designerOrg.type) ? designerOrg : null,
          designerUser: !designerOrg ? designerUser : null,
          reps: new Map(),
          lastActivity: visit.createdAt,
          totalVisits: 0,
          totalProductShares: 0,
          status: 'new',
        });
      }

      const entry = relationshipMap.get(key)!;
      entry.totalVisits++;
      entry.totalProductShares += visit._count.productShares;

      if (visit.createdAt > entry.lastActivity) {
        entry.lastActivity = visit.createdAt;
      }

      // Track rep activity
      if (!entry.reps.has(repUser.id)) {
        entry.reps.set(repUser.id, {
          repUserId: repUser.id,
          repName: repUser.name,
          visitCount: 0,
          lastActivity: visit.createdAt,
          productShareCount: 0,
        });
      }
      const repEntry = entry.reps.get(repUser.id)!;
      repEntry.visitCount++;
      repEntry.productShareCount += visit._count.productShares;
      if (visit.createdAt > repEntry.lastActivity) {
        repEntry.lastActivity = visit.createdAt;
      }
    }

    // Compute status for each relationship
    for (const entry of relationshipMap.values()) {
      if (entry.totalVisits === 1 && entry.lastActivity > dormancyThreshold) {
        entry.status = 'new';
      } else if (entry.lastActivity < dormancyThreshold) {
        entry.status = 'dormant';
      } else {
        entry.status = 'active';
      }
    }

    // Convert to array, include territory assignment info
    const relationships = Array.from(relationshipMap.values())
      .map((entry) => {
        const designerOrgId = entry.designerOrg?.id;
        const assignedRepId = designerOrgId ? assignmentByDesignerOrg.get(designerOrgId) : undefined;
        return {
          designerOrg: entry.designerOrg,
          designerUser: entry.designerUser,
          reps: Array.from(entry.reps.values()),
          lastActivity: entry.lastActivity,
          totalVisits: entry.totalVisits,
          totalProductShares: entry.totalProductShares,
          status: entry.status,
          assignedRepUserId: assignedRepId || null,
        };
      })
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    // Summary stats
    const stats = {
      total: relationships.length,
      active: relationships.filter((r) => r.status === 'active').length,
      new: relationships.filter((r) => r.status === 'new').length,
      dormant: relationships.filter((r) => r.status === 'dormant').length,
    };

    return NextResponse.json({ relationships, stats });
  } catch (error) {
    console.error('[org/designer-relationships] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
