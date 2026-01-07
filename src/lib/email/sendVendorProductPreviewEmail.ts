import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function sendVendorProductPreviewEmail(params: {
  vendorEmail: string;
  vendorName?: string;
  productId: string;
  projectId: string;
}) {
  const { vendorEmail, vendorName, productId, projectId } = params;

  // 1. Ensure vendor exists or create stub
  const vendor = await prisma.vendor.upsert({
    where: { primaryEmail: vendorEmail },
    update: {},
    create: {
      name: vendorName ?? "New Vendor",
      primaryEmail: vendorEmail,
    },
  });

  // 2. Create preview token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14); // 14 days

  await prisma.vendorPreviewToken.create({
    data: {
      token,
      expiresAt,
      vendorId: vendor.id,
      productId,
      projectId,
    },
  });

  const previewUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/vendor/preview/${token}`;

  // 3. Build email HTML/text (use your brand styles)
  const subject = "Your product was featured in a Folio project";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Your Product Was Featured</h1>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hi ${vendorName ?? "there"},</p>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
          A verified Folio designer has featured your product in a recent project.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${previewUrl}" 
             style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            View Your Product in Folio
          </a>
        </div>
        
        <p style="font-size: 16px; margin-bottom: 20px;">From this page, you can:</p>
        <ul style="font-size: 16px; margin-bottom: 20px; padding-left: 20px;">
          <li>Claim the product and complete its specifications</li>
          <li>See how it looks in the designer's project</li>
          <li>Explore how Folio can help you reach more designers</li>
        </ul>
        
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          This link will expire in 14 days. If you have any questions, please contact us.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
Hi ${vendorName ?? "there"},

A verified Folio designer has featured your product in a recent project.

You can preview how your product appears inside Folio here:
${previewUrl}

From this page, you can:
- Claim the product and complete its specifications
- See how it looks in the designer's project
- Explore how Folio can help you reach more designers

This link will expire in 14 days.

Best regards,
The Folio Team
  `;

  // 4. Send email via your provider
  // TODO: Integrate with your email service (SendGrid, Resend, etc.)
  // For now, we'll just log it. In production, you would do:
  // await emailClient.send({
  //   to: vendorEmail,
  //   subject,
  //   html,
  //   text,
  // });

  console.log(`[EMAIL] Would send to ${vendorEmail}:`, {
    subject,
    previewUrl,
  });

  // In a real implementation, you would use your email service here
  // Example with a generic email service:
  // try {
  //   await fetch('https://api.emailservice.com/send', {
  //     method: 'POST',
  //     headers: {
  //       'Authorization': `Bearer ${process.env.EMAIL_API_KEY}`,
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       to: vendorEmail,
  //       subject,
  //       html,
  //       text,
  //     }),
  //   });
  // } catch (error) {
  //   console.error('Failed to send email:', error);
  //   throw error;
  // }

  return { previewUrl, token };
}




