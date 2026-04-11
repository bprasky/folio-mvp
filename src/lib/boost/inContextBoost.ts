import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/sendEmail';

/**
 * Creates an InContextBoost opportunity when a designer tags a product.
 * This is the entry point for the vendor boost flywheel:
 *
 * 1. Vendor account exists → create boost, notify admin + sales rep
 * 2. No vendor account, rep email exists → create boost, invite rep
 * 3. No vendor, no rep → return prompt for designer to add rep email
 *
 * Returns the created boost or a prompt object for the designer.
 */
export async function createInContextBoostOpportunity(params: {
  productTagId: string;
  productId: string;
  designerId: string;
  projectId: string;
  repEmail?: string | null;
  repName?: string | null;
}): Promise<{ boostId?: string; prompt?: string; status: string }> {
  const { productTagId, productId, designerId, projectId, repEmail, repName } = params;

  // Check if boost already exists for this tag
  const existing = await prisma.inContextBoost.findUnique({
    where: { productTagId },
  });
  if (existing) {
    return { boostId: existing.id, status: existing.status };
  }

  // Find the published post for this project (if any)
  const post = await prisma.projectPost.findUnique({
    where: { projectId },
    select: { id: true, status: true },
  });
  const projectPostId = post?.status === 'PUBLISHED' ? post.id : null;

  // Look up product vendor info
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      vendorId: true,
      brand: true,
      name: true,
    },
  });

  if (!product) {
    return { status: 'PRODUCT_NOT_FOUND' };
  }

  // Determine vendor path
  let vendorUserId: string | null = null;
  let vendorOrgId: string | null = null;
  let resolvedRepEmail = repEmail || null;
  let resolvedRepName = repName || null;

  if (product.vendorId) {
    // Path 1: Vendor account exists
    vendorUserId = product.vendorId;

    // Look up vendor's organization
    const orgMembership = await prisma.organizationUser.findFirst({
      where: { userId: product.vendorId },
      select: { organizationId: true },
    });
    vendorOrgId = orgMembership?.organizationId || null;
  } else if (!resolvedRepEmail) {
    // Path 3: No vendor, no rep email — check if designer has a rep contact for this brand
    if (product.brand) {
      const repContact = await prisma.vendorRepContact.findFirst({
        where: {
          userId: designerId,
          vendorName: { equals: product.brand, mode: 'insensitive' },
          isActive: true,
        },
        select: { repEmail: true, repName: true },
      }).catch(() => null);

      if (repContact?.repEmail) {
        resolvedRepEmail = repContact.repEmail;
        resolvedRepName = repContact.repName || null;
      } else {
        // No rep email available — return prompt for designer
        return {
          status: 'NEEDS_REP_EMAIL',
          prompt: `Add your ${product.brand || 'vendor'} rep's email to get this featured and earn boost revenue.`,
        };
      }
    } else {
      return {
        status: 'NEEDS_REP_EMAIL',
        prompt: 'Add your vendor rep\'s email to get this featured and earn boost revenue.',
      };
    }
  }

  // Create the boost opportunity
  const boost = await prisma.inContextBoost.create({
    data: {
      productTagId,
      productId,
      projectPostId,
      designerId,
      vendorId: vendorOrgId,
      vendorUserId,
      repEmail: resolvedRepEmail,
      repName: resolvedRepName,
      status: 'PENDING_REVIEW',
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    },
  });

  // Send notifications (fire-and-forget)
  notifyVendorOfBoostOpportunity({
    boostId: boost.id,
    productId,
    productName: product.name,
    vendorUserId,
    vendorOrgId,
    repEmail: resolvedRepEmail,
    designerId,
  }).catch((err) => {
    console.error('[InContextBoost] Failed to notify vendor:', err);
  });

  return { boostId: boost.id, status: 'PENDING_REVIEW' };
}

/**
 * Notify vendor admin + sales rep (or invite rep) about boost opportunity.
 */
