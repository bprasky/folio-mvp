export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { sendProxyEmail } from '@/lib/email/sendEmail';
import { getOrCreateProxyAddress } from '@/lib/email/proxy-address';
import { buildTextSignature, buildHtmlSignature } from '@/lib/email/build-signature';

/**
 * POST /api/email/threads/[threadId]/reply
 *
 * Send a follow-up reply in an existing email thread.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { threadId: string } | Promise<{ threadId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { threadId } = resolvedParams;
    const { message } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const userId = session.user.id;

    // Verify thread ownership
    const thread = await prisma.emailThread.findUnique({
      where: { id: threadId },
      select: {
        userId: true,
        recipientEmail: true,
        recipientName: true,
        subject: true,
        conversationId: true,
      },
    });

    if (!thread || thread.userId !== userId) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        companyName: true,
        phone: true,
        signatureIncludeFirm: true,
        signatureIncludePhone: true,
        signatureIncludeProfile: true,
        signatureIncludeEmail: true,
      },
    });

    const proxyAddress = await getOrCreateProxyAddress(userId);
    const profileUrl = `${process.env.NEXTAUTH_URL || 'https://folioad.com'}/monograph/${user.name.toLowerCase().replace(/\s+/g, '')}`;

    const sigProfile = {
      name: user.name,
      companyName: user.companyName,
      phone: user.phone,
      email: user.email,
      profileUrl,
      signatureIncludeFirm: user.signatureIncludeFirm,
      signatureIncludePhone: user.signatureIncludePhone,
      signatureIncludeProfile: user.signatureIncludeProfile,
      signatureIncludeEmail: user.signatureIncludeEmail,
    };

    const textBody = message.trim() + '\n\n' + buildTextSignature(sigProfile);
    const htmlBody = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#2C2825">
<p>${escapeHtml(message.trim()).replace(/\n/g, '<br>')}</p>
${buildHtmlSignature(sigProfile)}
</div>`;

    // Get the last outbound message ID for threading headers
    const lastOutbound = await prisma.emailMessage.findFirst({
      where: { threadId, direction: 'OUTBOUND' },
      orderBy: { sentAt: 'desc' },
      select: { resendMessageId: true },
    });

    const subject = thread.subject.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`;
    const fromLine = `${user.name} via Folio <${proxyAddress}>`;

    const sendResult = await sendProxyEmail({
      from: fromLine,
      replyTo: proxyAddress,
      to: thread.recipientEmail,
      subject,
      text: textBody,
      html: htmlBody,
    });

    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error || 'Failed to send' }, { status: 500 });
    }

    const now = new Date();

    // Store outbound message
    await prisma.emailMessage.create({
      data: {
        threadId,
        direction: 'OUTBOUND',
        fromAddress: proxyAddress,
        toAddress: thread.recipientEmail,
        subject,
        textBody,
        htmlBody,
        resendMessageId: sendResult.resendMessageId || null,
        sentAt: now,
      },
    });

    // Update thread
    await prisma.emailThread.update({
      where: { id: threadId },
      data: { updatedAt: now },
    });

    // Add to linked conversation for inbox display
    if (thread.conversationId) {
      await prisma.conversation.update({
        where: { id: thread.conversationId },
        data: {
          lastMessageAt: now,
          messages: {
            create: {
              senderUserId: userId,
              body: message.trim(),
            },
          },
        },
      });
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error('[API] /api/email/threads/reply error:', error);
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
