export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyVisitConnected } from '@/lib/notifications/visit';

const VENDOR_ORG_TYPES = ['VENDOR', 'MANUFACTURER', 'SHOWROOM'];

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { recipientUserId, visitType, location } = body;

    if (!recipientUserId || typeof recipientUserId !== 'string') {
      return NextResponse.json({ error: 'recipientUserId is required' }, { status: 400 });
    }

    // Prevent self-scan
    if (recipientUserId === session.user.id) {
      return NextResponse.json({ error: 'Cannot connect with yourself' }, { status: 400 });
    }

    // Look up recipient
    const recipient = await prisma.user.findUnique({
      where: { id: recipientUserId },
      select: { id: true, name: true, operatingAsOrgId: true },
    });

    if (!recipient) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check for duplicate (same pair within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentVisit = await prisma.visitRecord.findFirst({
      where: {
        OR: [
          { initiatorUserId: session.user.id, recipientUserId },
          { initiatorUserId: recipientUserId, recipientUserId: session.user.id },
        ],
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (recentVisit) {
      return NextResponse.json({
        visit: recentVisit,
        message: 'Already connected recently',
        duplicate: true,
      });
    }

    // Get org context
    const initiatorOrgId = session.user.operatingAsOrgId || null;
    const recipientOrgId = recipient.operatingAsOrgId || null;

    // Auto-detect event: check if scanner is checked into an active event
    let eventId: string | null = null;
    const now = new Date();
    const activeRsvp = await prisma.eventRSVP.findFirst({
      where: {
        userId: session.user.id,
        checkedInAt: { not: null },
        event: {
          startDate: { lte: now },
          endDate: { gte: now },
        },
      },
      select: { eventId: true },
      orderBy: { checkedInAt: 'desc' },
    });
    if (activeRsvp) {
      eventId = activeRsvp.eventId;
    }

    // Territory soft lock check: if the scanner's vendor org has territory lock enabled,
    // check if another rep already has an active relationship with the recipient's org
    let territoryWarning: {
      existingRepName: string;
      existingRepId: string;
      designerOrgName: string;
      isAssigned: boolean; // true = explicit territory assignment, false = organic relationship
    } | null = null;

    if (initiatorOrgId && recipientOrgId) {
      const initiatorOrg = await prisma.organization.findUnique({
        where: { id: initiatorOrgId },
        select: { type: true, territoryLockEnabled: true, dormancyThresholdDays: true },
      });

      if (initiatorOrg && VENDOR_ORG_TYPES.includes(initiatorOrg.type) && initiatorOrg.territoryLockEnabled) {
        // Check for explicit territory assignment
        const assignment = await prisma.orgTerritoryAssignment.findUnique({
          where: {
            vendorOrgId_designerOrgId: {
              vendorOrgId: initiatorOrgId,
              designerOrgId: recipientOrgId,
            },
          },
          include: {
            repUser: { select: { id: true, name: true } },
          },
        });

        if (assignment && assignment.repUserId !== session.user.id) {
          territoryWarning = {
            existingRepName: assignment.repUser.name,
            existingRepId: assignment.repUserId,
            designerOrgName: recipient.name || 'this firm',
            isAssigned: true,
          };
        }

        // If no explicit assignment, check for active organic relationship (non-dormant)
        if (!territoryWarning) {
          const dormancyDays = initiatorOrg.dormancyThresholdDays || 30;
          const activeThreshold = new Date(Date.now() - dormancyDays * 24 * 60 * 60 * 1000);

          const existingVisit = await prisma.visitRecord.findFirst({
            where: {
              OR: [
                { initiatorOrgId: initiatorOrgId, recipientOrgId: recipientOrgId },
                { initiatorOrgId: recipientOrgId, recipientOrgId: initiatorOrgId },
              ],
              initiatorUserId: { not: session.user.id },
              recipientUserId: { not: session.user.id },
              updatedAt: { gte: activeThreshold }, // only non-dormant
            },
            include: {
              initiatorUser: { select: { id: true, name: true } },
              recipientUser: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (existingVisit) {
            // The "other rep" is whichever party is from the vendor org
            const otherRep = existingVisit.initiatorOrgId === initiatorOrgId
              ? existingVisit.initiatorUser
              : existingVisit.recipientUser;

            territoryWarning = {
              existingRepName: otherRep.name,
              existingRepId: otherRep.id,
              designerOrgName: recipient.name || 'this firm',
              isAssigned: false,
            };
          }
        }
      }
    }

    // Create the visit record (scan still completes even with territory warning)
    const visit = await prisma.visitRecord.create({
      data: {
        initiatorUserId: session.user.id,
        recipientUserId,
        initiatorOrgId,
        recipientOrgId,
        visitType: visitType || 'OTHER',
        eventId,
        location: location || null,
      },
      include: {
        initiatorUser: { select: { id: true, name: true, profileImage: true, role: true, title: true, phone: true, email: true } },
        recipientUser: { select: { id: true, name: true, profileImage: true, role: true, title: true, phone: true, email: true } },
        initiatorOrg: { select: { id: true, name: true, type: true, logo: true } },
        recipientOrg: { select: { id: true, name: true, type: true, logo: true } },
        event: { select: { id: true, title: true, location: true } },
      },
    });

    // Auto-pull products from vendor orgs
    const productShares = await autoShareProducts(visit.id, session.user.id, {
      initiatorOrgId,
      recipientOrgId,
      initiatorOrgType: visit.initiatorOrg?.type || null,
      recipientOrgType: visit.recipientOrg?.type || null,
    });

    // Create notification for recipient + cross-org notifications
    await notifyVisitConnected({
      visitId: visit.id,
      initiatorUserId: session.user.id,
      initiatorName: visit.initiatorUser.name,
      initiatorOrgName: visit.initiatorOrg?.name || null,
      recipientUserId,
      recipientOrgId: recipientOrgId,
      recipientOrgName: visit.recipientOrg?.name || null,
      location: visit.event?.title || visit.location || null,
    });

    // If territory warning, notify the existing rep
    if (territoryWarning) {
      await prisma.notification.create({
        data: {
          userId: territoryWarning.existingRepId,
          type: 'TERRITORY_OVERLAP',
          title: `${visit.initiatorUser.name} connected with ${territoryWarning.designerOrgName}`,
          body: territoryWarning.isAssigned
            ? `Your colleague ${visit.initiatorUser.name} connected with ${territoryWarning.designerOrgName}, which is assigned to your territory.`
            : `Your colleague ${visit.initiatorUser.name} connected with ${territoryWarning.designerOrgName}, where you already have an active relationship.`,
          actionUrl: `/org/${initiatorOrgId}?tab=relationships`,
          metadata: {
            visitId: visit.id,
            scannerUserId: session.user.id,
          },
        },
      });
    }

    return NextResponse.json({
      visit,
      productShares,
      duplicate: false,
      territoryWarning: territoryWarning
        ? {
            message: `Your colleague ${territoryWarning.existingRepName} already ${territoryWarning.isAssigned ? 'is assigned to' : 'has an active relationship with'} ${territoryWarning.designerOrgName}. Notes have been shared with them.`,
            existingRepName: territoryWarning.existingRepName,
            isAssigned: territoryWarning.isAssigned,
          }
        : null,
    });
  } catch (error) {
    console.error('[visits/initiate] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Auto-pull products from vendor orgs and create VisitProductShare records
 */
async function autoShareProducts(
  visitId: string,
  initiatorUserId: string,
  ctx: {
    initiatorOrgId: string | null;
    recipientOrgId: string | null;
    initiatorOrgType: string | null;
    recipientOrgType: string | null;
  }
) {
  const shares: Array<{ orgId: string; sharedByUserId: string }> = [];

  // If initiator's org is a vendor-type, share their products
  if (ctx.initiatorOrgId && VENDOR_ORG_TYPES.includes(ctx.initiatorOrgType || '')) {
    shares.push({ orgId: ctx.initiatorOrgId, sharedByUserId: initiatorUserId });
  }

  // If recipient's org is a vendor-type, share their products
  if (ctx.recipientOrgId && VENDOR_ORG_TYPES.includes(ctx.recipientOrgType || '')) {
    shares.push({ orgId: ctx.recipientOrgId, sharedByUserId: initiatorUserId });
  }

  if (shares.length === 0) return [];

  const allProductShares = [];

  for (const { orgId, sharedByUserId } of shares) {
    // Get org members to find products by vendorId
    const orgMembers = await prisma.organizationUser.findMany({
      where: { organizationId: orgId },
      select: { userId: true },
    });
    const memberIds = orgMembers.map((m) => m.userId);

    // Get products from these vendor members (limit to 50 most recent)
    const products = await prisma.product.findMany({
      where: {
        vendorId: { in: memberIds },
        isPending: false,
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (products.length > 0) {
      const data = products.map((p) => ({
        visitRecordId: visitId,
        productId: p.id,
        sharedByUserId,
        autoShared: true,
      }));

      // Use createMany with skipDuplicates in case of any race conditions
      await prisma.visitProductShare.createMany({
        data,
        skipDuplicates: true,
      });

      allProductShares.push(...data);
    }
  }

  return allProductShares;
}