async function notifyVendorOfBoostOpportunity(params: {
  boostId: string;
  productId: string;
  productName: string;
  vendorUserId: string | null;
  vendorOrgId: string | null;
  repEmail: string | null;
  designerId: string;
}) {
  const { boostId, productName, vendorUserId, vendorOrgId, repEmail, designerId } = params;

  const designer = await prisma.user.findUnique({
    where: { id: designerId },
    select: { name: true },
  });
  const designerName = designer?.name || 'A designer';

  if (vendorOrgId) {
    // Path 1: Vendor org exists — notify all admin/owner members
    const orgAdmins = await prisma.organizationUser.findMany({
      where: {
        organizationId: vendorOrgId,
        role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
      },
      select: { userId: true },
    });

    for (const admin of orgAdmins) {
      await prisma.notification.create({
        data: {
          userId: admin.userId,
          type: 'IN_CONTEXT_BOOST_OPPORTUNITY',
          title: `${designerName} featured your product`,
          body: `"${productName}" was tagged in a published project. Review the tag and boost to feature it on your product page.`,
          actionUrl: `/vendor/boosts/in-context`,
          metadata: { boostId, productName, designerName },
        },
      });

      // Also send email
      const adminUser = await prisma.user.findUnique({
        where: { id: admin.userId },
        select: { email: true },
      });
      if (adminUser?.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://folioad.com';
        sendEmail({
          to: adminUser.email,
          subject: `${designerName} featured "${productName}" — review & boost`,
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 20px;">
              <div style="font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #c9a96e; margin-bottom: 16px;">
                FOLIO — IN CONTEXT BOOST
              </div>
              <h1 style="font-size: 22px; font-weight: 400; color: #1a1a1a; margin: 0 0 12px;">
                ${designerName} featured your product
              </h1>
              <p style="font-size: 14px; line-height: 1.6; color: #666;">
                <strong>"${productName}"</strong> was tagged in a published project. Review the tag for accuracy
                and boost to feature it on your product page.
              </p>
              <p style="font-size: 13px; line-height: 1.6; color: #999;">
                Boosting gives you photo usage rights, product-specific designer insights,
                and placement on your product page's In Context section. Designers earn revenue
                per engagement.
              </p>
              <div style="margin: 24px 0;">
                <a href="${appUrl}/vendor/boosts/in-context" style="display: inline-block; padding: 12px 24px; background: #3a2a1a; color: #f5efe8; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
                  Review boost opportunity →
                </a>
              </div>
            </div>
          `,
        }).catch(() => {});
      }
    }

    // Also notify the specific vendor user if different from org admins
    if (vendorUserId) {
      const alreadyNotified = orgAdmins.some(a => a.userId === vendorUserId);
      if (!alreadyNotified) {
        await prisma.notification.create({
          data: {
            userId: vendorUserId,
            type: 'IN_CONTEXT_BOOST_OPPORTUNITY',
            title: `${designerName} featured your product`,
            body: `"${productName}" was tagged in a published project. Review and boost to feature on your product page.`,
            actionUrl: `/vendor/boosts`,
            metadata: { boostId, productName, designerName },
          },
        });
      }
    }
  } else if (repEmail) {
    // Path 2: No vendor account, but rep email — create invite signal
    await prisma.vendorInviteSignal.create({
      data: {
        vendorName: productName, // Best we have
        signalType: 'IN_CONTEXT_BOOST_INVITE',
        metadata: {
          boostId,
          repEmail,
          designerName,
          productName,
          message: 'A designer tagged your product in a published project. Create a Folio account to review and boost.',
        },
      },
    });

    // Send invite email to rep
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://folioad.com';
    await sendEmail({
      to: repEmail,
      subject: `${designerName} featured your product on Folio`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 20px;">
          <div style="font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #c9a96e; margin-bottom: 16px;">
            FOLIO — IN CONTEXT
          </div>
          <h1 style="font-size: 22px; font-weight: 400; color: #1a1a1a; margin: 0 0 12px;">
            A designer featured your product
          </h1>
          <p style="font-size: 14px; line-height: 1.6; color: #666;">
            <strong>${designerName}</strong> tagged <strong>"${productName}"</strong> in a published project on Folio.
            Review the tag for accuracy and boost it to feature on your product page — giving the designer proper credit
            and generating product-specific content.
          </p>
          <div style="margin: 24px 0;">
            <a href="${appUrl}/vendor/welcome" style="display: inline-block; padding: 12px 24px; background: #3a2a1a; color: #f5efe8; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
              Create your Folio account →
            </a>
          </div>
          <p style="font-size: 12px; color: #999; margin-top: 24px;">
            Folio connects interior designers with the products they specify.
            Boost opportunities give you photo usage rights and product-specific designer insights.
          </p>
        </div>
      `,
    }).catch((err) => {
      console.error('[InContextBoost] Failed to send rep invite email:', err);
    });
  }

  // Update boost status to NOTIFIED
  await prisma.inContextBoost.update({
    where: { id: boostId },
    data: { status: 'NOTIFIED', notifiedAt: new Date() },
  });
}

/**
 * When a vendor approves a boost, create a follow-up Q&A request for the designer.
 */
export async function approveInContextBoost(params: {
  boostId: string;
  reviewerId: string;
  followUpQuestion?: string;
}) {
  const { boostId, reviewerId, followUpQuestion } = params;

  const boost = await prisma.inContextBoost.update({
    where: { id: boostId },
    data: {
      status: 'APPROVED',
      accuracyConfirmed: true,
      reviewedAt: new Date(),
      photoRightsGranted: true,
      photoUsageScope: 'product_page',
      followUpQuestion: followUpQuestion || 'What made you choose this product for this project?',
      followUpRequestedAt: followUpQuestion ? new Date() : null,
    },
    include: {
      product: { select: { name: true } },
      designer: { select: { id: true, name: true } },
    },
  });

  // Notify designer of boost + follow-up Q&A request
  await prisma.notification.create({
    data: {
      userId: boost.designerId,
      type: 'IN_CONTEXT_BOOST_APPROVED',
      title: `Your product tag was boosted!`,
      body: `A vendor boosted "${boost.product.name}" from your project. ${followUpQuestion ? 'They\'d love to hear more — answer a quick follow-up question.' : ''}`,
      actionUrl: `/dashboard/boosts/${boostId}`,
      metadata: {
        boostId,
        productName: boost.product.name,
        followUpQuestion: boost.followUpQuestion,
      },
    },
  });

  return boost;
}

/**
 * Designer answers the follow-up question on an approved boost.
 */
export async function answerInContextFollowUp(params: {
  boostId: string;
  designerId: string;
  answer: string;
}) {
  const { boostId, designerId, answer } = params;

  const boost = await prisma.inContextBoost.findUnique({
    where: { id: boostId },
    select: { designerId: true, status: true, productTagId: true, projectPostId: true },
  });

  if (!boost || boost.designerId !== designerId) {
    throw new Error('Not authorized');
  }
  if (boost.status !== 'APPROVED') {
    throw new Error('Boost not in approved state');
  }

  // Save answer on the boost
  const updated = await prisma.inContextBoost.update({
    where: { id: boostId },
    data: {
      followUpAnswer: answer,
      followUpAnsweredAt: new Date(),
    },
  });

  // Also create a SupplementalQuote linked to the product tag for article display
  if (boost.projectPostId && boost.productTagId) {
    await prisma.supplementalQuote.create({
      data: {
        projectPostId: boost.projectPostId,
        productTagId: boost.productTagId,
        userId: designerId,
        contributorRole: 'Designer',
        question: updated.followUpQuestion || 'What made you choose this product?',
        answer,
        source: 'in_context_boost',
        pinned: false,
        displayLocation: 'near_product',
      },
    });
  }

  return updated;
}
