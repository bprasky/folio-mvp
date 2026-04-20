export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/orgs/[orgId]/inquiry
 * Public contact form — creates notifications for org admins.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const orgId = resolvedParams.orgId;
    const { name, email, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Notify org admins
    const admins = await prisma.organizationUser.findMany({
      where: { organizationId: orgId, isActive: true, role: { in: ['OWNER', 'ADMIN'] } },
      select: { userId: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.userId,
          type: 'ORG_INQUIRY',
          title: `New inquiry from ${name}`,
          body: message.slice(0, 200),
          actionUrl: `/org/${orgId}?tab=team`,
          metadata: { name, email, message, orgName: org.name },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[orgs/[orgId]/inquiry] Error:', error);
    return NextResponse.json({ error: 'Failed to send inquiry' }, { status: 500 });
  }
}
