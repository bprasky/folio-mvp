import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { canUserRSVP } from "@/lib/events/gating";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toId(param: string | string[] | undefined) {
  if (!param) return null;
  return Array.isArray(param) ? param[0] : param;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const eventId = toId(params?.id);
    if (!eventId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    const userEmail = session?.user?.email || null;

    const result = await canUserRSVP(eventId, userId, userEmail);

    return NextResponse.json(result);
  } catch (e) {
    console.error("can-rsvp GET error", e);
    return NextResponse.json({ allowed: false, reason: "Server error" }, { status: 500 });
  }
}


