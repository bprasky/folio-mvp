'use server';

// NOTE (designer onboarding):
// Server actions for brand setup flow.
// Handles saving brand profile and marking onboarding as complete/skipped.

import { getCurrentDesignerOrThrow } from '@/lib/auth/designerContext';
import { updateDesignerBrandProfile } from '@/lib/server/designerBrandProfile';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function saveBrandProfile(data: {
  logoImageUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  fontHeading?: string | null;
  fontBody?: string | null;
  websiteUrl?: string | null;
}) {
  try {
    const designer = await getCurrentDesignerOrThrow();

    await updateDesignerBrandProfile(designer.id, {
      ...data,
      setupCompletedAt: new Date(),
    });

    // Mark onboarding step as completed
    await prisma.user.update({
      where: { id: designer.id },
      data: {
        onboardingBrandStepCompletedAt: new Date(),
      },
    });

    revalidatePath('/designer/onboarding/brand');
    revalidatePath('/designer/profile');

    return { success: true };
  } catch (error) {
    console.error('Error saving brand profile:', error);
    return { success: false, error: 'Failed to save brand profile' };
  }
}

export async function skipBrandSetup() {
  try {
    const designer = await getCurrentDesignerOrThrow();

    // Create empty brand profile if it doesn't exist
    const { createEmptyDesignerBrandProfile } = await import('@/lib/server/designerBrandProfile');
    await createEmptyDesignerBrandProfile(designer.id);

    // Mark as skipped
    await prisma.user.update({
      where: { id: designer.id },
      data: {
        onboardingBrandStepCompletedAt: new Date(),
      },
    });

    await prisma.designerBrandProfile.updateMany({
      where: { designerId: designer.id },
      data: {
        setupSkippedAt: new Date(),
      },
    });

    revalidatePath('/designer/onboarding/brand');
    revalidatePath('/designer/profile');

    return { success: true };
  } catch (error) {
    console.error('Error skipping brand setup:', error);
    return { success: false, error: 'Failed to skip brand setup' };
  }
}

