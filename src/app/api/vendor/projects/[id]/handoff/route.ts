import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getToken } from "next-auth/jwt";
import crypto from "crypto";

export async function POST(req: Request, { params }: { params: { id: string }}) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.designerEmail ?? body?.recipientEmail ?? "")
      .trim()
      .toLowerCase();
    if (!email) return NextResponse.json({ error: "Recipient email required" }, { status: 400 });

    // optional attribution
    let vendorUserId: string | null = null;
    try {
      const t = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
      vendorUserId = (t?.sub as string) || (t as any)?.id || null;
    } catch {}

    // create visit
    const token = crypto.randomUUID();
    const visitData: any = {
      token,
      projectId: params.id as any,
      designerEmail: email,      // ✅ your DB column
    };
    if (vendorUserId) {
      visitData.vendorId = vendorUserId;
    }
    
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
    return NextResponse.json({ error: e?.message || "Failed to create handoff" }, { status: 500 });
  }
} 