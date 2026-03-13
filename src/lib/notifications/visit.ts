/**
 * Visit / QR Exchange Notifications
 */

import { prisma } from '@/lib/prisma';

export async function notifyVisitConnected(params: {
  visitId: string;
  initiatorUserId: string;
  initiatorName: string;
  initiatorOrgName: string | null;
  recipientUserId: string;
  recipientOrgId: string | null;
  recipientOrgName: string | null;
  location: string | null;
}): Promise<void> {
  const { visitId, initiatorName, initiatorOrgName, recipientUserId, location } = params;

  const orgSuffix = initiatorOrgName ? ` from ${initiatorOrgName}` : '';
  const locationSuffix = location ? ` at ${location}` : '';

  // 1. Notify the scanned person directly
  await prisma.notification.create({
    data: {
      userId: recipientUserId,
      type: 'VISIT_CONNECTED',
      title: `${initiatorName} connected with you on Folio`,
      body: `${initiatorName}${orgSuffix} scanned your badge${locationSuffix}.`,
      actionUrl: `/visits/${visitId}`,
      metadata: {
        visitId,
        initiatorUserId: params.initiatorUserId,
      },
    },
  });

  // 2. Cross-org notification: notify initiator's org members
  await notifyOrgMembers({
    visitId,
    actorUserId: params.initiatorUserId,
    actorName: initiatorName,
    otherPersonName: '', // Will be filled below
    otherOrgName: params.recipientOrgName,
    location,
  });
}

/**
 * Notify org members when one of their colleagues makes a new connection.
 * "Amy connected with Waterworks at KBIS"
 */
async function notifyOrgMembers(params: {
  visitId: string;
  actorUserId: string;
  actorName: string;
  otherPersonName: string;
  otherOrgName: string | null;
  location: string | null;
}): Promise<void> {
  const { visitId, actorUserId, actorName, otherOrgName, location } = params;

  // Get the actor's active org
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { operatingAsOrgId: true },
  });

  if (!actor?.operatingAsOrgId) return;

  // Get other org members (exclude the actor)
  const orgMembers = await prisma.organizationUser.findMany({
    where: {
      organizationId: actor.operatingAsOrgId,
      isActive: true,
      userId: { not: actorUserId },
    },
    select: { userId: true },
  });

  if (orgMembers.length === 0) return;

  const target = otherOrgName || 'a new contact';
  const locationSuffix = location ? ` at ${location}` : '';

  // Batch create notifications for org members
  await prisma.notification.createMany({
    data: orgMembers.map((m) => ({
      userId: m.userId,
      type: 'ORG_MEMBER_CONNECTED',
      title: `${actorName} made a new connection`,
      body: `${actorName} connected with ${target}${locationSuffix}. View in your vendor directory.`,
      actionUrl: `/org/${actor.operatingAsOrgId}?tab=vendors`,
      metadata: {
        visitId,
        actorUserId,
      },
    })),
  });
}
