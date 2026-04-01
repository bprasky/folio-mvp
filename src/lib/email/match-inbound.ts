/**
 * Match an inbound email to an existing EmailThread.
 *
 * Strategy:
 * 1. Check In-Reply-To / References headers against outbound resendMessageId
 * 2. Fallback: match proxy address (to) + sender (from) to latest active thread
 */

import { prisma } from '@/lib/prisma';
import { getUserIdFromProxyAddress } from './proxy-address';

interface InboundHeaders {
  'in-reply-to'?: string;
  references?: string;
}

export interface ThreadMatch {
  threadId: string;
  userId: string;
  conversationId: string | null;
}

export async function matchInboundToThread(
  toAddress: string,
  fromAddress: string,
  headers: InboundHeaders,
): Promise<ThreadMatch | null> {
  // Strategy 1: Match via In-Reply-To header
  const inReplyTo = headers['in-reply-to']?.replace(/[<>]/g, '');
  if (inReplyTo) {
    const message = await prisma.emailMessage.findFirst({
      where: { resendMessageId: inReplyTo },
      select: {
        thread: {
          select: { id: true, userId: true, conversationId: true },
        },
      },
    });
    if (message?.thread) {
      return {
        threadId: message.thread.id,
        userId: message.thread.userId,
        conversationId: message.thread.conversationId,
      };
    }
  }

  // Strategy 1b: Check References header (contains chain of message IDs)
  const references = headers.references;
  if (references) {
    const refIds = references.split(/\s+/).map(r => r.replace(/[<>]/g, '')).filter(Boolean);
    for (const refId of refIds.reverse()) {
      const message = await prisma.emailMessage.findFirst({
        where: { resendMessageId: refId },
        select: {
          thread: {
            select: { id: true, userId: true, conversationId: true },
          },
        },
      });
      if (message?.thread) {
        return {
          threadId: message.thread.id,
          userId: message.thread.userId,
          conversationId: message.thread.conversationId,
        };
      }
    }
  }

  // Strategy 2: Match proxy address to user, then find latest thread with this sender
  const userId = await getUserIdFromProxyAddress(toAddress);
  if (!userId) return null;

  const thread = await prisma.emailThread.findFirst({
    where: {
      userId,
      recipientEmail: fromAddress,
      status: { in: ['SENT', 'REPLIED'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, userId: true, conversationId: true },
  });

  if (!thread) return null;

  return {
    threadId: thread.id,
    userId: thread.userId,
    conversationId: thread.conversationId,
  };
}
