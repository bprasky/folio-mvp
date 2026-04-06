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

// ─── HTML Email Templates (for Send from Folio) ─────────────────

const EMAIL_WRAPPER_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #2C2825;
`;

function wrapHtml(bodyHtml: string, signature: string): string {
  return `<div style="${EMAIL_WRAPPER_STYLE}">
${bodyHtml}
${signature}
</div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateSampleRequestHtml(
  payload: SampleRequestPayload,
  designer: DesignerProfile,
  signature: string,
  repName?: string,
): string {
  const { subject } = generateSampleRequestEmail(payload, designer, repName);
  let body = `<p>Hi ${escapeHtml(repName || 'there')},</p>
<p>I'm ${escapeHtml(designer.name)}${designer.firmName ? ` with ${escapeHtml(designer.firmName)}` : ''}. I'm currently specifying the <strong>${escapeHtml(payload.productName)}</strong> for an upcoming project and would love to request a sample.</p>`;

  if (payload.finishOrColorway) {
    body += `<p><strong>Finish/Colorway:</strong> ${escapeHtml(payload.finishOrColorway)}</p>`;
  }
  if (payload.shippingAddress) {
    body += `<p><strong>Ship to:</strong><br>${escapeHtml(payload.shippingAddress).replace(/\n/g, '<br>')}</p>`;
  }
  if (payload.designerNote) {
    body += `<p>${escapeHtml(payload.designerNote)}</p>`;
  }

  return wrapHtml(body, signature);
}

export function generateQuoteRequestHtml(
  payload: QuoteRequestPayload,
  designer: DesignerProfile,
  signature: string,
  repName?: string,
): string {
  const timelineLabels: Record<string, string> = {
    urgent: 'Urgent',
    '2-4_weeks': '2\u20134 weeks',
    flexible: 'Flexible',
  };

  let body = `<p>Hi ${escapeHtml(repName || 'there')},</p>
<p>I'm ${escapeHtml(designer.name)}${designer.firmName ? ` with ${escapeHtml(designer.firmName)}` : ''}. I'm requesting a quote for the following:</p>
<table style="border-collapse:collapse;margin:12px 0">
  <tr><td style="padding:4px 16px 4px 0;color:#5C554D"><strong>Product:</strong></td><td>${escapeHtml(payload.productName)}</td></tr>
  ${payload.vendorName ? `<tr><td style="padding:4px 16px 4px 0;color:#5C554D"><strong>Vendor:</strong></td><td>${escapeHtml(payload.vendorName)}</td></tr>` : ''}
  <tr><td style="padding:4px 16px 4px 0;color:#5C554D"><strong>Quantity:</strong></td><td>${payload.quantity}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#5C554D"><strong>Timeline:</strong></td><td>${timelineLabels[payload.timeline] || payload.timeline}</td></tr>
  ${payload.projectName ? `<tr><td style="padding:4px 16px 4px 0;color:#5C554D"><strong>Project:</strong></td><td>${escapeHtml(payload.projectName)}</td></tr>` : ''}
</table>`;

  if (payload.notes) {
    body += `<p>${escapeHtml(payload.notes)}</p>`;
  }
  body += `<p>Please provide pricing including trade discount if applicable.</p>`;

  return wrapHtml(body, signature);
}

export function generateGeneralContactHtml(
  message: string,
  productName: string,
  designer: DesignerProfile,
  signature: string,
  repName?: string,
): string {
  const body = `<p>Hi ${escapeHtml(repName || 'there')},</p>
<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`;

  return wrapHtml(body, signature);
}

// ─── Multi-Request Templates ──────────────────────────────────

const REQUEST_TYPE_LABELS: Record<string, string> = {
  SAMPLE_REQUEST: 'Product sample',
  QUOTE_REQUEST: 'Quote/pricing',
  LEAD_TIME_REQUEST: 'Lead time information',
  PHOTO_REQUEST: 'Product photos/tearsheets',
  SPEC_REQUEST: 'Specs/technical data',
};

export function generateMultiRequestEmail(
  requestTypes: string[],
  productName: string,
  vendorName: string,
  designer: DesignerProfile,
  repName?: string,
): { subject: string; body: string } {
  const subject = requestTypes.length === 1
    ? `${REQUEST_TYPE_LABELS[requestTypes[0]] || 'Request'} \u2013 ${productName} | via Folio`
    : `Request regarding ${productName} | via Folio`;

  const requestList = requestTypes
    .map(t => `- ${REQUEST_TYPE_LABELS[t] || t}`)
    .join('\n');

  const body = `Hi ${repName || 'there'},

I'm ${designer.name}${designer.firmName ? ` with ${designer.firmName}` : ''}. I'm reaching out regarding the ${productName} by ${vendorName}.

I'd like to request the following:
${requestList}

Please let me know if you need any additional details.

I manage my product specifications through Folio (folioad.com). You can view my profile and respond directly there:
${designer.profileUrl}

Best,
${designer.name}${designer.firmName ? `\n${designer.firmName}` : ''}${designer.phone ? `\n${designer.phone}` : ''}`;

  return { subject, body };
}

export function generateMultiRequestHtml(
  requestTypes: string[],
  productName: string,
  vendorName: string,
  designer: DesignerProfile,
  signature: string,
  repName?: string,
): string {
  const listItems = requestTypes
    .map(t => `<li>${escapeHtml(REQUEST_TYPE_LABELS[t] || t)}</li>`)
    .join('');

  const body = `<p>Hi ${escapeHtml(repName || 'there')},</p>
<p>I'm ${escapeHtml(designer.name)}${designer.firmName ? ` with ${escapeHtml(designer.firmName)}` : ''}. I'm reaching out regarding the <strong>${escapeHtml(productName)}</strong> by ${escapeHtml(vendorName)}.</p>
<p>I'd like to request the following:</p>
<ul style="margin:8px 0">${listItems}</ul>
<p>Please let me know if you need any additional details.</p>`;

  return wrapHtml(body, signature);
}
