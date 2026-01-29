/**
 * Email Template: Vendor Tagged Notification
 *
 * Sent when a designer tags a product from a vendor org
 * that hasn't been notified yet. This is the initial hook
 * that drives vendors to the claim flow.
 */

interface VendorTaggedEmailProps {
  repName: string;
  repEmail: string;
  designerName: string;
  designerPhoto: string | null;
  productName: string;
  projectName: string;
  projectImage: string | null;
  quote: string | null;
  tagCount: number;
  designerCount: number;
  claimUrl: string;
}

/**
 * Generate HTML email for the vendor tagged notification.
 */
export function generateVendorTaggedEmailHtml(props: VendorTaggedEmailProps): string {
  const {
    repName,
    designerName,
    productName,
    projectName,
    projectImage,
    quote,
    tagCount,
    designerCount,
    claimUrl,
    repEmail,
  } = props;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const unsubscribeUrl = `${appUrl}/unsubscribe?email=${encodeURIComponent(repEmail)}&type=vendor_tagged`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${designerName} tagged your ${productName} on Folio</title>
</head>
<body style="font-family: 'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1A1A1A; max-width: 600px; margin: 0 auto; padding: 0; background-color: #FAFAF9;">

  <!-- Header -->
  <div style="padding: 32px 24px 0; text-align: center;">
    <p style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; font-weight: 500; color: #1A1A1A; letter-spacing: 0.5px; margin: 0;">
      FOLIO
    </p>
  </div>

  <div style="padding: 24px;">

    ${projectImage ? `
      <div style="border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
        <img
          src="${projectImage}"
          alt="${projectName}"
          style="width: 100%; display: block;"
        />
      </div>
    ` : ''}

    <p style="font-size: 16px; color: #5C5C5C; margin: 0 0 4px 0;">
      Hi ${repName},
    </p>

    <h1 style="font-size: 24px; font-weight: 500; color: #1A1A1A; margin: 0 0 16px 0; line-height: 1.3;">
      A designer just credited your product in their portfolio.
    </h1>

    <p style="font-size: 16px; color: #5C5C5C; line-height: 1.6; margin: 0 0 24px 0;">
      <strong style="color: #1A1A1A;">${designerName}</strong> tagged the
      <strong style="color: #1A1A1A;">${productName}</strong> in their project
      <em>${projectName}</em>.
    </p>

    ${quote ? `
      <div style="border-left: 3px solid #B8845C; padding: 16px 20px; margin: 0 0 24px 0; background: #F5F3EF;">
        <p style="font-style: italic; color: #1A1A1A; font-size: 16px; margin: 0 0 8px 0;">
          "${quote}"
        </p>
        <p style="color: #8C8C8C; font-size: 13px; margin: 0;">
          — ${designerName}
        </p>
      </div>
    ` : ''}

    <p style="font-size: 15px; color: #5C5C5C; line-height: 1.6; margin: 0 0 24px 0;">
      This is the first time you're seeing this. Folio captures designer specifications
      automatically — giving you attribution you've never had before.
    </p>

    <!-- CTA -->
    <div style="text-align: center; margin: 0 0 24px 0;">
      <a
        href="${claimUrl}"
        style="display: inline-block; background: #1A1A1A; color: #FFFFFF; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 500; font-size: 16px;"
      >
        Claim Your Vendor Page
      </a>
    </div>

    <!-- Stats -->
    <div style="background: #F5F3EF; border-radius: 12px; padding: 20px; margin: 0 0 24px 0; text-align: center;">
      <p style="color: #5C5C5C; font-size: 14px; margin: 0 0 4px 0;">
        You've been tagged
      </p>
      <p style="font-size: 28px; font-weight: 600; color: #1A1A1A; margin: 0 0 4px 0;">
        ${tagCount} time${tagCount !== 1 ? 's' : ''}
      </p>
      <p style="color: #5C5C5C; font-size: 14px; margin: 0;">
        by ${designerCount} designer${designerCount !== 1 ? 's' : ''}
      </p>
    </div>

    <p style="font-size: 14px; color: #8C8C8C; line-height: 1.6; margin: 0 0 24px 0;">
      See all your tags and invite your team to explore.
    </p>
  </div>

  <!-- Footer -->
  <div style="padding: 24px; background: #F5F3EF; border-top: 1px solid #E8E4DF;">
    <p style="color: #8C8C8C; font-size: 12px; margin: 0 0 4px 0;">
      — Folio
    </p>
    <p style="color: #8C8C8C; font-size: 12px; margin: 0 0 8px 0;">
      Questions? Reply to this email.
    </p>
    <a
      href="${unsubscribeUrl}"
      style="color: #8C8C8C; font-size: 12px; text-decoration: underline;"
    >
      Unsubscribe from these emails
    </a>
  </div>

</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of the vendor tagged email.
 */
export function generateVendorTaggedEmailText(props: VendorTaggedEmailProps): string {
  const {
    repName,
    designerName,
    productName,
    projectName,
    quote,
    tagCount,
    designerCount,
    claimUrl,
  } = props;

  return `
Hi ${repName},

A designer just credited your product in their portfolio.

${designerName} tagged the ${productName} in their project "${projectName}".

${quote ? `She wrote: "${quote}"\n` : ''}
This is the first time you're seeing this. Folio captures designer specifications automatically — giving you attribution you've never had before.

Claim Your Vendor Page: ${claimUrl}

You've been tagged ${tagCount} time${tagCount !== 1 ? 's' : ''} by ${designerCount} designer${designerCount !== 1 ? 's' : ''}. See all your tags and invite your team to explore.

— Folio

Questions? Reply to this email.
  `.trim();
}

/**
 * Get the email subject line.
 */
export function getVendorTaggedSubject(designerName: string, productName: string): string {
  return `${designerName} tagged your ${productName} on Folio`;
}
