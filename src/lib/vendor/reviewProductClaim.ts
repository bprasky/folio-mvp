import { prisma } from '@/lib/prisma';
import { canClaimExistingProducts } from './claimAuthorization';

export class ClaimConflict extends Error {}

/** The candidate lock serializes confirm/reject. Throwing after a lost product
 * race rolls back the candidate transition too (PostgreSQL transaction). */
export async function reviewProductClaim(candidateId: string, organizationId: string, userId: string, action: 'confirm' | 'reject') {
  return prisma.$transaction(async tx => {
    if (!await canClaimExistingProducts(userId, organizationId, tx)) throw new ClaimConflict('Organization verification and active vendor membership are required.');
    const candidate = await tx.productClaimCandidate.findFirst({ where: { id: candidateId, organizationId } });
    if (!candidate || candidate.status !== 'PENDING') throw new ClaimConflict('This candidate has already been reviewed or is unavailable.');
    const status = action === 'confirm' ? 'CONFIRMED' : 'REJECTED';
    const decision = await tx.productClaimCandidate.updateMany({
      where: { id: candidateId, organizationId, status: 'PENDING' },
      data: { status, reviewedById: userId, reviewedAt: new Date() },
    });
    if (decision.count !== 1) throw new ClaimConflict('This candidate has already been reviewed.');
    if (action === 'confirm') {
      const assigned = await tx.product.updateMany({ where: { id: candidate.productId, vendorId: null }, data: { vendorId: userId } });
      if (assigned.count !== 1) throw new ClaimConflict('This product already has an owner. No ownership changed.');
    }
    return status;
  });
}
