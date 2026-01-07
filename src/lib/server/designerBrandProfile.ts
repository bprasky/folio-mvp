// NOTE (designer onboarding):
// Helper functions for managing DesignerBrandProfile records.
// Used during first-time designer account creation and brand setup flow.

import { prisma } from "@/lib/prisma";

export async function getDesignerBrandProfileByDesignerId(designerId: string) {
  return prisma.designerBrandProfile.findUnique({
    where: { designerId },
  });
}

export async function createEmptyDesignerBrandProfile(designerId: string) {
  // Only create if it doesn't exist yet
  const existing = await prisma.designerBrandProfile.findUnique({
    where: { designerId },
  });
  if (existing) return existing;

  return prisma.designerBrandProfile.create({
    data: {
      designerId,
    },
  });
}

export async function updateDesignerBrandProfile(
  designerId: string,
  data: {
    logoImageUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    accentColor?: string | null;
    fontHeading?: string | null;
    fontBody?: string | null;
    websiteUrl?: string | null;
    setupCompletedAt?: Date | null;
    setupSkippedAt?: Date | null;
  }
) {
  return prisma.designerBrandProfile.upsert({
    where: { designerId },
    create: {
      designerId,
      ...data,
    },
    update: data,
  });
}

