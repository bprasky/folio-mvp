export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { resolveVendorRep } from '@/lib/messaging/rep-resolution';
import { sendMessageNotification } from '@/lib/messaging/notifications';
import type { StructuredRequestPayload } from '@/types/structured-requests';

/**
 * POST /api/designer/sourcebook/request
 * Send a structured request (sample, quote, or general) to a vendor rep.
 *
 * Body: {
 *   actionType: 'SAMPLE_REQUEST' | 'QUOTE_REQUEST' | 'GENERAL',
 *   productId: string,
 *   recipientUserId?: string,  // If known (from rep resolver selection)
 *   payload: StructuredRequestPayload,
 *   message?: string,          // Human-readable body
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { actionType, productId, recipientUserId, payload, message } = await request.json();

    if (!actionType || !productId) {
      return NextResponse.json({ error: 'actionType and productId are required' }, { status: 400 });
    }

    const userId = session.user.id;

    // Determine recipient
    let targetUserId = recipientUserId;
    let targetOrgId: string | undefined;

    if (!targetUserId) {
      // Auto-resolve
      const resolution = await resolveVendorRep(userId, productId);

      if (resolution.status === 'DIRECT_REP' && resolution.rep) {
        targetUserId = resolution.rep.userId;
        targetOrgId = resolution.vendorOrgId;
      } else if (resolution.status === 'ORG_MEMBERS') {
        // Return resolution so client shows picker
        return NextResponse.json({
          resolutionNeeded: true,
          resolution,
        });
      } else {
        // No rep found
        return NextResponse.json({
          resolutionNeeded: true,
          resolution,
        });
      }
    }

    // Build human-readable body from structured data
    const body = message || buildMessageBody(actionType, payload as StructuredRequestPayload);

    // Create conversation with structured metadata
    const now = new Date();
    const conversation = await prisma.conversation.create({
      data: {
        initiatorUserId: userId,
        recipientUserId: targetUserId,
        ...(targetOrgId ? { recipientOrgId: targetOrgId } : {}),
        subject: buildSubject(actionType, payload as StructuredRequestPayload),
        context: 'VENDOR_OUTREACH',
        category: actionType,
        structuredData: payload,
        productId,
        lastMessageAt: now,
        messages: {
          create: {
            senderUserId: userId,
            body,
          },
        },
        participants: {
          create: { userId },
        },
      },
      include: { messages: true },
    });

    // Add recipient as participant
    if (targetUserId) {
      await prisma.conversationParticipant.create({
        data: {
          conversationId: conversation.id,
          userId: targetUserId,
          ...(targetOrgId ? { orgId: targetOrgId } : {}),
          unreadCount: 1,
        },
      }).catch(() => { /* skip duplicate */ });
    }

    // If targeting an org, also add org admins
    if (targetOrgId) {
      const orgMembers = await prisma.organizationUser.findMany({
        where: {
          organizationId: targetOrgId,
          isActive: true,
          role: { in: ['OWNER', 'ADMIN'] },
          userId: { notIn: [userId, ...(targetUserId ? [targetUserId] : [])] },
        },
        select: { userId: true },
      });

      for (const member of orgMembers) {
        await prisma.conversationParticipant.create({
          data: {
            conversationId: conversation.id,
            userId: member.userId,
            orgId: targetOrgId,
            unreadCount: 1,
          },
        }).catch(() => { /* skip duplicate */ });
      }
    }

    // Send notification
    const messageId = conversation.messages[0]?.id;
    if (messageId) {
      sendMessageNotification(conversation.id, messageId).catch(console.error);
    }

    return NextResponse.json({ conversationId: conversation.id }, { status: 201 });
  } catch (error) {
    console.error('[API] /api/designer/sourcebook/request error:', error);
    return NextResponse.json({ error: 'Failed to send request' }, { status: 500 });
  }
}

function buildSubject(actionType: string, payload: StructuredRequestPayload): string {
  switch (actionType) {
    case 'SAMPLE_REQUEST':
      return `Sample Request \u2013 ${payload.productName}`;
    case 'QUOTE_REQUEST':
      return `Quote Request \u2013 ${payload.productName}`;
    default:
      return `Regarding ${payload.productName}`;
  }
}

function buildMessageBody(actionType: string, payload: StructuredRequestPayload): string {
  const p = payload as unknown as Record<string, unknown>;

  if (actionType === 'SAMPLE_REQUEST') {
    let body = `I'm requesting a sample of the ${p.productName} from ${p.vendorName}.`;
    if (p.finishOrColorway) body += `\n\nFinish/Colorway: ${p.finishOrColorway}`;
    if (p.shippingAddress) body += `\n\nShip to:\n${p.shippingAddress}`;
    if (p.designerNote) body += `\n\n${p.designerNote}`;
    return body;
  }

  if (actionType === 'QUOTE_REQUEST') {
    const timelineLabels: Record<string, string> = {
      urgent: 'Urgent',
      '2-4_weeks': '2\u20134 weeks',
      flexible: 'Flexible',
    };
    let body = `I'm requesting a quote for the ${p.productName} from ${p.vendorName}.`;
    body += `\n\nQuantity: ${p.quantity}`;
    body += `\nTimeline: ${timelineLabels[p.timeline as string] || p.timeline}`;
    if (p.projectName) body += `\nProject: ${p.projectName}`;
    if (p.notes) body += `\n\n${p.notes}`;
    body += '\n\nPlease provide pricing including trade discount if applicable.';
    return body;
  }

  return `Regarding ${p.productName}`;
}
