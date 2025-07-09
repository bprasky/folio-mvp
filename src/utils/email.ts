import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key from environment
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export interface EmailData {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(emailData: EmailData) {
  try {
    const msg = {
      to: emailData.to,
      from: emailData.from || process.env.SENDGRID_FROM_EMAIL || 'noreply@folio.com',
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text || emailData.html.replace(/<[^>]*>/g, ''),
    };

    await sgMail.send(msg);
    console.log(`Email sent successfully to ${emailData.to}`);
    return { success: true };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error };
  }
}

export function generateEventInviteEmail(
  inviteeEmail: string,
  eventTitle: string,
  subEventTitle: string,
  inviteToken: string,
  inviterName: string
) {
  const inviteUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/invites/accept/${inviteToken}`;
  
  return {
    to: inviteeEmail,
    subject: `You're invited to ${subEventTitle} at ${eventTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">You're Invited!</h2>
        <p>Hi there,</p>
        <p><strong>${inviterName}</strong> has invited you to attend:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #333;">${subEventTitle}</h3>
          <p style="margin: 0; color: #666;">Part of ${eventTitle}</p>
        </div>
        <p>Click the button below to accept your invitation and create your account:</p>
        <a href="${inviteUrl}" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Accept Invitation
        </a>
        <p style="color: #666; font-size: 14px;">
          This invitation will expire in 7 days. If you have any questions, please contact the event organizer.
        </p>
      </div>
    `
  };
} 