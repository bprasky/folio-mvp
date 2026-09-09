// @idor-allow: public-read reason="Public vendor contact form; bounded validated untrusted contact data, distributed IP/org limits, recipients derived only from active org leadership, no private response data"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { checkMultipleRateLimits, getClientIp } from '@/lib/rateLimit';

const Inquiry = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254), message: z.string().trim().min(1).max(4000) }).strict();

/**
 * POST /api/orgs/[orgId]/inquiry
 * Public contact form — creates notifications for org admins.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const orgId = resolvedParams.orgId;
    const limited = await checkMultipleRateLimits([
      { identifier: `org-inquiry-ip:${getClientIp(request.headers)}`, config: { max: 5, windowMs: 3600000 } },
      { identifier: `org-inquiry-target:${orgId}`, config: { max: 30, windowMs: 3600000 } },
    ]);
    if (!limited.success) return NextResponse.json({ error: 'Too many inquiries' }, { status: 429 });
    const raw = await request.text();
    if (raw.length > 8192) return NextResponse.json({ error: 'Invalid inquiry' }, { status: 400 });
    let parsed;
    try { parsed = Inquiry.safeParse(JSON.parse(raw)); } catch { return NextResponse.json({ error: 'Invalid inquiry' }, { status: 400 }); }
    if (!parsed.success) return NextResponse.json({ error: 'Invalid inquiry' }, { status: 400 });
    const { name, email, message } = parsed.data;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, type: true },
    });
    if (!org || !['VENDOR', 'MANUFACTURER', 'SHOWROOM'].includes(org.type)) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Notify org admins
    const admins = await prisma.organizationUser.findMany({
      where: { organizationId: orgId, isActive: true, role: { in: ['OWNER', 'ADMIN'] } },
      select: { userId: true },
      take: 20,
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.userId,
          type: 'ORG_INQUIRY',
          title: `New inquiry from ${name}`,
          body: message.slice(0, 200),
          actionUrl: `/org/${orgId}?tab=team`,
          metadata: { name, email, message, orgName: org.name },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[orgs/[orgId]/inquiry] Error:', error);
    return NextResponse.json({ error: 'Failed to send inquiry' }, { status: 500 });
  }
}
