/**
 * Template email generation for off-platform fallback.
 * Used when vendor rep is not on Folio and designer opts for email.
 */

import type { SampleRequestPayload, QuoteRequestPayload } from '@/types/structured-requests';

interface DesignerProfile {
  name: string;
  firmName?: string;
  phone?: string;
  address?: string;
  profileUrl: string;
}

export function generateSampleRequestEmail(
  payload: SampleRequestPayload,
  designer: DesignerProfile,
  repName?: string
): { subject: string; body: string } {
  const subject = `Sample Request \u2013 ${payload.productName} | via Folio`;

  const body = `Hi ${repName || 'there'},

I'm ${designer.name}${designer.firmName ? ` with ${designer.firmName}` : ''}. I'm currently specifying the ${payload.productName} for an upcoming project and would love to request a sample.
${payload.finishOrColorway ? `\nSpecific finish/colorway: ${payload.finishOrColorway}` : ''}
${payload.shippingAddress ? `\nShip to:\n${payload.shippingAddress}` : ''}
${payload.designerNote ? `\nNote: ${payload.designerNote}` : ''}

I manage my product specifications through Folio (folioad.com). You can view my profile and respond directly there:
${designer.profileUrl}

Best,
${designer.name}${designer.firmName ? `\n${designer.firmName}` : ''}${designer.phone ? `\n${designer.phone}` : ''}`;

  return { subject, body };
}

export function generateQuoteRequestEmail(
  payload: QuoteRequestPayload,
  designer: DesignerProfile,
  repName?: string
): { subject: string; body: string } {
  const timelineLabels: Record<string, string> = {
    urgent: 'Urgent',
    '2-4_weeks': '2\u20134 weeks',
    flexible: 'Flexible',
  };

  const subject = `Quote Request \u2013 ${payload.productName} | via Folio`;

  const body = `Hi ${repName || 'there'},

I'm ${designer.name}${designer.firmName ? ` with ${designer.firmName}` : ''}. I'm requesting a quote for the following:

Product: ${payload.productName}
${payload.vendorName ? `Vendor: ${payload.vendorName}` : ''}
Quantity: ${payload.quantity}
Timeline: ${timelineLabels[payload.timeline] || payload.timeline}
${payload.projectName ? `Project: ${payload.projectName}` : ''}
${payload.notes ? `\nNotes: ${payload.notes}` : ''}

Please provide pricing including trade discount if applicable.

I manage my product specifications through Folio (folioad.com). You can view my profile and respond directly there:
${designer.profileUrl}

Best,
${designer.name}${designer.firmName ? `\n${designer.firmName}` : ''}${designer.phone ? `\n${designer.phone}` : ''}`;

  return { subject, body };
}

export function generateGeneralContactEmail(
  message: string,
  productName: string,
  designer: DesignerProfile,
  repName?: string
): { subject: string; body: string } {
  const subject = `Re: ${productName} | via Folio`;

  const body = `Hi ${repName || 'there'},

${message}

---
${designer.name}${designer.firmName ? ` | ${designer.firmName}` : ''}
${designer.profileUrl}${designer.phone ? `\n${designer.phone}` : ''}`;

  return { subject, body };
}

/**
 * Build a mailto: link with pre-filled fields.
 */
export function buildMailtoLink(
  email: string,
  template: { subject: string; body: string }
): string {
  const params = new URLSearchParams({
    subject: template.subject,
    body: template.body,
  });
  return `mailto:${email}?${params.toString()}`;
}
