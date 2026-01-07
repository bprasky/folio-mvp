// NOTE (designer onboarding):
// Helper to get current designer from session.
// Used in onboarding pages and brand setup flows.

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function getCurrentDesigner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      onboardingBrandStepCompletedAt: true,
    },
  });

  if (!user || user.role !== 'DESIGNER') return null;

  return user;
}

export async function getCurrentDesignerOrThrow() {
  const designer = await getCurrentDesigner();
  if (!designer) {
    throw new Error('Unauthorized: Must be a designer');
  }
  return designer;
}

