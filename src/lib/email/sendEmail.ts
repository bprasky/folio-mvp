import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM = process.env.EMAIL_FROM || "Folio <events@folioad.com>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.log(`[Email] No RESEND_API_KEY — skipping email to ${to}: ${subject}`);
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });
    if (error) {
      console.error(`[Email] Failed to send to ${to}:`, error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.error(`[Email] Exception sending to ${to}:`, e);
    return { success: false, error: e.message };
  }
}

/**
 * Send an email from a designer's Folio proxy address.
 * Used for action item emails (quote requests, sample requests, etc.)
 * so replies route back through Folio's inbound webhook.
 */
export async function sendProxyEmail({
  from,
  replyTo,
  to,
  subject,
  text,
  html,
}: {
  from: string;     // e.g. "Sarah Chen via Folio <sarah.chen.a8f3@mail.folioad.com>"
  replyTo: string;  // proxy address for reply routing
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ success: boolean; resendMessageId?: string; error?: string }> {
  if (!resend) {
    console.log(`[Email] No RESEND_API_KEY — skipping proxy email to ${to}: ${subject}`);
    return { success: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      replyTo,
      to,
      subject,
      text,
      html,
    });
    if (error) {
      console.error(`[Email] Proxy send failed to ${to}:`, error);
      return { success: false, error: error.message };
    }
    return { success: true, resendMessageId: data?.id };
  } catch (e: any) {
    console.error(`[Email] Proxy send exception to ${to}:`, e);
    return { success: false, error: e.message };
  }
}
