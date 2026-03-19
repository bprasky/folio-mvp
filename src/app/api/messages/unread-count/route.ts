import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/apiAuth";

export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ unreadCount: 0 });
  }

  const result = await prisma.conversationParticipant.aggregate({
    where: {
      userId,
      isArchived: false,
      unreadCount: { gt: 0 },
    },
    _sum: { unreadCount: true },
  });

  return NextResponse.json({
    unreadCount: result._sum.unreadCount ?? 0,
  });
}
