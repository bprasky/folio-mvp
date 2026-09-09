export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ClaimStatus } from '@prisma/client';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/sendEmail';

// Send-the-link endpoint. The member who minted the OrgClaimInvite (or any
// admin of the org) can use this to email the link to whoever can claim the
// firm page. Missing delivery configuration returns a failure, never sent status.
// See docs/AUTH_ORG_ENROLLMENT_FLOW.md.

const bodySchema = z.object({
  token: z.string().min(8, 'Missing claim token'),
  recipientEmail: z.string().email('Enter a valid email address'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { token, recipientEmail } = parsed.data;
  const userId = session.user.id;
  const orgId = params.orgId;

  // Must be a member of the org to send the link (covers both the OWNER
  // path and the MEMBER who minted it).
  const membership = await prisma.organizationUser.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } },
    select: { isActive: true },
  });
  if (!membership || !membership.isActive) {
    return NextResponse.json(
      { error: 'You are not a member of this organization.' },
      { status: 403 }
    );
  }

  // Token must belong to this org and still be PENDING.
  const invite = await prisma.orgClaimInvite.findUnique({
    where: { token },
    select: {
      id: true,
      organizationId: true,
      status: true,
      expiresAt: true,
      organization: { select: { name: true } },
    },
  });
  if (!invite || invite.organizationId !== orgId) {
    return NextResponse.json({ error: 'Claim invite not found.' }, { status: 404 });
  }
  if (invite.status !== ClaimStatus.PENDING) {
    return NextResponse.json(
      { error: `This invite is ${invite.status.toLowerCase()} and can no longer be sent.` },
      { status: 400 }
    );
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'This claim invite has expired.' }, { status: 400 });
  }

  // Capture the invitedEmail on the invite row so we know who got pinged.
  // Idempotent — multiple sends to the same recipient just overwrite.
  await prisma.orgClaimInvite.update({
    where: { id: invite.id },
    data: { invitedEmail: recipientEmail.toLowerCase().trim() },
  });

  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host') ?? request.headers.get('x-forwarded-host') ?? '';
  const claimUrl = `${proto}://${host}/auth/claim?token=${encodeURIComponent(token)}`;

  const html = `
    <p>You've been invited to claim <strong>${escapeHtml(invite.organization.name)}</strong> on Folio.</p>
    <p>Folio is the design magazine where every project credits the people who made it. A teammate started a Folio page for your firm and asked you to set it up.</p>
    <p><a href="${claimUrl}">Claim ${escapeHtml(invite.organization.name)}</a></p>
    <p>This link expires on ${invite.expiresAt.toUTCString()}.</p>
  `;

  const result = await sendEmail({
    to: recipientEmail,
    subject: `Claim ${invite.organization.name} on Folio`,
    html,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? 'Failed to send email.' },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    delivered: Boolean(process.env.RESEND_API_KEY),
    recipientEmail,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
