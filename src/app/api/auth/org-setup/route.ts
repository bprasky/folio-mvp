export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { OrgType, OrgStatus, OrgUserRole, Role } from '@prisma/client';
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

const createSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(120),
  type: z.enum(['designer', 'architect', 'builder', 'vendor']),
  website: z.string().url('Website must be a valid URL').max(200).optional().or(z.literal('')),
  location: z.string().max(120).optional().or(z.literal('')),
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid input';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { name, type, website, location } = parsed.data;
  const orgType = INTENT_TO_ORG_TYPE[type];
  const trimmedName = name.trim();

  try {
    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: trimmedName,
          type: orgType,
          status: OrgStatus.UNCLAIMED,
          website: website?.trim() || null,
          location: location?.trim() || null,
          createdById: session.user.id,
        },
        select: { id: true, name: true, type: true },
      });

      await tx.organizationUser.create({
        data: {
          userId: session.user.id,
          organizationId: org.id,
          role: OrgUserRole.OWNER,
          isActive: true,
          showOnProfile: true,
        },
      });

      // Auto-promote: INDIVIDUAL → matching pro role. updateMany with the
      // role guard makes this a no-op for users already on a non-individual
      // role (e.g. they founded a design firm before, now founding a vendor
      // brand — keep their original promotion).
      await tx.user.updateMany({
        where: { id: session.user.id, role: Role.INDIVIDUAL },
        data: { role: INTENT_TO_ROLE[type] },
      });

      return org;
    });

    return NextResponse.json(
      { organizationId: organization.id, organizationName: organization.name },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[POST /api/auth/org-setup] Error:', error);
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}
