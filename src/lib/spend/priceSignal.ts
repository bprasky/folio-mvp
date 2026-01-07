import { prisma } from '../prisma';

export type SignalAction = 'save' | 'add_to_project' | 'click';

export interface PriceSignalResult {
  valueUsd: number;
  reason?: string;
}

/**
 * Calculates the spend value for a signal based on collaboration settings and budget availability.
 * 
 * @param action - Signal action type ('save' | 'add_to_project' | 'click')
 * @param participantId - ProjectParticipant ID
 * @param vendorOrgId - Vendor organization ID for budget lookup
 * @returns PriceSignalResult with valueUsd (0 if not eligible) and optional reason
 */
export async function priceSignal(
  action: SignalAction,
  participantId: string,
  vendorOrgId: string
): Promise<PriceSignalResult> {
  // Get participant with spend settings
  const participant = await prisma.projectParticipant.findUnique({
    where: { id: participantId },
    select: {
      collaborationStatus: true,
      spendEnabled: true,
      spendPerSaveUsd: true,
      spendPerClickUsd: true,
      budgetCapUsd: true,
    },
  });

  if (!participant) {
    return { valueUsd: 0, reason: 'participant_not_found' };
  }

  // Check if collaboration is active and spend enabled
  if (participant.collaborationStatus !== 'ACTIVE' || !participant.spendEnabled) {
    return { valueUsd: 0, reason: 'collaboration_not_active' };
  }

  // Determine base price based on action
  let basePrice: number | null = null;
  if (action === 'save' || action === 'add_to_project') {
    basePrice = participant.spendPerSaveUsd ?? null;
  } else if (action === 'click') {
    basePrice = participant.spendPerClickUsd ?? null;
  }

  if (!basePrice || basePrice <= 0) {
    return { valueUsd: 0, reason: 'no_price_configured' };
  }

  // Check monthly budget availability
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const budget = await prisma.vendorDiscoveryBudget.findUnique({
    where: {
      orgId_periodStart: {
        orgId: vendorOrgId,
        periodStart,
      },
    },
    select: {
      budgetCapUsd: true,
      spentUsd: true,
      status: true,
    },
  });

  // If no budget record exists, create one (v1: allow first signal to create budget)
  if (!budget) {
    // For v1, we'll allow the signal but budget will be created on first spend
    // Return base price - budget check happens in signal creation hook
    return { valueUsd: basePrice };
  }

  // Check if budget is capped or paused
  if (budget.status === 'CAPPED' || budget.status === 'PAUSED') {
    return { valueUsd: 0, reason: `budget_${budget.status.toLowerCase()}` };
  }

  // Check remaining budget
  const remaining = budget.budgetCapUsd - budget.spentUsd;
  if (remaining <= 0) {
    return { valueUsd: 0, reason: 'budget_exhausted' };
  }

  // Clamp value to remaining budget (v1 simplicity: clamp per-signal)
  const valueUsd = Math.min(basePrice, remaining);

  return { valueUsd };
}








