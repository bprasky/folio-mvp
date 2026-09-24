import 'server-only';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/sendEmail';

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Called only for a newly committed pending request, never a pending retry. */
export async function notifyOrgJoinRequest(args: {
  orgId: string; orgName: string; requesterId: string; joinRequestId: string;
}) {
  const { orgId, orgName, requesterId, joinRequestId } = args;
  const [admins, requester] = await Promise.all([
    prisma.organizationUser.findMany({
      where: { organizationId: orgId, role: { in: ['OWNER', 'ADMIN'] }, isActive: true, userId: { not: requesterId } },
      select: { userId: true, user: { select: { email: true } } },
    }),
    prisma.user.findUnique({ where: { id: requesterId }, select: { name: true, email: true } }),
  ]);
  if (!requester || admins.length === 0) return { inApp: false, email: 'unavailable' as const };
  const requesterName = requester.name?.trim() || requester.email;
  const title = `${requesterName} requested to join ${orgName}`;
  const body = `${requesterName} (${requester.email}) wants to join ${orgName}. Review their request to grant access.`;
  const metadata = { kind: 'orgJoinRequest', joinRequestId, organizationId: orgId, requesterUserId: requesterId };
  const { actionUrl, notifications } = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({ data: {
      initiatorUserId: requesterId, recipientOrgId: orgId, subject: title,
      context: 'PLATFORM', category: 'GENERAL', status: 'ACTIVE', lastMessageAt: new Date(), structuredData: metadata,
    } });
    await tx.message.create({ data: { conversationId: conversation.id, senderUserId: requesterId, body } });
    await tx.conversationParticipant.createMany({ data: admins.map(admin => ({
      conversationId: conversation.id, userId: admin.userId, orgId, unreadCount: 1,
    })) });
    const actionUrl = `/inbox/${encodeURIComponent(conversation.id)}`;
    const notifications = await Promise.all(admins.map(admin => tx.notification.create({ data: {
      userId: admin.userId, type: 'ORG_JOIN_REQUEST', title, body, actionUrl,
      metadata: { ...metadata, emailStatus: 'pending' },
    }, select: { id: true } })));
    return { actionUrl, notifications };
  });

  // Use configured application origin, never an untrusted request Host header.
  const origin = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://folioad.com';
  const reviewUrl = new URL(actionUrl, origin).toString();
  const results = await Promise.all(admins.map(async (admin, index) => {
    let result: { success: boolean; error?: string };
    try {
      result = await sendEmail({ to: admin.user.email, subject: title.replace(/[\r\n]/g, ' '), html:
        `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(reviewUrl)}">Review join request</a></p>`,
      });
    } catch {
      result = { success: false, error: 'Email send failed' };
    }
    // Provider acceptance is not proof of delivery. Keep failed/unconfigured
    // sends visible for support without undoing the saved membership request.
    await prisma.notification.update({ where: { id: notifications[index].id }, data: {
      metadata: { ...metadata, emailStatus: result.success ? 'accepted' : 'failed',
        emailError: result.error ?? null, emailAttemptedAt: new Date().toISOString() },
    } });
    return result.success;
  }));
  return { inApp: true, email: results.every(Boolean) ? 'accepted' as const : 'failed' as const };
}
