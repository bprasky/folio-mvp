import { prisma } from '../prisma';

/**
 * Resolves an active collaboration participant for a vendor-project pair.
 * This is the single source of truth for collaboration-gated spend eligibility.
 * 
 * @param vendorId - The vendor organization ID (orgId from Organization where type=VENDOR)
 * @param projectId - The project ID
 * @returns ProjectParticipant if active collaboration exists, null otherwise
 */
export async function resolveCollaboration(
  vendorOrgId: string,
  projectId: string
): Promise<{
  id: string;
  spendPerSaveUsd: number | null;
  spendPerClickUsd: number | null;
  budgetCapUsd: number | null;
} | null> {
  // Find ProjectParticipant where:
  // - projectId matches
  // - orgId belongs to vendor org (side=VENDOR)
  // - collaborationStatus == ACTIVE
  // - spendEnabled == true
  const participant = await prisma.projectParticipant.findFirst({
    where: {
      projectId,
      orgId: vendorOrgId,
      side: 'VENDOR',
      collaborationStatus: 'ACTIVE',
      spendEnabled: true,
    },
    select: {
      id: true,
      spendPerSaveUsd: true,
      spendPerClickUsd: true,
      budgetCapUsd: true,
    },
  });

  if (!participant) {
    return null;
  }

  return {
    id: participant.id,
    spendPerSaveUsd: participant.spendPerSaveUsd ?? null,
    spendPerClickUsd: participant.spendPerClickUsd ?? null,
    budgetCapUsd: participant.budgetCapUsd ?? null,
  };
}








