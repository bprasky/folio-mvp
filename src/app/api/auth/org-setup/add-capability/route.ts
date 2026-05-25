export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { OrgType, OrgUserRole } from '@prisma/client';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

// The signup-intent → OrgType mapping, mirrored from /api/auth/org-setup.
// Kept here (not imported) so each endpoint owns its own contract and can be
// edited independently.
const INTENT_TO_ORG_TYPE: Record<string, OrgType> = {
  designer: OrgType.DESIGN_FIRM,
  architect: OrgType.ARCHITECTURE_FIRM,
  builder: OrgType.CONTRACTOR,
  vendor: OrgType.VENDOR,
};

const addCapabilitySchema = z.object({
  organizationId: z.string().uuid('Invalid organization id'),
  capability: z.enum(['designer', 'architect', 'builder', 'vendor']),
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

  const parsed = addCapabilitySchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid input';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { organizationId, capability } = parsed.data;
  const newType = INTENT_TO_ORG_TYPE[capability];
  const userId = session.user.id;

  // Admin gate: only OWNER/ADMIN of the target org can add a capability.
  // This is the rule that keeps casual members from accidentally turning a
  // design firm into a "designer + vendor" hybrid.
  const membership = await prisma.organizationUser.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true, isActive: true },
  });
  if (!membership || !membership.isActive) {
    return NextResponse.json(
      { error: 'You are not a member of this organization.' },
      { status: 403 }
    );
  }
  if (membership.role !== OrgUserRole.OWNER && membership.role !== OrgUserRole.ADMIN) {
    return NextResponse.json(
      { error: 'Only an owner or admin of this organization can add a capability.' },
      { status: 403 }
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, type: true, capabilities: true },
  });
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // Idempotent: if the capability is already on the org, just return ok.
  if (org.capabilities.includes(newType) || org.type === newType) {
    return NextResponse.json({
      organizationId: org.id,
      organizationName: org.name,
      capabilities: org.capabilities,
      alreadyPresent: true,
    });
  }

  try {
    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        capabilities: { push: newType },
      },
      select: { id: true, name: true, capabilities: true },
    });
    return NextResponse.json({
      organizationId: updated.id,
      organizationName: updated.name,
      capabilities: updated.capabilities,
      alreadyPresent: false,
    });
  } catch (error: any) {
    console.error('[POST /api/auth/org-setup/add-capability] Error:', error);
    return NextResponse.json({ error: 'Failed to add capability' }, { status: 500 });
  }
}
