import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { DiagnosticForm } from './diagnostic-form';

// Step 1 — Diagnostic (17_ONBOARDING_FLOW).
// "How are you here to use Folio?" — four cards.
export const dynamic = 'force-dynamic';

export default async function DiagnosticPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, onboardingDiagnosticAt: true },
  });

  // If the user already finished the diagnostic, send them to the next step.
  if (user?.onboardingDiagnosticAt) {
    redirect('/onboarding');
  }

  // Pre-select the user's current role if it already matches a professional
  // role (existing users being funnelled through the flow). This makes the
  // diagnostic a one-click confirmation for them rather than a re-decision.
  const initialSelection =
    user?.role === 'DESIGNER' ||
    user?.role === 'ARCHITECT' ||
    user?.role === 'BUILDER' ||
    user?.role === 'INDIVIDUAL'
      ? user.role
      : null;

  return (
    <OnboardingShell step="diagnostic" prompt="How are you here to use Folio?">
      <DiagnosticForm initialSelection={initialSelection} />
    </OnboardingShell>
  );
}
