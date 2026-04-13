export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { resolveVendorRep } from '@/lib/messaging/rep-resolution';
import { sendMessageNotification } from '@/lib/messaging/notifications';
import { recordActionSignal, getDesignerOrgId } from '@/lib/intelligence/action-signals';
import { assertProjectWrite } from '@/lib/authz/access';

/**
 * POST /api/projects/[id]/availability-check
 * Send batch availability check requests grouped by vendor.
 *
 * Body: {
 *   products: Array<{ productId, productName, vendorName }>,
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
    await assertProjectWrite(userId, projectId);

    const { products } = await request.json();

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'products array is required' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { title: true, projectType: true, city: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

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
      const firstProduct = vendorProducts[0];
      const resolution = await resolveVendorRep(userId, firstProduct.productId);

      const productLines = vendorProducts
        .map((p: { productName: string }) => `- ${p.productName}`)
        .join('\n');

      const body = `Availability check for ${vendorProducts.length} product${vendorProducts.length > 1 ? 's' : ''} for ${project.title}:\n\n${productLines}\n\nPlease confirm current availability: In Stock / Made to Order / Backordered / Discontinued.`;

      if (resolution.status === 'DIRECT_REP' && resolution.rep) {
        const conversation = await prisma.conversation.create({
          data: {
            initiatorUserId: userId,
            recipientUserId: resolution.rep.userId,
            ...(resolution.vendorOrgId ? { recipientOrgId: resolution.vendorOrgId } : {}),
            subject: `Availability Check \u2013 ${vendorProducts.length} products for ${project.title}`,
            context: 'VENDOR_OUTREACH',
            category: 'GENERAL',
            structuredData: {
              type: 'AVAILABILITY_CHECK',
              projectId,
              projectName: project.title,
              vendorName,
              products: vendorProducts,
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

        const messageId = conversation.messages[0]?.id;
        if (messageId) {
          sendMessageNotification(conversation.id, messageId).catch(console.error);
        }

        results.push({ vendorName, status: 'sent', conversationId: conversation.id });
      } else {
        results.push({ vendorName, status: 'no_rep' });
      }

      if (designerOrgId) {
        for (const p of vendorProducts) {
          recordActionSignal({
            actionType: 'AVAILABILITY_CHECK',
            productId: p.productId,
            designerOrgId,
            vendorOrgId: resolution.vendorOrgId,
            projectId,
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
    console.error('[API] availability-check POST error:', error);
    return NextResponse.json({ error: 'Failed to send availability check' }, { status: 500 });
  }
}
