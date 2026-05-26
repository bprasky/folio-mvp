export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { randomBytes } from 'node:crypto';
import { ClaimStatus, OrgStatus, OrgType, OrgUserRole, Role } from '@prisma/client';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

// Maps the lowercase intent from the signup selector to the OrgType enum.
// Matches the role→OrgType convention used by GET /api/orgs/search.
const INTENT_TO_ORG_TYPE: Record<string, OrgType> = {
  designer: OrgType.DESIGN_FIRM,
  architect: OrgType.ARCHITECTURE_FIRM,
  builder: OrgType.CONTRACTOR,
  vendor: OrgType.VENDOR,
};

const INTENT_TO_ROLE: Record<string, Role> = {
  designer: Role.DESIGNER,
  architect: Role.ARCHITECT,
  builder: Role.BUILDER,
  vendor: Role.VENDOR,
};

// Two-branch founder/member fork:
//   - 'owner'  = "I'm setting this up" → user becomes OWNER, no claim invite
//                minted (they're the admin).
//   - 'member' = "I work here, someone else will set up the page" → user
//                becomes MEMBER, org starts UNCLAIMED, and a single-use
//                OrgClaimInvite is minted so the rightful admin can claim
//                via /auth/claim?token=...
// See docs/AUTH_ORG_ENROLLMENT_FLOW.md.
const createSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(120),
  type: z.enum(['designer', 'architect', 'builder', 'vendor']),
  role: z.enum(['owner', 'member']).default('owner'),
  website: z.string().url('Website must be a valid URL').max(200).optional().or(z.literal('')),
  location: z.string().max(120).optional().or(z.literal('')),
});

// 14-day expiry on claim invites. Plenty of time for the recipient to act
// without leaving stale invites kicking around forever.
const CLAIM_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function mintClaimToken(): string {
  return randomBytes(24).toString('base64url');
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid input';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { name, type, role: founderOrMember, website, location } = parsed.data;
  const orgType = INTENT_TO_ORG_TYPE[type];
  const trimmedName = name.trim();
  const userId = session.user.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: trimmedName,
          type: orgType,
          // Seed capabilities with the primary type so capability-based queries
          // (and the future hybrid flow) treat new orgs consistently with
          // backfilled existing orgs.
          capabilities: [orgType],
          status: OrgStatus.UNCLAIMED,
          website: website?.trim() || null,
          location: location?.trim() || null,
          createdById: userId,
        },
        select: { id: true, name: true, type: true },
      });

      // The founder branch makes the creator OWNER. The member branch makes
      // them MEMBER and mints a claim invite for whoever can actually run
      // the firm page.
      const orgUserRole = founderOrMember === 'owner' ? OrgUserRole.OWNER : OrgUserRole.MEMBER;

      await tx.organizationUser.create({
        data: {
          userId,
          organizationId: org.id,
          role: orgUserRole,
          isActive: true,
          showOnProfile: true,
        },
      });

      // Auto-promote: INDIVIDUAL → matching pro role. updateMany with the
      // role guard makes this a no-op for users already on a non-individual
      // role (e.g. they founded a design firm before, now founding a vendor
      // brand — keep their original promotion). The promotion fires for both
      // branches — a designer who works at Studio X really is a DESIGNER
      // even before the firm page is claimed.
      await tx.user.updateMany({
        where: { id: userId, role: Role.INDIVIDUAL },
        data: { role: INTENT_TO_ROLE[type] },
      });

      let claimInviteToken: string | null = null;
      let claimInviteId: string | null = null;
      if (founderOrMember === 'member') {
        const invite = await tx.orgClaimInvite.create({
          data: {
            organizationId: org.id,
            token: mintClaimToken(),
            status: ClaimStatus.PENDING,
            createdById: userId,
            expiresAt: new Date(Date.now() + CLAIM_INVITE_TTL_MS),
          },
          select: { id: true, token: true },
        });
        claimInviteToken = invite.token;
        claimInviteId = invite.id;
      }

      return { org, claimInviteToken, claimInviteId };
    });

    return NextResponse.json(
      {
        organizationId: result.org.id,
        organizationName: result.org.name,
        claimInviteId: result.claimInviteId,
        claimInviteToken: result.claimInviteToken,
        // Convenience: pre-built absolute URL for the UI to surface. We can
        // derive the host from request headers; fall back to a relative path
        // when behind a proxy that doesn't pass them through.
        claimUrl: result.claimInviteToken
          ? buildClaimUrl(request, result.claimInviteToken)
          : null,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[POST /api/auth/org-setup] Error:', error);
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}

function buildClaimUrl(request: NextRequest, token: string): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host') ?? request.headers.get('x-forwarded-host');
  const base = host ? `${proto}://${host}` : '';
  return `${base}/auth/claim?token=${encodeURIComponent(token)}`;
}
