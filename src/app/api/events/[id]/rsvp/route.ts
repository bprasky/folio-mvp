import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OK = ["ATTENDING","INTERESTED","SEND_TO_TEAM"] as const;
type RSVPState = typeof OK[number];

function toId(param: string | string[] | undefined) {
  if (!param) return null;
  return Array.isArray(param) ? param[0] : param;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const eventId = toId(params?.id);
    if (!eventId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { status } = await req.json() as { status?: string };
    const next = String(status || "").toUpperCase() as RSVPState;
    if (!OK.includes(next)) return NextResponse.json({ error: "Bad status" }, { status: 400 });

    await prisma.eventRSVP.upsert({
      where: { userId_eventId: { userId: session.user.id, eventId } },
      update: { status: next },
      create: { userId: session.user.id, eventId, status: next },
    });

    // lightweight counts for UI
    const byStatus = await prisma.eventRSVP.groupBy({
      by: ["status"],
      where: { eventId },
      _count: true,
    });

    const counts = {
      attending: byStatus.find(s => s.status?.toUpperCase() === "ATTENDING")?._count ?? 0,
      interested: byStatus.find(s => s.status?.toUpperCase() === "INTERESTED")?._count ?? 0,
    };

    return NextResponse.json({ ok: true, counts });
  } catch (e) {
    console.error("RSVP PATCH error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const eventId = toId(params?.id);
    if (!eventId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const byStatus = await prisma.eventRSVP.groupBy({
      by: ["status"],
      where: { eventId },
      _count: true,
    });

    const counts = {
      attending: byStatus.find(s => s.status?.toUpperCase() === "ATTENDING")?._count ?? 0,
      interested: byStatus.find(s => s.status?.toUpperCase() === "INTERESTED")?._count ?? 0,
    };

    return NextResponse.json({ ok: true, counts });
  } catch (e) {
    console.error("RSVP GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
} 