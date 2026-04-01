/**
 * ActionItemSignal recording utility.
 * Called automatically when actions are taken — captures intelligence signals
 * from every quote request, sample request, availability check, etc.
 */

import { prisma } from '@/lib/prisma';

interface RecordSignalParams {
  actionType: string;
  productId: string;
  designerOrgId: string;
  vendorOrgId?: string;
  projectId?: string;
  quantity?: number;
  unit?: string;
  timeline?: string;
  projectType?: string;
  location?: string;
  isOffPlatform?: boolean;
  isBulk?: boolean;
}

/**
 * Record an ActionItemSignal row. Fire-and-forget — errors are logged but don't block.
 */
export async function recordActionSignal(params: RecordSignalParams): Promise<void> {
  try {
    await prisma.actionItemSignal.create({
      data: {
        actionType: params.actionType,
        productId: params.productId,
        designerOrgId: params.designerOrgId,
        vendorOrgId: params.vendorOrgId || null,
        projectId: params.projectId || null,
        quantity: params.quantity || null,
        unit: params.unit || null,
        timeline: params.timeline || null,
        projectType: params.projectType || null,
        location: params.location || null,
        resolution: 'PENDING',
        isOffPlatform: params.isOffPlatform || false,
        isBulk: params.isBulk || false,
      },
    });
  } catch (error) {
    console.error('[recordActionSignal] Failed:', error);
  }
}

/**
 * Get the designer's org ID for signal recording.
 * Falls back to creating a signal without org if not found.
 */
export async function getDesignerOrgId(userId: string): Promise<string | null> {
  const membership = await prisma.organizationUser.findFirst({
    where: { userId, isActive: true },
    select: { organizationId: true },
  });
  return membership?.organizationId || null;
}
