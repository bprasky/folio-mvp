/**
 * Pending Action Delivery
 *
 * When a new user joins Folio, check if any pending actions target their email
 * and deliver them as structured conversations.
 */

import { prisma } from '@/lib/prisma';
import { sendMessageNotification } from '@/lib/messaging/notifications';

/**
 * Deliver all pending actions targeting the given email.
 * Called during signup or vendor invite claim flow.
 */
export async function deliverPendingActions(userEmail: string): Promise<number> {
  const pendingActions = await prisma.pendingAction.findMany({
    where: {
      targetEmail: { equals: userEmail, mode: 'insensitive' },
      status: 'PENDING',
    },
    include: {
      sender: {
        select: { id: true, name: true },
      },
      product: {
        select: { id: true, name: true, brand: true },
      },
    },
  });

  if (pendingActions.length === 0) return 0;

  // Find the new user by email
  const newUser = await prisma.user.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
    select: { id: true },
  });

  if (!newUser) return 0;

  let delivered = 0;

  for (const action of pendingActions) {
    try {
      const payload = action.payload as Record<string, unknown>;
      const productName = action.product.name;
      const vendorName = action.product.brand || '';

      // Build message body from payload
      let body = '';
      if (action.actionType === 'SAMPLE_REQUEST') {
        body = `Sample request for ${productName} from ${vendorName}.`;
        if (payload.finishOrColorway) body += `\nFinish: ${payload.finishOrColorway}`;
        if (payload.shippingAddress) body += `\nShip to: ${payload.shippingAddress}`;
      } else if (action.actionType === 'QUOTE_REQUEST') {
        body = `Quote request for ${productName} from ${vendorName}.`;
        if (payload.quantity) body += `\nQuantity: ${payload.quantity}`;
        if (payload.timeline) body += `\nTimeline: ${payload.timeline}`;
      } else {
        body = `Message regarding ${productName}.`;
      }

      if (payload.notes || payload.designerNote) {
        body += `\n\n${payload.notes || payload.designerNote}`;
      }

      // Create conversation
      const now = new Date();
      const conversation = await prisma.conversation.create({
        data: {
          initiatorUserId: action.senderId,
          recipientUserId: newUser.id,
          subject: `${action.actionType === 'SAMPLE_REQUEST' ? 'Sample' : action.actionType === 'QUOTE_REQUEST' ? 'Quote' : ''} Request \u2013 ${productName}`.trim(),
          context: 'VENDOR_OUTREACH',
          category: action.actionType,
          structuredData: action.payload,
          productId: action.productId,
          lastMessageAt: now,
          messages: {
            create: {
              senderUserId: action.senderId,
              body,
            },
          },
          participants: {
            createMany: {
              data: [
                { userId: action.senderId },
                { userId: newUser.id, unreadCount: 1 },
              ],
              skipDuplicates: true,
            },
          },
        },
        include: { messages: true },
      });

      // Update pending action as delivered
      await prisma.pendingAction.update({
        where: { id: action.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: now,
        },
      });

      // Send notification
      const messageId = conversation.messages[0]?.id;
      if (messageId) {
        sendMessageNotification(conversation.id, messageId).catch(console.error);
      }

      delivered++;
    } catch (error) {
      console.error(`[deliverPendingActions] Failed to deliver action ${action.id}:`, error);
    }
  }

  return delivered;
}

/**
 * Find pending actions that have been waiting 7+ days without a reminder.
 * Returns actions that should trigger a nudge to the designer.
 */
export async function findStaleActions(): Promise<string[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const staleActions = await prisma.pendingAction.findMany({
    where: {
      status: 'PENDING',
      inviteSentAt: { lt: sevenDaysAgo },
      reminderSentAt: null,
    },
    select: { id: true },
  });

  return staleActions.map(a => a.id);
}
