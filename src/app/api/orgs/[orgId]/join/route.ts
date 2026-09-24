export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { roleForOrgType } from '@/lib/onboarding/role-org-mapping';

import { notifyOrgJoinRequest } from '@/lib/notifications/org-join';
import { revalidatePath } from 'next/cache';

async function notifyAdmins(args: Parameters<typeof notifyOrgJoinRequest>[0]) {
  try { return await notifyOrgJoinRequest(args); }
  catch (error) {
    console.error('[org join] notification failed:', error);
    return { inApp: null, email: 'unavailable' as const };
  }
}

// Retry reports who can currently review the saved request, without claiming
// that a notification was delivered or sending another email.
async function pendingAdminAvailability(orgId: string, requesterId: string) {
  const admin = await prisma.organizationUser.findFirst({
    where: { organizationId: orgId, isActive: true, role: { in: ['OWNER', 'ADMIN'] }, userId: { not: requesterId } },
    select: { id: true },
  });
  return admin
    ? { adminAvailable: true }
    : { adminAvailable: false, inApp: false, email: 'unavailable' as const };
}

/**
 * POST /api/orgs/[orgId]/join - Request to join an organization
 * Body: { message?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  let requesterId: string | undefined;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    requesterId = session.user.id;

    const { orgId } = params;
    const body = await request.json().catch(() => ({}));
    const message = body?.message;

    // Check if org exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, status: true }
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user is already a member
    const existingMembership = await prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId
        }
      }
    });

    if (existingMembership?.isActive) {
      return NextResponse.json(
        { error: 'You are already a member of this organization' },
        { status: 400 }
      );
    }

    // Check if there's already a pending request
    const existingRequest = await prisma.orgJoinRequest.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: orgId
        }
      }
    });

    if (existingRequest?.status === 'PENDING') {
      return NextResponse.json({ message: 'Your request is saved', pending: true,
        notifications: await pendingAdminAvailability(orgId, session.user.id) });
    }
    const now = new Date();
    const submitted = await prisma.$transaction(async (tx) => {
      // Compare-and-set prevents concurrent resubmissions from notifying twice.
      if (existingRequest) {
        const changed = await tx.orgJoinRequest.updateMany({
          where: { id: existingRequest.id, status: existingRequest.status },
          data: { status: 'PENDING', message: typeof message === 'string' ? message.trim() || null : null,
            reviewedBy: null, reviewedAt: null, createdAt: now },
        });
        if (changed.count !== 1) return null;
      } else {
        await tx.orgJoinRequest.create({ data: {
          userId: session.user.id, organizationId: orgId, status: 'PENDING',
          message: typeof message === 'string' ? message.trim() || null : null,
        } });
      }
      // A pending request allows browsing, never professional posting access.
      await tx.user.update({ where: { id: session.user.id }, data: {
        onboardingDiagnosticAt: now, onboardingFirmContextAt: now,
        onboardingBioCaptureAt: now, onboardingProfilePreviewAt: now,
      } });
      return tx.orgJoinRequest.findUniqueOrThrow({
        where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } }, select: { id: true },
      });
    });
    const notifications = submitted
      ? await notifyAdmins({ orgId, orgName: org.name, requesterId: session.user.id, joinRequestId: submitted.id })
      : await pendingAdminAvailability(orgId, session.user.id);
    revalidatePath('/inbox');
    revalidatePath('/auth/org-setup');
    return NextResponse.json({ message: 'Your request is awaiting firm approval', pending: true, notifications }, { status: submitted ? 201 : 200 });
  } catch (error: any) {
    console.error('[POST /api/orgs/[orgId]/join] Error:', error);

    if (error.code === 'P2002') {
      const notifications = requesterId
        ? await pendingAdminAvailability(params.orgId, requesterId).catch(() => ({ inApp: null, email: 'unavailable' as const }))
        : undefined;
      return NextResponse.json(
        { message: 'Your request already exists; check its status in your account', pending: true, notifications },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to submit join request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orgs/[orgId]/join - Get join requests for this org (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;

    // Check if user is admin of this org
    const membership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId: orgId,
        role: { in: ['OWNER', 'ADMIN'] },
        isActive: true,
      }
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only organization admins can view join requests' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'PENDING';

    const requests = await prisma.orgJoinRequest.findMany({
      where: {
        organizationId: orgId,
        status: status.toUpperCase() as any,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImage: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('[GET /api/orgs/[orgId]/join] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch join requests' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orgs/[orgId]/join - Approve or reject a join request (admin only)
 * Body: { requestId, action: 'approve' | 'reject' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;

    // Check if user is admin of this org
    const membership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        organizationId: orgId,
        role: { in: ['OWNER', 'ADMIN'] },
        isActive: true,
      }
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only organization admins can review join requests' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { requestId, action } = body;

    if (!requestId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Missing required fields: requestId, action (approve/reject)' },
        { status: 400 }
      );
    }

    const joinRequest = await prisma.orgJoinRequest.findUnique({
      where: { id: requestId },
      include: { user: { select: { id: true, name: true } } }
    });

    if (!joinRequest || joinRequest.organizationId !== orgId) {
      return NextResponse.json(
        { error: 'Join request not found' },
        { status: 404 }
      );
    }

    if (joinRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'This request has already been reviewed' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Need the org's type to derive the role to promote the joiner to.
      // Done as a separate fetch (rather than expanding the include above)
      // to keep the reject branch's transaction minimal.
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { type: true },
      });
      const targetRole = org ? roleForOrgType(org.type) : null;

      await prisma.$transaction(async (tx) => {
        const reviewed = await tx.orgJoinRequest.updateMany({
          where: { id: requestId, organizationId: orgId, status: 'PENDING' },
          data: { status: 'APPROVED', reviewedBy: session.user.id, reviewedAt: new Date() },
        });
        if (reviewed.count !== 1) throw new Error('REQUEST_ALREADY_REVIEWED');
        const currentMember = await tx.organizationUser.findUnique({
          where: { userId_organizationId: { userId: joinRequest.userId, organizationId: orgId } },
        });
        if (!currentMember?.isActive) {
          await tx.organizationUser.upsert({
            where: { userId_organizationId: { userId: joinRequest.userId, organizationId: orgId } },
            create: { userId: joinRequest.userId, organizationId: orgId, role: 'MEMBER', isActive: true, showOnProfile: true },
            // Rejoining never resurrects a former admin's privileges.
            update: { role: 'MEMBER', isActive: true, joinedAt: new Date() },
          });
        }
        if (targetRole) await tx.user.updateMany({
          where: { id: joinRequest.userId, role: 'INDIVIDUAL' }, data: { role: targetRole },
        });
        await tx.user.updateMany({
          where: { id: joinRequest.userId, operatingAsOrgId: null },
          data: { operatingAsOrgId: orgId, onboardingDiagnosticAt: new Date(), onboardingFirmContextAt: new Date(),
            onboardingBioCaptureAt: new Date(), onboardingProfilePreviewAt: new Date() },
        });
      });
      revalidatePath('/org/' + orgId + '/settings');
      revalidatePath('/inbox');
      revalidatePath('/auth/org-setup');

      return NextResponse.json({
        message: `${joinRequest.user.name} has been added to the organization`,
      });
    } else {
      // Reject request
      const rejected = await prisma.orgJoinRequest.updateMany({
        where: { id: requestId, organizationId: orgId, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        }
      });

      if (rejected.count !== 1) return NextResponse.json({ error: 'This request has already been reviewed' }, { status: 409 });
      revalidatePath('/org/' + orgId + '/settings');
      revalidatePath('/inbox');
      return NextResponse.json({
        message: 'Join request rejected',
      });
    }
  } catch (error: any) {
    if (error.message === 'REQUEST_ALREADY_REVIEWED') return NextResponse.json({ error: 'This request has already been reviewed' }, { status: 409 });
    console.error('[PATCH /api/orgs/[orgId]/join] Error:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process join request' },
      { status: 500 }
    );
  }
}
