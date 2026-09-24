import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { professionalSetupHref } from '@/lib/onboarding/professional-entry';

export const dynamic = 'force-dynamic';

// Diagnostic Step 1 (17_ONBOARDING_FLOW).
// Builder card maps to existing Role = BUILDER (per founder decision; spec's
// CONTRACTOR mapping does not match the schema). Individual users have all
// downstream onboarding steps stamped immediately since steps 2–4 are
// professional-only.
const bodySchema = z.object({
  role: z.enum(['DESIGNER', 'ARCHITECT', 'BUILDER', 'INDIVIDUAL']),
});

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

  const { role } = parsed.data;
  const now = new Date();

  // Intent does not grant a global professional role. Membership enrollment owns promotion.
  // Browsers may finish immediately; professional intent continues to firm setup.
  const stampAll = role === 'INDIVIDUAL';

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      onboardingDiagnosticAt: now,
      ...(stampAll
        ? {
            onboardingFirmContextAt: now,
            onboardingBioCaptureAt: now,
            onboardingProfilePreviewAt: now,
          }
        : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    nextPath: stampAll ? '/' : professionalSetupHref(role.toLowerCase()),
  });
}
