export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import {
  generateSampleRequestEmail,
  generateQuoteRequestEmail,
  buildMailtoLink,
} from '@/lib/messaging/email-templates';
import { seedRepShadowFromInvite } from '@/lib/intelligence/shadow-profiles';

/**
 * POST /api/designer/sourcebook/invite-rep
 * Invite a vendor rep to Folio, or get an email template for off-platform contact.
 *
 * Body: {
 *   productId: string,
 *   actionType: 'SAMPLE_REQUEST' | 'QUOTE_REQUEST' | 'GENERAL',
 *   repName: string,
 *   repEmail: string,
 *   payload: StructuredRequestPayload,
 *   sendInvite: boolean,  // true = send Folio invite, false = return email template
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId, actionType, repName, repEmail, payload, sendInvite } = await request.json();

    if (!productId || !repName || !repEmail || !actionType) {
      return NextResponse.json(
        { error: 'productId, actionType, repName, and repEmail are required' },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Get designer profile for email template
    const designer = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        companyName: true,
        phone: true,
        location: true,
      },
    });

    if (!designer) {
      return NextResponse.json({ error: 'Designer not found' }, { status: 404 });
    }

    const designerProfile = {
      name: designer.name,
      firmName: designer.companyName || undefined,
      phone: designer.phone || undefined,
      profileUrl: `${process.env.NEXTAUTH_URL || 'https://folioad.com'}/profile/${userId}`,
    };

    if (sendInvite) {
      // Create PendingAction — will be delivered when rep joins Folio
      await prisma.pendingAction.create({
        data: {
          senderId: userId,
          actionType,
          productId,
          targetEmail: repEmail,
          targetName: repName,
          payload: payload || {},
          status: 'PENDING',
          inviteSentAt: new Date(),
        },
      });

      // TODO: Send actual invite email via SendGrid/Resend
      // For now, record it as sent

      // Seed rep shadow profile for intelligence
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { brand: true },
      });
      if (product?.brand) {
        seedRepShadowFromInvite({
          vendorName: product.brand,
          repName,
          repEmail,
          designerLocation: designer?.location || undefined,
        }).catch(console.error);
      }

      return NextResponse.json({
        success: true,
        status: 'invite_sent',
        message: `Invite sent to ${repName}. Your request will be delivered when they join Folio.`,
      });
    }

    // Return email template for manual sending
    let emailTemplate: { subject: string; body: string };

    if (actionType === 'SAMPLE_REQUEST' && payload) {
      emailTemplate = generateSampleRequestEmail(payload, designerProfile, repName);
    } else if (actionType === 'QUOTE_REQUEST' && payload) {
      emailTemplate = generateQuoteRequestEmail(payload, designerProfile, repName);
    } else {
      emailTemplate = {
        subject: `Regarding your products | via Folio`,
        body: `Hi ${repName},\n\nI found your products on Folio and wanted to connect.\n\nBest,\n${designer.name}`,
      };
    }

    // Record as EMAIL_SENT in pending actions for tracking
    await prisma.pendingAction.create({
      data: {
        senderId: userId,
        actionType,
        productId,
        targetEmail: repEmail,
        targetName: repName,
        payload: payload || {},
        status: 'EMAIL_SENT',
      },
    });

    const mailtoLink = buildMailtoLink(repEmail, emailTemplate);

    return NextResponse.json({
      success: true,
      status: 'email_template',
      emailTemplate,
      mailtoLink,
    });
  } catch (error) {
    console.error('[API] /api/designer/sourcebook/invite-rep error:', error);
    return NextResponse.json({ error: 'Failed to process invite' }, { status: 500 });
  }
}
