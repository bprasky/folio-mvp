export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { sendProxyEmail } from '@/lib/email/sendEmail';
import { getOrCreateProxyAddress } from '@/lib/email/proxy-address';
import { buildTextSignature, buildHtmlSignature } from '@/lib/email/build-signature';
import {
  generateQuoteRequestEmail,
  generateSampleRequestEmail,
  generateGeneralContactEmail,
  generateQuoteRequestHtml,
  generateSampleRequestHtml,
  generateGeneralContactHtml,
} from '@/lib/messaging/email-templates';
import { recordActionSignal, getDesignerOrgId } from '@/lib/intelligence/action-signals';
import type { StructuredRequestPayload } from '@/types/structured-requests';

/**
 * POST /api/email/send
 *
 * Send an email from the designer's Folio proxy address to a vendor rep.
 * Creates an EmailThread + EmailMessage + linked Conversation for inbox display.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      actionType,
      productId,
      recipientEmail,
      recipientName,
      vendorOrgId,
      payload,
      projectId,
    } = await request.json();

    if (!recipientEmail || !actionType || !productId) {
      return NextResponse.json(
        { error: 'recipientEmail, actionType, and productId are required' },
        { status: 400 },
      );
    }

    const userId = session.user.id;

    // Get user profile for signature and templates
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

    // Get or create proxy address
    const proxyAddress = await getOrCreateProxyAddress(userId);

    // Build designer profile for templates
    const profileUrl = `${process.env.NEXTAUTH_URL || 'https://folioad.com'}/monograph/${user.name.toLowerCase().replace(/\s+/g, '')}`;
    const designerProfile = {
      name: user.name,
      firmName: user.companyName || undefined,
      phone: user.phone || undefined,
      profileUrl,
    };

    // Build signature
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
    const textSig = buildTextSignature(sigProfile);
    const htmlSig = buildHtmlSignature(sigProfile);

    // Generate email content based on action type
    const typedPayload = payload as StructuredRequestPayload;
    let subject: string;
    let textBody: string;
    let htmlBody: string;

    switch (actionType) {
      case 'SAMPLE_REQUEST': {
        const template = generateSampleRequestEmail(typedPayload as any, designerProfile, recipientName);
        subject = template.subject;
        textBody = template.body + '\n\n' + textSig;
        htmlBody = generateSampleRequestHtml(typedPayload as any, designerProfile, htmlSig, recipientName);
        break;
      }
      case 'QUOTE_REQUEST': {
        const template = generateQuoteRequestEmail(typedPayload as any, designerProfile, recipientName);
        subject = template.subject;
        textBody = template.body + '\n\n' + textSig;
        htmlBody = generateQuoteRequestHtml(typedPayload as any, designerProfile, htmlSig, recipientName);
        break;
      }
      default: {
        const msg = (payload as Record<string, unknown>)?.message as string || `Regarding ${(payload as any)?.productName}`;
        const template = generateGeneralContactEmail(msg, (payload as any)?.productName || 'Product', designerProfile, recipientName);
        subject = template.subject;
        textBody = template.body + '\n\n' + textSig;
        htmlBody = generateGeneralContactHtml(msg, (payload as any)?.productName || 'Product', designerProfile, htmlSig, recipientName);
        break;
      }
    }

    // Send via Resend
    const fromLine = `${user.name} via Folio <${proxyAddress}>`;
    const sendResult = await sendProxyEmail({
      from: fromLine,
      replyTo: proxyAddress,
      to: recipientEmail,
      subject,
      text: textBody,
      html: htmlBody,
    });

    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.error || 'Failed to send email' },
        { status: 500 },
      );
    }

    const now = new Date();

    // Create a Conversation for inbox display
    const conversation = await prisma.conversation.create({
      data: {
        initiatorUserId: userId,
        subject,
        context: 'FOLIO_EMAIL',
        category: actionType === 'SAMPLE_REQUEST' || actionType === 'QUOTE_REQUEST' ? actionType : 'GENERAL',
        structuredData: payload,
        productId: productId || null,
        lastMessageAt: now,
        messages: {
          create: {
            senderUserId: userId,
            body: textBody,
          },
        },
        participants: {
          create: { userId },
        },
      },
    });

    // Create EmailThread linked to the conversation
    const emailThread = await prisma.emailThread.create({
      data: {
        userId,
        conversationId: conversation.id,
        actionType,
        productId,
        projectId: projectId || null,
        recipientEmail,
        recipientName: recipientName || null,
        vendorOrgId: vendorOrgId || null,
        status: 'SENT',
        subject,
      },
    });

    // Create outbound EmailMessage
    await prisma.emailMessage.create({
      data: {
        threadId: emailThread.id,
        direction: 'OUTBOUND',
        fromAddress: proxyAddress,
        toAddress: recipientEmail,
        subject,
        textBody,
        htmlBody,
        resendMessageId: sendResult.resendMessageId || null,
        sentAt: now,
      },
    });

    // Record action signal
    const designerOrgId = await getDesignerOrgId(userId);
    if (designerOrgId) {
      const p = payload as Record<string, unknown>;
      recordActionSignal({
        actionType,
        productId,
        designerOrgId,
        vendorOrgId: vendorOrgId || undefined,
        quantity: typeof p.quantity === 'number' ? p.quantity : undefined,
        timeline: typeof p.timeline === 'string' ? p.timeline : undefined,
        isOffPlatform: false,
      }).catch(console.error);
    }

    return NextResponse.json({
      threadId: emailThread.id,
      conversationId: conversation.id,
      sent: true,
    }, { status: 201 });
  } catch (error) {
    console.error('[API] /api/email/send error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
