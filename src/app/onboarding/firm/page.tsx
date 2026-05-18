import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { isProfessionalRole } from '@/lib/onboarding/resume';
import { FirmForm } from './firm-form';

// Step 2 — Firm Context (17_ONBOARDING_FLOW). Professional roles only.
export const dynamic = 'force-dynamic';

export default async function FirmPage() {
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
    },
  });

  if (!user?.onboardingDiagnosticAt) {
    redirect('/onboarding/diagnostic');
  }
  if (!isProfessionalRole(user.role)) {
    redirect('/');
  }
  if (user.onboardingFirmContextAt) {
    redirect('/onboarding/bio');
  }

  return (
    <OnboardingShell step="firm" prompt="Where do you practice?">
      <FirmForm role={user.role} />
    </OnboardingShell>
  );
}
