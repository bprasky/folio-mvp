export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ClaimStatus, OrgStatus, OrgUserRole, Role } from '@prisma/client';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { roleForOrgType } from '@/lib/onboarding/role-org-mapping';

// Two surfaces:
//   GET  /api/auth/claim?token=... — public token validation. The claim
//        landing page calls this to render org context (name, type) and
//        decide which CTA to show (sign in / claim / already-used).
//   POST /api/auth/claim — claim accept. Requires the claimer to be signed
//        in. Flips Organization.status to CLAIMED, makes the claimer OWNER,
//        marks the invite CLAIMED, and promotes the claimer's User.role
//        from INDIVIDUAL → matching pro role.
// See docs/AUTH_ORG_ENROLLMENT_FLOW.md.

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token || token.length < 8) {
    return NextResponse.json({ error: 'Missing claim token.' }, { status: 400 });
  }

  const invite = await prisma.orgClaimInvite.findUnique({
    where: { token },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      organization: {
        select: { id: true, name: true, type: true, status: true },
      },
    },
  });
  if (!invite) {
    return NextResponse.json({ error: 'Invite not found.' }, { status: 404 });
  }

  // Surface PENDING but past-expiry as EXPIRED so the UI can render a clean
  // "expired" message. We don't mutate here — that happens on the next
  // POST attempt, which is also fine.
  let effectiveStatus = invite.status;
  if (effectiveStatus === ClaimStatus.PENDING && invite.expiresAt.getTime() < Date.now()) {
    effectiveStatus = ClaimStatus.EXPIRED;
  }

  return NextResponse.json({
    status: effectiveStatus,
    expiresAt: invite.expiresAt,
    organization: invite.organization,
  });
}

const acceptSchema = z.object({
  token: z.string().min(8, 'Missing claim token.'),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Sign in to claim this organization.' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { token } = parsed.data;
  const userId = session.user.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invite = await tx.orgClaimInvite.findUnique({
        where: { token },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          organizationId: true,
          organization: { select: { type: true, name: true } },
        },
      });
      if (!invite) {
        throw Object.assign(new Error('Invite not found.'), { httpStatus: 404 });
      }
      if (invite.status !== ClaimStatus.PENDING) {
        throw Object.assign(
          new Error(`This invite is ${invite.status.toLowerCase()} and can't be used.`),
          { httpStatus: 400 }
        );
      }
      if (invite.expiresAt.getTime() < Date.now()) {
        // Side-effect: flip the row to EXPIRED so subsequent calls return
        // the right state.
        await tx.orgClaimInvite.update({
          where: { id: invite.id },
          data: { status: ClaimStatus.EXPIRED },
        });
        throw Object.assign(new Error('This claim invite has expired.'), { httpStatus: 400 });
      }

      // Membership: upsert OWNER. If the claimer was already a MEMBER (e.g.
      // they were also the minter and now want to upgrade), bump them to
      // OWNER. The unique constraint on (userId, organizationId) makes the
      // upsert clean.
      await tx.organizationUser.upsert({
        where: {
          userId_organizationId: { userId, organizationId: invite.organizationId },
        },
        create: {
          userId,
          organizationId: invite.organizationId,
          role: OrgUserRole.OWNER,
          isActive: true,
          showOnProfile: true,
        },
        update: {
          role: OrgUserRole.OWNER,
          isActive: true,
        },
      });

      // Org transitions UNCLAIMED → CLAIMED. updateMany guarded on the
      // current status so concurrent claims don't race past it.
      await tx.organization.updateMany({
        where: { id: invite.organizationId, status: OrgStatus.UNCLAIMED },
        data: {
          status: OrgStatus.CLAIMED,
          verifiedAt: new Date(),
          verifiedBy: userId,
        },
      });

      // Mark the invite consumed.
      await tx.orgClaimInvite.update({
        where: { id: invite.id },
        data: {
          status: ClaimStatus.CLAIMED,
          claimedById: userId,
          claimedAt: new Date(),
        },
      });

      // Auto-promote claimer's User.role if still INDIVIDUAL. Same guard
      // pattern as the create + approval flows.
      const targetRole = roleForOrgType(invite.organization.type);
      if (targetRole) {
        await tx.user.updateMany({
          where: { id: userId, role: Role.INDIVIDUAL },
          data: { role: targetRole },
        });
      }

      return { organizationId: invite.organizationId, organizationName: invite.organization.name };
    });

    return NextResponse.json({
      ok: true,
      organizationId: result.organizationId,
      organizationName: result.organizationName,
    });
  } catch (err: any) {
    const status = err?.httpStatus ?? 500;
    console.error('[POST /api/auth/claim] Error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to claim organization.' },
      { status }
    );
  }
}
