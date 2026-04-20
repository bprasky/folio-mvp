// @idor-allow: public-read reason="Vercel cron endpoint protected by CRON_SECRET bearer header, not session auth"
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VENDOR_ORG_TYPES = ['VENDOR', 'MANUFACTURER', 'SHOWROOM'];
const DEFAULT_DORMANCY_DAYS = 30;

/**
 * Cron job: Check for dormant vendor-designer relationships
 *
 * Uses org-specific dormancyThresholdDays setting (defaults to 30).
 * Finds vendor orgs where reps connected with designers but had no
 * follow-up activity past the threshold. Notifies org admins.
 *
 * Schedule: weekly (e.g., every Monday at 9am)
 * Config in vercel.json:
 * { "path": "/api/cron/dormancy-check", "schedule": "0 9 * * 1" }
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Find vendor orgs that have visit records
    const vendorOrgs = await prisma.organization.findMany({
      where: {
        type: { in: VENDOR_ORG_TYPES },
        OR: [
          { orgInitiatedVisits: { some: {} } },
          { orgReceivedVisits: { some: {} } },
        ],
      },
      select: {
        id: true,
        name: true,
        dormancyThresholdDays: true,
        users: {
          where: { isActive: true, role: { in: ['OWNER', 'ADMIN'] } },
          select: { userId: true },
        },
      },
    });

    let totalDormant = 0;
    let totalNotifications = 0;

    for (const vendorOrg of vendorOrgs) {
      const adminIds = vendorOrg.users.map((u) => u.userId);
      if (adminIds.length === 0) continue;

      const thresholdDays = vendorOrg.dormancyThresholdDays || DEFAULT_DORMANCY_DAYS;
      const threshold = new Date(now.getTime() - thresholdDays * 24 * 60 * 60 * 1000);

      // Get all member IDs for this vendor org
      const allMembers = await prisma.organizationUser.findMany({
        where: { organizationId: vendorOrg.id, isActive: true },
        select: { userId: true },
      });
      const memberIds = allMembers.map((m) => m.userId);

      // Find visit records from this org's reps that are older than threshold
      // and have no recent activity
      const dormantVisits = await prisma.visitRecord.findMany({
        where: {
          OR: [
            { initiatorUserId: { in: memberIds }, initiatorOrgId: vendorOrg.id },
            { recipientUserId: { in: memberIds }, recipientOrgId: vendorOrg.id },
          ],
          createdAt: { lt: threshold },
          updatedAt: { lt: threshold },
        },
        include: {
          initiatorUser: { select: { id: true, name: true } },
          recipientUser: { select: { id: true, name: true } },
          initiatorOrg: { select: { name: true } },
          recipientOrg: { select: { name: true } },
        },
      });

      if (dormantVisits.length === 0) continue;

      totalDormant += dormantVisits.length;

      // Identify which designer orgs are dormant for reassignment suggestions
      const dormantDesignerOrgs = new Set<string>();
      for (const visit of dormantVisits) {
        const designerOrgId = visit.initiatorOrgId === vendorOrg.id
          ? visit.recipientOrgId
          : visit.initiatorOrgId;
        if (designerOrgId) dormantDesignerOrgs.add(designerOrgId);
      }

      // Create one digest notification per admin
      for (const adminId of adminIds) {
        // Check if we already sent a dormancy notification this week
        const recentNotification = await prisma.notification.findFirst({
          where: {
            userId: adminId,
            type: 'DORMANCY_ALERT',
            createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
          },
        });

        if (recentNotification) continue;

        await prisma.notification.create({
          data: {
            userId: adminId,
            type: 'DORMANCY_ALERT',
            title: `${dormantVisits.length} designer relationship${dormantVisits.length !== 1 ? 's' : ''} need attention`,
            body: `${dormantVisits.length} connection${dormantVisits.length !== 1 ? 's' : ''} at ${vendorOrg.name} ha${dormantVisits.length !== 1 ? 've' : 's'} had no activity in ${thresholdDays}+ days. Review and consider reassigning.`,
            actionUrl: `/org/${vendorOrg.id}?tab=relationships`,
            metadata: {
              vendorOrgId: vendorOrg.id,
              dormantCount: dormantVisits.length,
              dormantDesignerOrgIds: Array.from(dormantDesignerOrgs),
              thresholdDays,
            },
          },
        });
        totalNotifications++;
      }
    }

    return NextResponse.json({
      success: true,
      dormantRelationships: totalDormant,
      notificationsSent: totalNotifications,
      vendorOrgsChecked: vendorOrgs.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[cron/dormancy-check] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
