export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

// Step 4 (17_ONBOARDING_FLOW). Marks profile preview seen.
// Called when the user clicks "Add your first project" (or "Skip for now").
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardingProfilePreviewAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
