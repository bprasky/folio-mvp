/**
 * Vendor Notification for Boost Opportunities
 *
 * Notifies vendors when a designer mentions them positively in an interview.
 * Sends both email and in-app notifications.
 */

import { prisma } from '@/lib/prisma';
import type { BoostOpportunity } from '@prisma/client';
import { canVendorBoost } from './createOpportunity';

interface NotifyVendorParams {
  opportunityId: string;
}

/**
 * Notify a vendor about a boost opportunity
 */
export async function notifyVendorOfBoostOpportunity(
  params: NotifyVendorParams
): Promise<void> {
  const { opportunityId } = params;

  const opportunity = await prisma.boostOpportunity.findUnique({
    where: { id: opportunityId },
    include: {
      vendor: {
        include: {
          vendorSubscription: {
            select: { tier: true, status: true },
          },
        },
      },
      designer: {
        select: {
          id: true,
          name: true,
          profileImage: true,
        },
      },
      project: {
        include: {
          images: {
            where: { displayOrder: 0 },
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  });

  if (!opportunity) {
    console.warn(`[notifyVendor] Opportunity not found: ${opportunityId}`);
    return;
  }

  // Get vendor admins/owners to notify
  const vendorUsers = await prisma.organizationUser.findMany({
    where: {
      organizationId: opportunity.vendorId,
      role: { in: ['OWNER', 'ADMIN'] },
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (vendorUsers.length === 0) {
    console.warn(`[notifyVendor] No active admins/owners for vendor: ${opportunity.vendorId}`);
    return;
  }

  const projectImage = opportunity.project.images[0]?.url;
  const previewQuote = opportunity.suggestedPullQuote || truncate(opportunity.fullAnswer, 150);
  const viewUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/vendor/boosts/${opportunity.id}`;
  const vendorCanBoost = canVendorBoost(opportunity.vendor);

  // Send email to each admin/owner
  for (const orgUser of vendorUsers) {
    await sendBoostOpportunityEmail({
      to: orgUser.user.email,
      vendorName: opportunity.vendor.name,
      designerName: opportunity.designer.name || 'A designer',
      projectName: opportunity.project.title || 'Untitled Project',
      projectImage,
      previewQuote,
      viewUrl,
      expiresAt: opportunity.expiresAt,
      canBoost: vendorCanBoost,
    });

    // Create in-app notification
    await prisma.notification.create({
      data: {
        userId: orgUser.user.id,
        type: 'BOOST_OPPORTUNITY',
        title: `${opportunity.designer.name || 'A designer'} mentioned ${opportunity.vendor.name}`,
        body: 'A designer mentioned your brand in their project interview. View the testimonial opportunity.',
        actionUrl: `/vendor/boosts/${opportunity.id}`,
        metadata: {
          opportunityId: opportunity.id,
          projectId: opportunity.projectId,
        },
      },
    });
  }

  // Update opportunity status
  await prisma.boostOpportunity.update({
    where: { id: opportunityId },
    data: {
      status: 'NOTIFIED',
      notifiedAt: new Date(),
    },
  });
}

/**
 * Notify designer when their testimonial is boosted
 */
export async function notifyDesignerOfBoost(
  opportunityId: string,
  boostId: string
): Promise<void> {
  const opportunity = await prisma.boostOpportunity.findUnique({
    where: { id: opportunityId },
    include: {
      vendor: true,
      designer: true,
      project: true,
    },
  });

  if (!opportunity) {
    console.warn(`[notifyDesignerOfBoost] Opportunity not found: ${opportunityId}`);
    return;
  }

  // Create in-app notification for designer
  await prisma.notification.create({
    data: {
      userId: opportunity.designerId,
      type: 'TESTIMONIAL_BOOSTED',
      title: `${opportunity.vendor.name} boosted your testimonial`,
      body: `Your quote about ${opportunity.vendor.name} will be featured in the project editorial.`,
      actionUrl: `/designer/projects/${opportunity.projectId}`,
      metadata: {
        opportunityId,
        boostId,
        vendorId: opportunity.vendorId,
      },
    },
  });

  // TODO: Send email notification as well
}

interface SendBoostEmailParams {
  to: string;
  vendorName: string;
  designerName: string;
  projectName: string;
  projectImage?: string;
  previewQuote: string;
  viewUrl: string;
  expiresAt: Date;
  canBoost: boolean;
}

/**
 * Send boost opportunity email
 */
async function sendBoostOpportunityEmail(params: SendBoostEmailParams): Promise<void> {
  const {
    to,
    vendorName,
    designerName,
    projectName,
    projectImage,
    previewQuote,
    viewUrl,
    expiresAt,
    canBoost,
  } = params;

  const subject = `${designerName} mentioned your brand in a project interview`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 0;">

      <div style="padding: 32px 24px; background: #ffffff;">
        <h1 style="font-size: 24px; font-weight: 500; color: #1c1917; margin: 0 0 24px 0;">
          You were mentioned
        </h1>

        <p style="color: #57534e; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
          <strong>${designerName}</strong> mentioned <strong>${vendorName}</strong>
          while discussing their project <em>${projectName}</em>.
        </p>

        ${projectImage ? `
          <img
            src="${projectImage}"
            alt="${projectName}"
            style="width: 100%; border-radius: 8px; margin: 0 0 24px 0;"
          />
        ` : ''}

        <div style="background: #fafaf9; border-left: 4px solid #d6d3d1; padding: 16px 20px; margin: 0 0 24px 0;">
          <p style="color: #44403c; font-size: 16px; line-height: 1.6; margin: 0 0 12px 0; font-style: italic;">
            "${previewQuote}"
          </p>
          <p style="color: #78716c; font-size: 14px; margin: 0;">
            — ${designerName}
          </p>
        </div>

        ${canBoost ? `
          <p style="color: #57534e; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            <strong>Boost this testimonial</strong> to feature it prominently in the
            project editorial and on your Folio vendor page.
          </p>

          <a
            href="${viewUrl}"
            style="display: inline-block; background: #1c1917; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 0 0 24px 0;"
          >
            View &amp; Boost
          </a>
        ` : `
          <p style="color: #57534e; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            Upgrade to a paid plan to boost testimonials and feature them on your
            vendor page.
          </p>

          <a
            href="${viewUrl}"
            style="display: inline-block; background: #1c1917; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 0 0 24px 0;"
          >
            View Testimonial
          </a>
        `}

        <p style="color: #a8a29e; font-size: 14px; margin: 32px 0 0 0; padding-top: 24px; border-top: 1px solid #e7e5e4;">
          This opportunity expires ${formatDate(expiresAt)}.
        </p>
      </div>

    </body>
    </html>
  `;

  const text = `
You were mentioned

${designerName} mentioned ${vendorName} while discussing their project "${projectName}".

"${previewQuote}"
— ${designerName}

${canBoost
  ? 'Boost this testimonial to feature it prominently in the project editorial and on your Folio vendor page.'
  : 'Upgrade to a paid plan to boost testimonials and feature them on your vendor page.'
}

View the opportunity: ${viewUrl}

This opportunity expires ${formatDate(expiresAt)}.
  `.trim();

  // TODO: Integrate with email service (SendGrid, Resend, etc.)
  // For now, log the email
  console.log(`[EMAIL] Would send to ${to}:`, {
    subject,
    viewUrl,
  });

  // In production, use your email service:
  // await emailClient.send({ to, subject, html, text });
}

/**
 * Truncate text to a maximum length
 */
function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.substring(0, length).trim() + '...';
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Process pending boost opportunities (called by cron job)
 */
export async function processPendingOpportunities(): Promise<{ notified: number; expired: number }> {
  // Notify pending opportunities (at least 5 minutes old)
  const pendingOpportunities = await prisma.boostOpportunity.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
    },
    take: 50,
  });

  let notified = 0;
  for (const opportunity of pendingOpportunities) {
    try {
      await notifyVendorOfBoostOpportunity({ opportunityId: opportunity.id });
      notified++;
    } catch (error) {
      console.error(`[processPendingOpportunities] Failed to notify for ${opportunity.id}:`, error);
    }
  }

  // Expire old opportunities
  const expireResult = await prisma.boostOpportunity.updateMany({
    where: {
      status: { in: ['PENDING', 'NOTIFIED', 'VIEWED'] },
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  return {
    notified,
    expired: expireResult.count,
  };
}
