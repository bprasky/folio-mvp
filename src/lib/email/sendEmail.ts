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
