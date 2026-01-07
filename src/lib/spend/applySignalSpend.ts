import { prisma } from '../prisma';
import { resolveCollaboration } from './resolveCollaboration';
import { priceSignal, SignalAction } from './priceSignal';
import { rateLimit } from '../rateLimit';

/**
 * Applies spend calculation to a signal and updates budget.
 * This is the main hook for signal spend attribution.
 * 
 * @param action - Signal action ('save' | 'add_to_project' | 'click')
 * @param vendorId - Vendor ID (from product.vendorId or vendorId field)
 * @param projectId - Project ID
 * @param userId - Authenticated user ID (for verification)
 * @returns Object with collaborationParticipantId, valueUsd, and budget status
 */
export async function applySignalSpend(
  action: SignalAction,
  vendorId: string | null | undefined,
  projectId: string | null | undefined,
  userId: string
): Promise<{
  collaborationParticipantId: string | null;
  valueUsd: number;
  budgetCapped: boolean;
}> {
  // Rate limiting: max N signals per (userId, action, projectId) per hour
  // v1: 100 saves/clicks per hour per project (generous to avoid false positives)
  if (projectId) {
    const rateLimitResult = rateLimit({
      userId,
      scope: `signal:${action}:${projectId}`,
      limit: 100,
      windowMs: 60 * 60 * 1000, // 1 hour
    });
    
    if (!rateLimitResult.ok) {
      // Rate limit exceeded - return 0 spend but don't fail signal creation
      console.warn('[SignalSpend] Rate limit exceeded for user:', userId);
      return {
        collaborationParticipantId: null,
        valueUsd: 0,
        budgetCapped: false,
      };
    }
  }

  // Early exit if no vendor or project
  if (!vendorId || !projectId) {
    return {
      collaborationParticipantId: null,
      valueUsd: 0,
      budgetCapped: false,
    };
  }

  // Resolve vendor organization ID
  // Strategy: Find ProjectParticipant where side=VENDOR for this project
  // This is the most reliable way since collaborations are project-scoped
  const vendorParticipant = await prisma.projectParticipant.findFirst({
    where: {
      projectId,
      side: 'VENDOR',
      collaborationStatus: 'ACTIVE',
      spendEnabled: true,
    },
    select: {
      id: true,
      orgId: true,
      spendPerSaveUsd: true,
      spendPerClickUsd: true,
      budgetCapUsd: true,
    },
  });

  if (!vendorParticipant || !vendorParticipant.orgId) {
    return {
      collaborationParticipantId: null,
      valueUsd: 0,
      budgetCapped: false,
    };
  }

  const vendorOrgId = vendorParticipant.orgId;

  // Use the participant we already found
  const collaboration = {
    id: vendorParticipant.id,
    spendPerSaveUsd: vendorParticipant.spendPerSaveUsd ?? null,
    spendPerClickUsd: vendorParticipant.spendPerClickUsd ?? null,
    budgetCapUsd: vendorParticipant.budgetCapUsd ?? null,
  };

  // Calculate spend value
  const pricing = await priceSignal(action, collaboration.id, vendorOrgId);
  if (pricing.valueUsd <= 0) {
    return {
      collaborationParticipantId: collaboration.id,
      valueUsd: 0,
      budgetCapped: pricing.reason === 'budget_capped' || pricing.reason === 'budget_exhausted',
    };
  }

  // Update monthly budget
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Get or create budget record
  let budget = await prisma.vendorDiscoveryBudget.findUnique({
    where: {
      orgId_periodStart: {
        orgId: vendorOrgId,
        periodStart,
      },
    },
  });

  if (!budget) {
    // Create budget record (v1: use collaboration budgetCapUsd or default)
    const defaultCap = collaboration.budgetCapUsd ?? 1000; // v1 default
    budget = await prisma.vendorDiscoveryBudget.create({
      data: {
        orgId: vendorOrgId,
        periodStart,
        periodEnd,
        budgetCapUsd: defaultCap,
        spentUsd: 0,
        status: 'ACTIVE',
      },
    });
  }

  // Check if budget is already capped
  if (budget.status === 'CAPPED' || budget.status === 'PAUSED') {
    return {
      collaborationParticipantId: collaboration.id,
      valueUsd: 0,
      budgetCapped: true,
    };
  }

  // Calculate new spent amount
  const newSpent = budget.spentUsd + pricing.valueUsd;
  const wouldExceed = newSpent > budget.budgetCapUsd;

  // Clamp value to remaining budget (v1 simplicity)
  const actualValueUsd = wouldExceed
    ? Math.max(0, budget.budgetCapUsd - budget.spentUsd)
    : pricing.valueUsd;

  // Update budget
  await prisma.vendorDiscoveryBudget.update({
    where: { id: budget.id },
    data: {
      spentUsd: budget.spentUsd + actualValueUsd,
      status: wouldExceed && actualValueUsd > 0 ? 'CAPPED' : budget.status,
    },
  });

  return {
    collaborationParticipantId: collaboration.id,
    valueUsd: actualValueUsd,
    budgetCapped: wouldExceed,
  };
}

