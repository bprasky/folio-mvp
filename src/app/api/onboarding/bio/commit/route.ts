export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

// Step 3 commit (17_ONBOARDING_FLOW). Writes already-reviewed profile fields.
const bodySchema = z.object({
  location: z.string().trim().max(120).nullable().optional(),
  title: z.string().trim().max(120).nullable().optional(),
  specialties: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  bio: z.string().trim().min(1).max(4000),
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

  const { location, title, specialties, bio } = parsed.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      bio,
      location: location ?? null,
      title: title ?? null,
      specialties: specialties ?? [],
      onboardingBioCaptureAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    nextPath: '/onboarding/profile-preview',
  });
}
