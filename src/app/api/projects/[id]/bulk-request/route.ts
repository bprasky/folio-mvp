export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { resolveVendorRep } from '@/lib/messaging/rep-resolution';
import { sendMessageNotification } from '@/lib/messaging/notifications';
import { recordActionSignal, getDesignerOrgId } from '@/lib/intelligence/action-signals';

/**
 * POST /api/projects/[id]/bulk-request
 * Send bulk pricing requests grouped by vendor.
 *
 * Body: {
 *   products: Array<{ productId, productName, vendorName, quantity, unit? }>,
 *   timeline: string,
 *   designerNote?: string,
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const projectId = params.id;
    const { products, timeline, designerNote } = await request.json();

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'products array is required' }, { status: 400 });
    }

    // Get project info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { title: true, projectType: true, city: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Group products by vendor
    const byVendor = new Map<string, typeof products>();
    for (const product of products) {
      const vendor = product.vendorName || 'Unknown';
      if (!byVendor.has(vendor)) byVendor.set(vendor, []);
      byVendor.get(vendor)!.push(product);
    }

    const results: Array<{ vendorName: string; status: string; conversationId?: string }> = [];
    const designerOrgId = await getDesignerOrgId(userId);

    const vendorEntries = Array.from(byVendor.entries());
    for (const [vendorName, vendorProducts] of vendorEntries) {
      // Try to resolve rep for the first product in this vendor group
      const firstProduct = vendorProducts[0];
      const resolution = await resolveVendorRep(userId, firstProduct.productId);

      const productLines = vendorProducts
        .map((p: { productName: string; quantity: number; unit?: string }) =>
          `- ${p.productName} (Qty: ${p.quantity}${p.unit ? ' ' + p.unit : ''})`
        )
        .join('\n');

      const body = `Quote request for ${vendorProducts.length} product${vendorProducts.length > 1 ? 's' : ''} for ${project.title}:\n\n${productLines}\n\nTimeline: ${timeline || 'Flexible'}${designerNote ? `\n\nNote: ${designerNote}` : ''}\n\nPlease provide trade pricing.`;

      // Create BulkPricingRequest record
      const bulkRequest = await prisma.bulkPricingRequest.create({
        data: {
          projectId,
          vendorOrgId: resolution.vendorOrgId || null,
          vendorName,
          repId: resolution.rep?.userId || null,
          repName: resolution.rep?.name || null,
          productIds: vendorProducts.map((p: { productId: string }) => p.productId),
          timeline: timeline || null,
          designerNote: designerNote || null,
          status: 'SENT',
        },
      });

      // Mark products as REQUESTED
      for (const p of vendorProducts) {
        await prisma.projectProductPricing.upsert({
          where: {
            projectId_productId_roomId: {
              projectId,
              productId: p.productId,
              roomId: null,
            },
          },
          create: {
            projectId,
            productId: p.productId,
            quantity: p.quantity || 1,
            unit: p.unit || null,
            status: 'REQUESTED',
            quoteSource: 'FOLIO_MESSAGE',
          },
          update: {
            status: 'REQUESTED',
            quantity: p.quantity || 1,
          },
        });
      }

      if (resolution.status === 'DIRECT_REP' && resolution.rep) {
        // Send conversation
        const conversation = await prisma.conversation.create({
          data: {
            initiatorUserId: userId,
            recipientUserId: resolution.rep.userId,
            ...(resolution.vendorOrgId ? { recipientOrgId: resolution.vendorOrgId } : {}),
            subject: `Quote Request – ${vendorProducts.length} products for ${project.title}`,
            context: 'VENDOR_OUTREACH',
            category: 'QUOTE_REQUEST',
            structuredData: {
              type: 'BULK_QUOTE_REQUEST',
              projectId,
              projectName: project.title,
              vendorName,
              products: vendorProducts,
              timeline,
            },
            lastMessageAt: new Date(),
            messages: { create: { senderUserId: userId, body } },
            participants: { create: { userId } },
          },
          include: { messages: true },
        });

        await prisma.conversationParticipant.create({
          data: {
            conversationId: conversation.id,
            userId: resolution.rep.userId,
            ...(resolution.vendorOrgId ? { orgId: resolution.vendorOrgId } : {}),
            unreadCount: 1,
          },
        }).catch(() => {});

        await prisma.bulkPricingRequest.update({
          where: { id: bulkRequest.id },
          data: { conversationId: conversation.id },
        });

        const messageId = conversation.messages[0]?.id;
        if (messageId) {
          sendMessageNotification(conversation.id, messageId).catch(console.error);
        }

        results.push({ vendorName, status: 'sent', conversationId: conversation.id });
      } else {
        results.push({ vendorName, status: 'no_rep' });
      }

      // Record intelligence signal for each product
      if (designerOrgId) {
        for (const p of vendorProducts) {
          recordActionSignal({
            actionType: 'BULK_QUOTE_REQUEST',
            productId: p.productId,
            designerOrgId,
            vendorOrgId: resolution.vendorOrgId,
            projectId,
            quantity: p.quantity,
            unit: p.unit,
            timeline,
            projectType: project.projectType,
            location: project.city || undefined,
            isBulk: true,
          }).catch(console.error);
        }
      }
    }

    return NextResponse.json({
      sent: results.filter(r => r.status === 'sent').length,
      noRep: results.filter(r => r.status === 'no_rep').length,
      total: results.length,
      results,
    });
  } catch (error) {
    console.error('[API] bulk-request POST error:', error);
    return NextResponse.json({ error: 'Failed to send bulk request' }, { status: 500 });
  }
}
