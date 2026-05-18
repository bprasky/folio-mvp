import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { isProfessionalRole } from '@/lib/onboarding/resume';
import { ProfilePreviewActions } from './profile-preview-actions';

export const dynamic = 'force-dynamic';

// Step 4 — Profile Preview (17_ONBOARDING_FLOW). Sparse personal profile +
// "Add your first project" CTA.
export default async function ProfilePreviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      role: true,
      bio: true,
      title: true,
      location: true,
      specialties: true,
      onboardingDiagnosticAt: true,
      onboardingFirmContextAt: true,
      onboardingBioCaptureAt: true,
      onboardingProfilePreviewAt: true,
      organizationUsers: {
        where: { isActive: true },
        take: 1,
        include: {
          organization: { select: { name: true, type: true } },
        },
      },
    },
  });

  if (!user?.onboardingDiagnosticAt) redirect('/onboarding/diagnostic');
  if (!isProfessionalRole(user.role)) redirect('/');
  if (!user.onboardingFirmContextAt) redirect('/onboarding/firm');
  if (!user.onboardingBioCaptureAt) redirect('/onboarding/bio');

  const firm = user.organizationUsers[0]?.organization?.name ?? null;

  // Phase 1 boundary: Designer publishing is wired end-to-end. Architect and
  // Builder profile creation works but project publishing is held until 1B.
  const canPublishProjects = user.role === 'DESIGNER';

  return (
    <OnboardingShell
      step="profile-preview"
      prompt="Your profile is ready."
    >
      <div className="space-y-8">
        <div className="rounded-2xl bg-white/60 backdrop-blur-sm border border-folio-border-subtle/70 px-6 py-8 text-center space-y-3">
          {user.title && (
            <div className="text-sm uppercase tracking-wide text-folio-text-tertiary">
              {user.title}
            </div>
          )}
          <div className="folio-quote text-3xl text-folio-text-primary">
            {user.name}
          </div>
          {(user.location || firm) && (
            <div className="text-folio-text-secondary font-body">
              {[firm, user.location].filter(Boolean).join(' · ')}
            </div>
          )}
          {user.bio && (
            <p className="text-folio-text-secondary font-body leading-relaxed max-w-prose mx-auto pt-2">
              {user.bio}
            </p>
          )}
          {user.specialties.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 pt-3">
              {user.specialties.map((s) => (
                <span
                  key={s}
                  className="text-xs px-3 py-1 rounded-full bg-surface-ground/80 border border-folio-border-subtle/70 text-folio-text-secondary"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        <ProfilePreviewActions
          alreadyCompleted={!!user.onboardingProfilePreviewAt}
          canPublishProjects={canPublishProjects}
        />
      </div>
    </OnboardingShell>
  );
}
