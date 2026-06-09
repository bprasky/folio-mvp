// @idor-allow: public-read reason="Resend inbound-email webhook; authenticated via Svix signature verification against RESEND_WEBHOOK_SECRET"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { prisma } from '@/lib/prisma';
import { matchInboundToThread } from '@/lib/email/match-inbound';

/**
 * POST /api/email/inbound
 *
 * Resend inbound webhook endpoint.
 * Receives vendor replies and matches them to existing email threads.
 *
 * Resend posts the parsed email with fields:
 *   from, to, subject, text, html, headers, ...
 *
 * Authenticated via Svix signature: the `svix-id`, `svix-timestamp`, and
 * `svix-signature` headers are verified against RESEND_WEBHOOK_SECRET over the
 * RAW request body before any parsing or DB work. Unsigned/invalid requests
 * are rejected with 401.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the Resend (Svix) signature over the raw body BEFORE parsing.
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Inbound] RESEND_WEBHOOK_SECRET is not set; rejecting webhook');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.text();
    const svixHeaders = {
      'svix-id': request.headers.get('svix-id') ?? '',
      'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
      'svix-signature': request.headers.get('svix-signature') ?? '',
    };

    if (!svixHeaders['svix-id'] || !svixHeaders['svix-timestamp'] || !svixHeaders['svix-signature']) {
      console.warn('[Inbound] Missing Svix signature headers; rejecting webhook');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
      body = new Webhook(webhookSecret).verify(rawBody, svixHeaders);
    } catch (verifyError) {
      console.warn('[Inbound] Svix signature verification failed; rejecting webhook');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resend webhook events have a 'type' field
    // For email.received events, the data contains email fields
    const eventType = body.type;
    const data = body.data || body;

    // Handle webhook verification ping
    if (eventType === 'email.test') {
      return NextResponse.json({ received: true });
    }

    const from = extractEmail(data.from);
    const to = extractEmail(data.to);
    const subject = data.subject || '';
    const textBody = data.text || '';
    const htmlBody = data.html || '';
    const headers = parseHeaders(data.headers || []);

    if (!from || !to) {
      console.warn('[Inbound] Missing from/to in webhook payload');
      return NextResponse.json({ received: true, matched: false });
    }

    // Match to an existing thread
    const match = await matchInboundToThread(to, from, headers);

    if (!match) {
      console.log(`[Inbound] No thread match for ${from} → ${to}`);
      return NextResponse.json({ received: true, matched: false });
    }

    const now = new Date();

    // Store the inbound message
    await prisma.emailMessage.create({
      data: {
        threadId: match.threadId,
        direction: 'INBOUND',
        fromAddress: from,
        toAddress: to,
        subject,
        textBody,
        htmlBody: htmlBody || null,
        inboundId: data.id || null,
        sentAt: now,
      },
    });

    // Update thread status
    await prisma.emailThread.update({
      where: { id: match.threadId },
      data: { status: 'REPLIED', updatedAt: now },
    });

    // Add the reply as a message in the linked conversation (for inbox display)
    if (match.conversationId) {
      // Get the thread to find recipient info
      const thread = await prisma.emailThread.findUnique({
        where: { id: match.threadId },
        select: { recipientName: true, recipientEmail: true },
      });

      await prisma.conversation.update({
        where: { id: match.conversationId },
        data: {
          lastMessageAt: now,
          messages: {
            create: {
              senderUserId: match.userId, // Display under the thread owner for now
              body: `[Reply from ${thread?.recipientName || from}]\n\n${textBody}`,
            },
          },
        },
      });

      // Increment unread count for the designer
      await prisma.conversationParticipant.updateMany({
        where: {
          conversationId: match.conversationId,
          userId: match.userId,
        },
        data: { unreadCount: { increment: 1 } },
      });
    }

    // Update RepShadowProfile response time if applicable
    const thread = await prisma.emailThread.findUnique({
      where: { id: match.threadId },
      select: { createdAt: true, recipientEmail: true, vendorOrgId: true },
    });

    if (thread?.vendorOrgId) {
      const responseHours = (now.getTime() - thread.createdAt.getTime()) / (1000 * 60 * 60);

      // Find the rep shadow profile by email
      const repShadow = await prisma.repShadowProfile.findFirst({
        where: { repEmail: thread.recipientEmail },
      });

      if (repShadow) {
        // Compute running average
        const currentAvg = repShadow.avgResponseHours || responseHours;
        const currentTotal = repShadow.totalRequests || 1;
        const newAvg = ((currentAvg * (currentTotal - 1)) + responseHours) / currentTotal;

        await prisma.repShadowProfile.update({
          where: { id: repShadow.id },
          data: { avgResponseHours: newAvg },
        });
      }
    }

    console.log(`[Inbound] Matched reply from ${from} to thread ${match.threadId}`);
    return NextResponse.json({ received: true, matched: true, threadId: match.threadId });
  } catch (error) {
    console.error('[API] /api/email/inbound error:', error);
    // Always return 200 to Resend so they don't retry indefinitely
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

/**
 * Extract a plain email address from a "Name <email>" string or plain email.
 */
function extractEmail(raw: string | string[] | undefined): string {
  if (!raw) return '';
  const str = Array.isArray(raw) ? raw[0] : raw;
  const match = str.match(/<([^>]+)>/);
  return match ? match[1] : str.trim();
}

/**
 * Parse Resend's headers array into a key-value map.
 * Resend sends headers as [{name, value}, ...] or as a plain object.
 */
function parseHeaders(headers: Array<{ name: string; value: string }> | Record<string, string>): Record<string, string> {
  if (Array.isArray(headers)) {
    const map: Record<string, string> = {};
    for (const h of headers) {
      map[h.name.toLowerCase()] = h.value;
    }
    return map;
  }
  // Already a map — normalize keys
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    map[k.toLowerCase()] = v;
  }
  return map;
}
