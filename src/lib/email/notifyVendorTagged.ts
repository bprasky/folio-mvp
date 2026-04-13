/**
 * Vendor Notification: "You were tagged"
 *
 * Notifies vendors when a designer publishes a project with their products tagged.
 * This is a critical vendor acquisition trigger.
 */

import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/sendEmail';

// Kill-switch for the "you were tagged" vendor email. When unset or false we
// keep the legacy log-only behavior so a prod deploy with RESEND_API_KEY set
// does NOT start blasting vendors the moment this file ships. Flip to "true"
// in the target environment (via VENDOR_TAGGED_EMAILS_ENABLED) once the
// template, volume, and vendor ecosystem are ready.
const VENDOR_TAGGED_EMAILS_ENABLED =
  (process.env.VENDOR_TAGGED_EMAILS_ENABLED ?? '').toLowerCase() === 'true';

interface VendorNotificationData {
  vendorId: string;
  vendorEmail: string;
  vendorName: string;
  designerName: string;
  designerProfileImage: string | null;
  projectId: string;
  projectTitle: string;
  projectImage: string | null;
  productName: string;
  productId: string;
  followerCount: number;
  isExistingVendor: boolean;
}

interface NotifyTaggedVendorsParams {
  projectId: string;
}

interface NotifyTaggedVendorsResult {
  notified: number;
  skipped: number;
  errors: number;
}

/**
 * Notify vendors when a designer publishes a project with their products tagged.
 * Rate limited: max 1 email per vendor per 24 hours.
 */
