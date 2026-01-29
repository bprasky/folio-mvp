export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/vendor/invite-admin
 *
 * Rep invites an admin to the organization.
 * Sends an email with context about the rep's activity.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { adminEmail, organizationId } = body;

    if (!adminEmail || !organizationId) {
      return NextResponse.json(
        { error: 'adminEmail and organizationId are required' },
        { status: 400 }
      );
    }

    // Verify user is a member of the org
    const membership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId,
        },
      },
      select: { isActive: true },
    });

    if (!membership?.isActive) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Get org and rep info
    const [org, rep] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, email: true },
      }),
    ]);

    if (!org || !rep) {
      return NextResponse.json({ error: 'Organization or user not found' }, { status: 404 });
    }

    // Get context: recent tag info for the email
    const orgMembers = await prisma.organizationUser.findMany({
      where: { organizationId, isActive: true },
      select: { userId: true },
    });
    const memberUserIds = orgMembers.map((m) => m.userId);

    const recentTag = await prisma.productTag.findFirst({
      where: {
        product: {
          vendorId: { in: memberUserIds },
        },
      },
      include: {
        product: { select: { name: true } },
        image: {
          select: {
            project: {
              select: {
                title: true,
                designer: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const designerName = recentTag?.image?.project?.designer?.name || 'a designer';
    const projectName = recentTag?.image?.project?.title || 'a project';
    const productName = recentTag?.product?.name || 'a product';

    // Build email content
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const pitchUrl = `${appUrl}/vendor/pitch`;

    const subject = `${rep.name} has joined Folio and wants to collaborate`;
    const emailBody = `${rep.name} has joined Folio and wants to collaborate with ${designerName} on their ${projectName} where the ${productName} was tagged.`;

    // TODO: Send via email service (SendGrid, Resend, etc.)
    console.log(`[EMAIL] Admin invite to ${adminEmail}:`, {
      subject,
      body: emailBody,
      pitchUrl,
    });

    // Create notification record
    const existingAdmin = await prisma.user.findFirst({
      where: { email: { equals: adminEmail, mode: 'insensitive' } },
      select: { id: true },
    });

    if (existingAdmin) {
      await prisma.notification.create({
        data: {
          userId: existingAdmin.id,
          type: 'VENDOR_ADMIN_INVITE',
          title: `${rep.name} invited you to manage ${org.name} on Folio`,
          body: emailBody,
          actionUrl: pitchUrl,
          metadata: {
            organizationId,
            invitedBy: session.user.id,
            repName: rep.name,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${adminEmail}`,
    });
  } catch (error) {
    console.error('[vendor/invite-admin] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
