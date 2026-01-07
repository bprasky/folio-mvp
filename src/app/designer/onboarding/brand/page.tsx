// NOTE (designer onboarding):
// Brand identity setup page for first-time designers.
// Redirects to project creation if onboarding is already completed.

import { redirect } from 'next/navigation';
import { getCurrentDesignerOrThrow } from '@/lib/auth/designerContext';
import { getDesignerBrandProfileByDesignerId } from '@/lib/server/designerBrandProfile';
import { BrandSetupWizard } from '@/components/designer/BrandSetupWizard';

export default async function DesignerBrandOnboardingPage() {
  const designer = await getCurrentDesignerOrThrow();
  
  // If onboarding is already completed, redirect to project creation
  if (designer.onboardingBrandStepCompletedAt) {
    redirect('/designer/projects/new');
  }

  const brandProfile = await getDesignerBrandProfileByDesignerId(designer.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Make Folio feel like your studio
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Upload your logo and colors so your first project looks like you,
          not a generic template. You can always change this later.
        </p>
      </div>

      <BrandSetupWizard brandProfile={brandProfile} isEditMode={false} />
    </main>
  );
}

