import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export async function sendMessageNotification(
  conversationId: string,
  messageId: string
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        where: { id: messageId },
        include: { sender: { select: { id: true, name: true } } },
      },
      recipientOrg: { select: { id: true, name: true } },
      recipientUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (!conversation || !conversation.messages[0]) return;

  const message = conversation.messages[0];
  const senderName = message.sender.name;
  const isInquiry = conversation.context === "CLIENT_INQUIRY";

  // Resolve recipient users to notify
  const recipientUsers: { id: string; name: string; email: string }[] = [];

  if (conversation.recipientUser) {
    // Don't notify the sender
    if (conversation.recipientUser.id !== message.senderUserId) {
      recipientUsers.push(conversation.recipientUser);
    }
  }

  if (conversation.recipientOrgId) {
    // Find org members (owners/admins) to notify
    const orgMembers = await prisma.organizationUser.findMany({
      where: {
        organizationId: conversation.recipientOrgId,
        isActive: true,
        role: { in: ["OWNER", "ADMIN"] },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    for (const member of orgMembers) {
      if (member.userId !== message.senderUserId) {
        recipientUsers.push(member.user);
      }
    }
  }

  // Also notify initiator if the reply is from the other side
  if (
    conversation.initiatorUserId &&
    conversation.initiatorUserId !== message.senderUserId
  ) {
    const initiator = await prisma.user.findUnique({
      where: { id: conversation.initiatorUserId },
      select: { id: true, name: true, email: true },
    });
    if (
      initiator &&
      !recipientUsers.find((u) => u.id === initiator.id)
    ) {
      recipientUsers.push(initiator);
    }
  }

  const inboxUrl = `${BASE_URL}/inbox/${conversationId}`;

  for (const recipient of recipientUsers) {
    // Check messaging preferences
    const prefs = await prisma.messagingPreferences.findUnique({
      where: { userId: recipient.id },
    });

    // Default: send immediately if no preferences set
    if (prefs?.emailDigestFrequency === "NEVER") continue;
    if (prefs && !prefs.emailOnNewMessage) continue;
    if (isInquiry && prefs && !prefs.emailOnNewInquiry) continue;

    const emailTo = prefs?.emailNotificationAddress || recipient.email;
    const preview = message.body.slice(0, 200);
    const hasMore = message.body.length > 200;

    const subject = isInquiry
      ? `New inquiry from ${senderName}`
      : `${senderName} sent you a message`;

    await sendEmail({
      to: emailTo,
      subject,
      html: buildMessageEmailHtml({
        recipientName: recipient.name,
        senderName,
        conversationSubject: conversation.subject,
        preview,
        hasMore,
        isInquiry,
        inboxUrl,
      }),
    });
  }
}

function buildMessageEmailHtml({
  recipientName,
  senderName,
  conversationSubject,
  preview,
  hasMore,
  isInquiry,
  inboxUrl,
}: {
  recipientName: string;
  senderName: string;
  conversationSubject: string | null;
  preview: string;
  hasMore: boolean;
  isInquiry: boolean;
  inboxUrl: string;
}) {
  const subjectLine = conversationSubject
    ? `<p style="font-size:13px;color:#8B8178;margin:0 0 12px;">Re: ${escapeHtml(conversationSubject)}</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FAF9F7;font-family:'Instrument Sans',system-ui,sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:32px;background:#fff;border-radius:16px;border:1px solid #E8E4DF;">
    <p style="font-size:14px;color:#2C2825;margin:0 0 16px;">
      Hi ${escapeHtml(recipientName)},
    </p>
    <p style="font-size:14px;color:#5C554D;margin:0 0 20px;">
      ${escapeHtml(senderName)} ${isInquiry ? "sent you an inquiry" : "sent you a message"} on Folio.
    </p>
    ${subjectLine}
    <div style="background:#F5F3F0;border-radius:12px;padding:16px;margin:0 0 24px;">
      <p style="font-size:14px;color:#2C2825;margin:0;line-height:1.5;">
        "${escapeHtml(preview)}${hasMore ? "..." : ""}"
      </p>
    </div>
    <a href="${inboxUrl}" style="display:block;text-align:center;background:#2C2825;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;">
      Read and reply in Folio &rarr;
    </a>
    <hr style="border:none;border-top:1px solid #E8E4DF;margin:24px 0 16px;" />
    <p style="font-size:11px;color:#A69E96;text-align:center;margin:0;">
      <a href="${escapeHtml(inboxUrl.replace(/\/inbox\/.*/, "/inbox/settings"))}" style="color:#A69E96;">Manage notification preferences</a> &middot; Folio
    </p>
  </div>
</body>
</html>`.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
