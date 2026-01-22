import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * POST /api/rep-contacts/request-spec
 * Send a spec request email to a vendor rep
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    const userEmail = session?.user?.email;
    const userName = session?.user?.name;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { repContactId, productName, vendorName, sku, selectionId } = body;

    if (!repContactId) {
      return NextResponse.json(
        { error: 'repContactId is required' },
        { status: 400 }
      );
    }

    // Fetch the rep contact
    const repContact = await prisma.vendorRepContact.findFirst({
      where: {
        id: repContactId,
        userId, // Ensure user owns this contact
      },
    });

    if (!repContact) {
      return NextResponse.json(
        { error: 'Rep contact not found' },
        { status: 404 }
      );
    }

    if (!repContact.repEmail) {
      return NextResponse.json(
        { error: 'No email address for this rep' },
        { status: 400 }
      );
    }

    // Update last contacted timestamp
    await prisma.vendorRepContact.update({
      where: { id: repContactId },
      data: { lastContactedAt: new Date() },
    });

    // Log the spec request for business intelligence
    try {
      await prisma.productSearchLog.create({
        data: {
          userId,
          searchType: 'REP_SPEC_REQUEST',
          brandName: vendorName || repContact.vendorName,
          productName,
          searchQuery: sku ? `SKU: ${sku}` : productName,
          selectionId: selectionId || null,
          wasSuccessful: true, // Request was sent
          resultData: {
            repName: repContact.repName,
            repEmail: repContact.repEmail,
          },
        },
      });
    } catch (logError) {
      console.error('Failed to log spec request:', logError);
      // Don't fail the request if logging fails
    }

    // In production, this would send an actual email via SendGrid, Resend, etc.
    // For now, we'll log and return success
    const emailData = {
      to: repContact.repEmail,
      from: userEmail,
      subject: `Spec Request: ${productName || 'Product'} from ${userName}`,
      body: `
Hi ${repContact.repName},

I'm working on a design project and need complete specifications for:

Product: ${productName || 'Unknown'}
${sku ? `SKU: ${sku}` : ''}
Brand: ${vendorName || repContact.vendorName}

Could you please send me the full spec sheet including:
- Dimensions (W x D x H)
- Materials and finishes available
- Current pricing
- Lead time

Thank you!

${userName}
${userEmail}

---
Sent via Folio Design Platform
      `.trim(),
    };

    console.log('Would send email:', emailData);

    // TODO: Actually send the email when email service is configured
    // await sendEmail(emailData);

    return NextResponse.json({
      success: true,
      message: `Spec request sent to ${repContact.repName}`,
      // In dev, include email details for debugging
      ...(process.env.NODE_ENV === 'development' && { emailData }),
    });
  } catch (error) {
    console.error('Failed to request spec from rep:', error);
    return NextResponse.json(
      { error: 'Failed to send spec request' },
      { status: 500 }
    );
  }
}
