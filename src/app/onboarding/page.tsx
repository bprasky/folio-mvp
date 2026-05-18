import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import {
  nextOnboardingStep,
  resumePathForStep,
} from '@/lib/onboarding/resume';

// 17_ONBOARDING_FLOW: the bare /onboarding entry is now a server-side resume.
// The previous 5-screen welcome carousel has been retired in favor of the
// Diagnostic → Firm Context → Bio Capture → Profile Preview sequence.
export const dynamic = 'force-dynamic';

export default async function OnboardingRootPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      onboardingDiagnosticAt: true,
      onboardingFirmContextAt: true,
      onboardingBioCaptureAt: true,
      onboardingProfilePreviewAt: true,
    },
  });

  const step = nextOnboardingStep(user?.role, user ?? {});
  redirect(resumePathForStep(step));
}
