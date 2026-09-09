export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/orgs/share-upgrade-request - Request upgrade from account owner
 *
 * Used when a team member wants to use a professional feature
 * but the org hasn't upgraded yet. Records the request and
 * optionally notifies the org owner.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orgId, recipientEmail, featureRequested } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Verify the org exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, status: true }
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Verify user has some connection to this org (member or operating as)
    const membership = await prisma.organizationUser.findFirst({
      where: {
        organizationId: orgId,
        userId: session.user.id,
        isActive: true
      }
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You must be a member of this organization' },
        { status: 403 }
      );
    }

    // Record the upgrade request in sales notes for tracking
    // In a real system, this would create a notification or send an email
    const updatedOrg = await prisma.organization.update({
      where: { id: orgId },
      data: {
        salesNotes: `Upgrade request from ${session.user.email} for ${featureRequested || 'professional features'}. Recipient: ${recipientEmail || 'N/A'}. ${new Date().toISOString()}`,
        salesContactedAt: new Date()
      }
    });

    // Generate an upgrade link that can be shared
    const upgradeLink = `${process.env.NEXTAUTH_URL || ''}/professionals/join?orgId=${orgId}&upgrade=true`;

    // TODO: Send email to recipientEmail with upgrade link
    // For now, we just record the request and return the link
    // In production, integrate with email service (Resend, SendGrid, etc.)

    return NextResponse.json({
      success: true,
      message: 'Upgrade request recorded',
      upgradeLink,
      orgName: org.name,
      orgStatus: org.status
    });
  } catch (error) {
    console.error('[POST /api/orgs/share-upgrade-request] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process upgrade request' },
      { status: 500 }
    );
  }
}
