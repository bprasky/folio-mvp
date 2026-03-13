export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/org/[orgId]/vendor-directory
 *
 * Returns aggregated vendor contacts for a design firm org,
 * computed from VisitRecord data across all org members.
 *
 * Groups by vendor org, showing reps, last contact, products discussed.
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

    // Get all org member IDs
    const members = await prisma.organizationUser.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);

    // Get all visit records where any org member was the initiator or recipient
    // and the other party has a vendor-type org
    const VENDOR_ORG_TYPES = ['VENDOR', 'MANUFACTURER', 'SHOWROOM'];

    const visits = await prisma.visitRecord.findMany({
      where: {
        OR: [
          // Our members initiated and scanned someone from a vendor org
          { initiatorUserId: { in: memberIds }, recipientOrg: { type: { in: VENDOR_ORG_TYPES } } },
          // Someone from a vendor org scanned one of our members
          { recipientUserId: { in: memberIds }, initiatorOrg: { type: { in: VENDOR_ORG_TYPES } } },
        ],
      },
      include: {
        initiatorUser: {
          select: { id: true, name: true, profileImage: true, title: true, phone: true, email: true },
        },
        recipientUser: {
          select: { id: true, name: true, profileImage: true, title: true, phone: true, email: true },
        },
        initiatorOrg: { select: { id: true, name: true, type: true, logo: true } },
        recipientOrg: { select: { id: true, name: true, type: true, logo: true } },
        event: { select: { id: true, title: true } },
        _count: { select: { productShares: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate by vendor org
    const vendorOrgMap = new Map<string, {
      org: { id: string; name: string; type: string; logo: string | null };
      reps: Map<string, {
        user: { id: string; name: string; profileImage: string | null; title: string | null; phone: string | null; email: string | null };
        visits: Array<{
          id: string;
          metBy: { id: string; name: string };
          context: string | null;
          productCount: number;
          createdAt: Date;
        }>;
        lastContact: Date;
      }>;
      lastContact: Date;
    }>();

    for (const visit of visits) {
      const isInitiator = memberIds.includes(visit.initiatorUserId);
      const vendorOrg = isInitiator ? visit.recipientOrg : visit.initiatorOrg;
      const vendorUser = isInitiator ? visit.recipientUser : visit.initiatorUser;
      const ourUser = isInitiator ? visit.initiatorUser : visit.recipientUser;

      if (!vendorOrg) continue;

      if (!vendorOrgMap.has(vendorOrg.id)) {
        vendorOrgMap.set(vendorOrg.id, {
          org: vendorOrg,
          reps: new Map(),
          lastContact: visit.createdAt,
        });
      }

      const orgEntry = vendorOrgMap.get(vendorOrg.id)!;

      if (!orgEntry.reps.has(vendorUser.id)) {
        orgEntry.reps.set(vendorUser.id, {
          user: vendorUser,
          visits: [],
          lastContact: visit.createdAt,
        });
      }

      const repEntry = orgEntry.reps.get(vendorUser.id)!;
      repEntry.visits.push({
        id: visit.id,
        metBy: { id: ourUser.id, name: ourUser.name },
        context: visit.event?.title || visit.location || null,
        productCount: visit._count.productShares,
        createdAt: visit.createdAt,
      });

      // Update last contact dates
      if (visit.createdAt > orgEntry.lastContact) {
        orgEntry.lastContact = visit.createdAt;
      }
      if (visit.createdAt > repEntry.lastContact) {
        repEntry.lastContact = visit.createdAt;
      }
    }

    // Convert to array sorted by most recent contact
    const directory = Array.from(vendorOrgMap.values())
      .map((entry) => ({
        org: entry.org,
        lastContact: entry.lastContact,
        reps: Array.from(entry.reps.values())
          .map((rep) => ({
            ...rep.user,
            visitCount: rep.visits.length,
            lastContact: rep.lastContact,
            visits: rep.visits.slice(0, 5), // Last 5 visits per rep
          }))
          .sort((a, b) => b.lastContact.getTime() - a.lastContact.getTime()),
      }))
      .sort((a, b) => b.lastContact.getTime() - a.lastContact.getTime());

    return NextResponse.json({ directory });
  } catch (error) {
    console.error('[org/vendor-directory] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
