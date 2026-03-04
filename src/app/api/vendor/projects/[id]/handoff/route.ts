export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request, { params }: { params: { id: string }}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the user has vendor org access to this project
    const orgUser = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        organization: {
          type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] },
        },
      },
      select: { organizationId: true },
    });

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { ownerId: true, vendorOrgId: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === session.user.id;
    const isVendorOrg = orgUser && project.vendorOrgId === orgUser.organizationId;
    if (!isOwner && !isVendorOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.designerEmail ?? body?.recipientEmail ?? "")
      .trim()
      .toLowerCase();
    if (!email) return NextResponse.json({ error: "Recipient email required" }, { status: 400 });

    // create visit
    const token = crypto.randomUUID();
    const visitData: any = {
      token,
      projectId: params.id as any,
      designerEmail: email,
      vendorId: session.user.id,
    };

    await prisma.vendorVisit.create({
      data: visitData,
      select: { id: true },
    });

    // stamp project for vendor-side status
    await prisma.project.update({
      where: { id: params.id as any },
      data: { isHandoffReady: true, handoffInvitedAt: new Date() },
    }).catch(() => {});

    // return data (used by UI to show/copy; but designer sees in-app inbox regardless)
    const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3002";
    return NextResponse.json({ token, visitUrl: `${origin}/visit/${token}` }, { status: 200 });
  } catch (e: any) {
    console.error('[Handoff POST] failed:', e?.message);
    return NextResponse.json({ error: e?.message || "Failed to create handoff" }, { status: 500 });
  }
}
