import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { isProfessionalRole } from '@/lib/onboarding/resume';
import { BioForm } from './bio-form';

// Step 3 — Bio Capture (17_ONBOARDING_FLOW). Single free-text input.
export const dynamic = 'force-dynamic';

export default async function BioPage() {
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
      bio: true,
    },
  });

  if (!user?.onboardingDiagnosticAt) {
    redirect('/onboarding/diagnostic');
  }
  if (!isProfessionalRole(user.role)) {
    redirect('/');
  }
  if (!user.onboardingFirmContextAt) {
    redirect('/onboarding/firm');
  }
  if (user.onboardingBioCaptureAt) {
    redirect('/onboarding/profile-preview');
  }

  return (
    <OnboardingShell
      step="bio"
      prompt="Tell us about your practice."
    >
      <BioForm initialBio={user.bio ?? ''} />
    </OnboardingShell>
  );
}
