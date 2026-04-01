/**
 * Build email signature for designer outbound emails.
 */

interface SignatureProfile {
  name: string;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  profileUrl: string;
  signatureIncludeFirm: boolean;
  signatureIncludePhone: boolean;
  signatureIncludeProfile: boolean;
  signatureIncludeEmail: boolean;
}

export function buildTextSignature(profile: SignatureProfile): string {
  const lines: string[] = [profile.name];

  if (profile.signatureIncludeFirm && profile.companyName) {
    lines.push(profile.companyName);
  }

  const contactParts: string[] = [];
  if (profile.signatureIncludeEmail && profile.email) {
    contactParts.push(profile.email);
  }
  if (profile.signatureIncludePhone && profile.phone) {
    contactParts.push(profile.phone);
  }
  if (contactParts.length > 0) {
    lines.push(contactParts.join(' | '));
  }

  if (profile.signatureIncludeProfile) {
    lines.push(profile.profileUrl);
  }

  return lines.join('\n');
}

export function buildHtmlSignature(profile: SignatureProfile): string {
  const lines: string[] = [
    `<strong>${escapeHtml(profile.name)}</strong>`,
  ];

  if (profile.signatureIncludeFirm && profile.companyName) {
    lines.push(escapeHtml(profile.companyName));
  }

  const contactParts: string[] = [];
  if (profile.signatureIncludeEmail && profile.email) {
    contactParts.push(`<a href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a>`);
  }
  if (profile.signatureIncludePhone && profile.phone) {
    contactParts.push(escapeHtml(profile.phone));
  }
  if (contactParts.length > 0) {
    lines.push(contactParts.join(' &middot; '));
  }

  if (profile.signatureIncludeProfile) {
    lines.push(`<a href="${escapeHtml(profile.profileUrl)}">${escapeHtml(profile.profileUrl)}</a>`);
  }

  return `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #E8E4DF;font-size:13px;color:#5C554D;line-height:1.5">
${lines.join('<br>')}
</div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
