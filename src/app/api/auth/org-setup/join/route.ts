export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { OrgType, OrgUserRole, Role } from '@prisma/client';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

// Org type → user role mapping. Used to auto-promote a new INDIVIDUAL into
// the appropriate professional role on join. Returns null for org types
// that don't have a clean role mapping (e.g. the legacy ones); in that
// case the user simply doesn't get promoted.
function orgTypeToRole(type: OrgType): Role | null {
  switch (type) {
    case OrgType.DESIGN_FIRM:
      return Role.DESIGNER;
    case OrgType.ARCHITECTURE_FIRM:
      return Role.ARCHITECT;
    case OrgType.CONTRACTOR:
      return Role.BUILDER;
    case OrgType.VENDOR:
    case OrgType.MANUFACTURER:
    case OrgType.SHOWROOM:
      return Role.VENDOR;
    case OrgType.PHOTOGRAPHY_STUDIO:
      return Role.PHOTOGRAPHER;
    case OrgType.DEVELOPER:
      return Role.DEVELOPER;
    default:
      return null;
  }
}

const joinSchema = z.object({
  organizationId: z.string().uuid('Invalid organization id'),
});

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

  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid input';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { organizationId } = parsed.data;
  const userId = session.user.id;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, type: true },
    });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const targetRole = orgTypeToRole(org.type);

    await prisma.$transaction(async (tx) => {
      // Idempotent membership: existing members get a no-op update.
      await tx.organizationUser.upsert({
        where: {
          userId_organizationId: { userId, organizationId },
        },
        create: {
          userId,
          organizationId,
          role: OrgUserRole.MEMBER,
          isActive: true,
          showOnProfile: true,
        },
        update: {},
      });

      // Clean up any stale PENDING join request for this user+org so admin
      // queues don't show ghosts for users who joined directly.
      await tx.orgJoinRequest.deleteMany({
        where: { userId, organizationId, status: 'PENDING' },
      });

      // Promote role only if still INDIVIDUAL — never demote, never overwrite.
      if (targetRole) {
        await tx.user.updateMany({
          where: { id: userId, role: Role.INDIVIDUAL },
          data: { role: targetRole },
        });
      }
    });

    return NextResponse.json({
      organizationId: org.id,
      organizationName: org.name,
    });
  } catch (error: any) {
    console.error('[POST /api/auth/org-setup/join] Error:', error);
    return NextResponse.json({ error: 'Failed to join organization' }, { status: 500 });
  }
}
