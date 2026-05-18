import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { orgTypeForRole } from '@/lib/onboarding/role-org-mapping';

export const dynamic = 'force-dynamic';

// Step 2 (17_ONBOARDING_FLOW). Three resolution modes:
//   join   — user joins an existing Organization as MEMBER
//   create — user creates a new Organization and becomes OWNER
//   solo   — user creates a Solo Practice Organization and becomes OWNER
const bodySchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('join'), organizationId: z.string().uuid() }),
  z.object({
    mode: z.literal('create'),
    name: z.string().trim().min(1).max(120),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
  }),
  z.object({ mode: z.literal('solo') }),
]);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const role = session.user.role;
  const orgType = orgTypeForRole(role);
  if (!orgType) {
    return NextResponse.json(
      { error: 'Firm context only applies to professional roles' },
      { status: 400 }
    );
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    let organizationId: string;

    if (parsed.data.mode === 'join') {
      const org = await tx.organization.findUnique({
        where: { id: parsed.data.organizationId },
        select: { id: true },
      });
      if (!org) throw new Error('Organization not found');
      organizationId = org.id;

      // Idempotent: upsert handles the case where the user re-enrolls.
      await tx.organizationUser.upsert({
        where: {
          userId_organizationId: { userId, organizationId },
        },
        create: {
          userId,
          organizationId,
          role: 'MEMBER',
          isActive: true,
        },
        update: {
          isActive: true,
        },
      });
    } else if (parsed.data.mode === 'create') {
      const { name, city, state } = parsed.data;
      const location = [city, state].filter(Boolean).join(', ') || null;
      const created = await tx.organization.create({
        data: {
          name,
          type: orgType,
          location,
        },
        select: { id: true },
      });
      organizationId = created.id;

      await tx.organizationUser.create({
        data: {
          userId,
          organizationId,
          role: 'OWNER',
          isActive: true,
        },
      });
    } else {
      // Solo practice: name defaults to user's display name.
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      const created = await tx.organization.create({
        data: {
          name: user?.name?.trim() || 'Solo Practice',
          type: orgType,
        },
        select: { id: true },
      });
      organizationId = created.id;

      await tx.organizationUser.create({
        data: {
          userId,
          organizationId,
          role: 'OWNER',
          isActive: true,
        },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: { onboardingFirmContextAt: now },
    });

    return { organizationId };
  });

  return NextResponse.json({ ok: true, ...result, nextPath: '/onboarding/bio' });
}