export async function notifyTaggedVendors(
  params: NotifyTaggedVendorsParams
): Promise<NotifyTaggedVendorsResult> {
  const { projectId } = params;

  // Get project with designer info
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      designer: {
        select: {
          id: true,
          name: true,
          profileImage: true,
        },
      },
      images: {
        take: 1,
        orderBy: { displayOrder: 'asc' },
        select: { url: true },
      },
    },
  });

  if (!project || !project.designer) {
    console.warn(`[notifyTaggedVendors] Project or designer not found: ${projectId}`);
    return { notified: 0, skipped: 0, errors: 0 };
  }

  // Get follower count for the designer
  const followerCount = await prisma.follow.count({
    where: { followingId: project.designer.id },
  });

  // Get all unique vendors from product tags in this project
  const productTags = await prisma.productTag.findMany({
    where: {
      image: { projectId },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          vendorId: true,
          vendor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  // Group tags by vendor
  const vendorProducts = new Map<string, { vendorId: string; vendorName: string; vendorEmail: string | null; products: { id: string; name: string }[] }>();

  for (const tag of productTags) {
    const vendor = tag.product.vendor;
    if (!vendor) continue;

    if (!vendorProducts.has(vendor.id)) {
      vendorProducts.set(vendor.id, {
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorEmail: vendor.email,
        products: [],
      });
    }

    const entry = vendorProducts.get(vendor.id)!;
    if (!entry.products.find(p => p.id === tag.product.id)) {
      entry.products.push({ id: tag.product.id, name: tag.product.name });
    }
  }

  let notified = 0;
  let skipped = 0;
  let errors = 0;

  // Check rate limit and send notifications
  for (const [vendorId, vendorData] of vendorProducts) {
    try {
      // Check rate limit: no email to same vendor within 24 hours
      const recentNotification = await prisma.notification.findFirst({
        where: {
          type: 'PRODUCT_TAGGED',
          metadata: {
            path: ['vendorId'],
            equals: vendorId,
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      if (recentNotification) {
        console.log(`[notifyTaggedVendors] Rate limited for vendor ${vendorId}`);
        skipped++;
        continue;
      }

      // Check if vendor has an account on Folio
      const vendorOrg = await prisma.organization.findUnique({
        where: { id: vendorId },
        include: {
          users: {
            where: { role: { in: ['OWNER', 'ADMIN'] }, isActive: true },
            include: {
              user: { select: { id: true, email: true, name: true } },
            },
          },
        },
      });

      const isExistingVendor = vendorOrg?.users && vendorOrg.users.length > 0;
      const primaryProduct = vendorData.products[0];

      // Send email to vendor contacts or use fallback email
      const emailRecipients = isExistingVendor
        ? vendorOrg!.users.map(u => u.user.email)
        : vendorData.vendorEmail
        ? [vendorData.vendorEmail]
        : [];

      if (emailRecipients.length === 0) {
        console.log(`[notifyTaggedVendors] No email for vendor ${vendorId}`);
        skipped++;
        continue;
      }

      for (const email of emailRecipients) {
        await sendTaggedNotificationEmail({
          vendorId,
          vendorEmail: email,
          vendorName: vendorData.vendorName,
          designerName: project.designer.name || 'A designer',
          designerProfileImage: project.designer.profileImage,
          projectId: project.id,
          projectTitle: project.title || 'Untitled Project',
          projectImage: project.images[0]?.url || null,
          productName: primaryProduct.name,
          productId: primaryProduct.id,
          followerCount,
          isExistingVendor,
        });
      }

      // Create notification record for rate limiting
      // We'll create one notification per vendor for tracking
      if (isExistingVendor && vendorOrg!.users[0]) {
        await prisma.notification.create({
          data: {
            userId: vendorOrg!.users[0].user.id,
            type: 'PRODUCT_TAGGED',
            title: `${project.designer.name || 'A designer'} tagged your product`,
            body: `Your product "${primaryProduct.name}" was featured in a new project.`,
            actionUrl: `/project/${project.id}`,
            metadata: {
              vendorId,
              projectId: project.id,
              productId: primaryProduct.id,
              productCount: vendorData.products.length,
            },
          },
        });
      }

      notified++;
    } catch (error) {
      console.error(`[notifyTaggedVendors] Error for vendor ${vendorId}:`, error);
      errors++;
    }
  }

  console.log(`[notifyTaggedVendors] Completed for project ${projectId}:`, { notified, skipped, errors });
  return { notified, skipped, errors };
}

/**
 * Send the "You were tagged" email
 */
async function sendTaggedNotificationEmail(data: VendorNotificationData): Promise<void> {
  const {
    vendorEmail,
    vendorName,
    designerName,
    projectTitle,
    projectImage,
    productName,
    projectId,
    followerCount,
    isExistingVendor,
  } = data;

  const subject = `${designerName} tagged your product on Folio`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const viewPostUrl = `${appUrl}/project/${projectId}`;
  const claimProfileUrl = `${appUrl}/vendor/onboarding`;
  const dashboardUrl = `${appUrl}/vendor/dashboard`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #2C2825; max-width: 600px; margin: 0 auto; padding: 0; background-color: #FAF9F7;">

      <div style="padding: 32px 24px; background: #FFFFFF;">
        ${projectImage ? `
          <img
            src="${projectImage}"
            alt="${projectTitle}"
            style="width: 100%; border-radius: 12px; margin: 0 0 24px 0;"
          />
        ` : ''}

        <h1 style="font-size: 24px; font-weight: 600; color: #2C2825; margin: 0 0 8px 0;">
          You were tagged in ${designerName}'s latest project
        </h1>

        <p style="color: #8B8178; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
          <strong style="color: #2C2825;">${productName}</strong> is now in their Shop, visible to ${followerCount.toLocaleString()} followers
        </p>

        <div style="background: #F5F3F0; border-radius: 12px; padding: 20px; margin: 0 0 24px 0;">
          <h3 style="font-size: 14px; font-weight: 600; color: #8B8178; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">
            Suggested Marketing Contribution
          </h3>
          <p style="color: #2C2825; font-size: 20px; font-weight: 600; margin: 0 0 8px 0;">
            $25 - $75
          </p>
          <p style="color: #8B8178; font-size: 14px; margin: 0;">
            Based on designer reach and engagement. Support designers who showcase your products.
          </p>
        </div>

        <div style="margin-bottom: 24px;">
          <a
            href="${viewPostUrl}"
            style="display: block; background: #2C2825; color: white; padding: 14px 24px; border-radius: 10px; text-decoration: none; font-weight: 500; text-align: center; margin-bottom: 12px;"
          >
            View Post
          </a>

          ${isExistingVendor ? `
            <a
              href="${dashboardUrl}"
              style="display: block; background: #FFFFFF; color: #2C2825; padding: 14px 24px; border-radius: 10px; text-decoration: none; font-weight: 500; text-align: center; border: 1px solid #E8E4DF;"
            >
              Manage Contributions
            </a>
          ` : `
            <a
              href="${claimProfileUrl}"
              style="display: block; background: #FFFFFF; color: #2C2825; padding: 14px 24px; border-radius: 10px; text-decoration: none; font-weight: 500; text-align: center; border: 1px solid #E8E4DF;"
            >
              Claim Your Profile
            </a>
          `}
        </div>
      </div>

      <div style="padding: 24px; background: #F5F3F0; border-top: 1px solid #E8E4DF;">
        <p style="color: #A9A29A; font-size: 12px; margin: 0 0 8px 0;">
          Why am I receiving this? A designer tagged your product on Folio.
        </p>
        <a
          href="${appUrl}/unsubscribe?email=${encodeURIComponent(vendorEmail)}&type=vendor_tagged"
          style="color: #A9A29A; font-size: 12px; text-decoration: underline;"
        >
          Unsubscribe from these emails
        </a>
      </div>

    </body>
    </html>
  `;

  const text = `
You were tagged in ${designerName}'s latest project

${productName} is now in their Shop, visible to ${followerCount.toLocaleString()} followers

Suggested Marketing Contribution: $25 - $75
Based on designer reach and engagement. Support designers who showcase your products.

View Post: ${viewPostUrl}

${isExistingVendor ? `Manage Contributions: ${dashboardUrl}` : `Claim Your Profile: ${claimProfileUrl}`}

---
Why am I receiving this? A designer tagged your product on Folio.
  `.trim();

  if (!VENDOR_TAGGED_EMAILS_ENABLED) {
    // Kill-switch off: keep the legacy log-only behavior. Set
    // VENDOR_TAGGED_EMAILS_ENABLED=true in the environment to enable.
    console.log(`[notifyVendorTagged] disabled — would send to ${vendorEmail}:`, {
      subject,
      viewPostUrl,
    });
    return;
  }

  const result = await sendEmail({ to: vendorEmail, subject, html });
  if (!result.success) {
    // Don't throw — the caller runs fire-and-forget via .catch() and we don't
    // want a vendor email failure to abort the publish flow or surface errors
    // to the designer. Log loudly instead so the failure shows up in logs.
    console.error(
      `[notifyVendorTagged] Failed to send to ${vendorEmail}:`,
      result.error
    );
  } else {
    console.log(`[notifyVendorTagged] Sent to ${vendorEmail}: ${subject}`);
  }
}
