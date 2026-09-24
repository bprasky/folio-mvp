import { prisma } from '@/lib/prisma';
import { OrgType, type Prisma } from '@prisma/client';
import { roleForOrgType } from './role-org-mapping';
import { normalizeFirmName, type FirmMatch } from './firm-name';

export class FirmAlreadyExists extends Error {
  constructor(public readonly organization: FirmMatch) {
    super('This firm is already on Folio. Request access to its existing page.');
  }
}

/** Call within the same transaction as a create or rename. */
export async function assertFirmNameAvailable(tx: Prisma.TransactionClient, name: string, excludeId = '') {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(73194, 2049)`;
  const key = normalizeFirmName(name);
  const matches = await tx.$queryRaw<FirmMatch[]>`
    SELECT id, name, type, location FROM organizations
    WHERE lower(btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))) = ${key}
      AND id <> ${excludeId}
    ORDER BY "createdAt", id LIMIT 1
  `;
  if (matches[0]) throw new FirmAlreadyExists(matches[0]);
}

/** All public firm creation routes use this transaction, including legacy URLs. */
export async function createFirm(input: {
  userId: string;
  name: string;
  type: OrgType;
  location?: string;
  website?: string;
}) {
  const name = input.name.trim().replace(/\s+/g, ' ');
  return prisma.$transaction(async (tx) => {
    // Serialize enrollment creators before checking identity. Unlike a client
    // search or a check outside the transaction, this covers concurrent requests.
    // Every public creator must use this service. Existing records are not merged.
    await assertFirmNameAvailable(tx, name);
    const org = await tx.organization.create({
      data: {
        name,
        type: input.type,
        capabilities: [input.type],
        location: input.location?.trim() || null,
        website: input.website?.trim() || null,
        createdById: input.userId,
        // Creator confirmation is sufficient at launch. This is not independent
        // verification: verifiedAt/verifiedBy remain unset.
        status: 'CLAIMED',
      },
      select: { id: true, name: true, type: true, location: true },
    });
    await tx.organizationUser.create({
      data: { userId: input.userId, organizationId: org.id, role: 'OWNER', isActive: true, showOnProfile: true },
    });
    const role = roleForOrgType(input.type);
    if (role) await tx.user.updateMany({ where: { id: input.userId, role: 'INDIVIDUAL' }, data: { role } });
    const now = new Date();
    await tx.user.update({
      where: { id: input.userId },
      data: {
        operatingAsOrgId: org.id,
        onboardingDiagnosticAt: now,
        onboardingFirmContextAt: now,
        onboardingBioCaptureAt: now,
        onboardingProfilePreviewAt: now,
      },
    });
    return org;
  });
}
