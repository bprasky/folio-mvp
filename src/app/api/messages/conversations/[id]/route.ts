import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/apiAuth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = params instanceof Promise ? await params : params;
  const conversationId = resolvedParams.id;

  // Check participant access
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: {
            select: { id: true, name: true, profileImage: true },
          },
        },
      },
      initiatorUser: {
        select: { id: true, name: true, profileImage: true },
      },
      recipientOrg: {
        select: { id: true, name: true, logo: true },
      },
      recipientUser: {
        select: { id: true, name: true, profileImage: true },
      },
      emailThread: {
        select: {
          id: true,
          recipientEmail: true,
          recipientName: true,
          status: true,
        },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  // Mark as read
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
    data: {
      lastReadAt: new Date(),
      unreadCount: 0,
    },
  });

  return NextResponse.json({ conversation });
}
