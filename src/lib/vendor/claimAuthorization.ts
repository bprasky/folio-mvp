import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// Membership grants catalog creation; claiming existing designer-attributed
// products additionally requires an organization verified by a real Folio admin.
export async function vendorClaimMembership(userId: string, organizationId?: string, db: Prisma.TransactionClient = prisma) {
  return db.organizationUser.findFirst({
    where: { userId, isActive: true, role: { in: ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'] },
      ...(organizationId ? { organizationId } : {}),
      organization: { type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] } } },
    include: { organization: true },
  });
}

export async function canClaimExistingProducts(userId: string, organizationId: string, db: Prisma.TransactionClient = prisma) {
  const membership = await vendorClaimMembership(userId, organizationId, db);
  const org = membership?.organization;
  if (!org?.verifiedAt || !org.verifiedBy) return false;
  return (await db.user.count({ where: { id: org.verifiedBy, role: 'ADMIN' } })) === 1;
}
