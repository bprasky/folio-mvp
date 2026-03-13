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
  location: string | null;
}): Promise<void> {
  const { visitId, initiatorName, initiatorOrgName, recipientUserId, location } = params;

  const orgSuffix = initiatorOrgName ? ` from ${initiatorOrgName}` : '';
  const locationSuffix = location ? ` at ${location}` : '';

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
}
