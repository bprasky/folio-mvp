import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/apiAuth";
import { sendMessageNotification } from "@/lib/messaging/notifications";

export async function POST(
  req: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = params instanceof Promise ? await params : params;
  const conversationId = resolvedParams.id;

  // Verify participant access
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

  const { body } = await req.json();

  if (!body?.trim()) {
    return NextResponse.json(
      { error: "Message body is required" },
      { status: 400 }
    );
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderUserId: userId,
      body: body.trim(),
    },
    include: {
      sender: {
        select: { id: true, name: true, profileImage: true },
      },
    },
  });

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  // Increment unread for other participants
  await prisma.conversationParticipant.updateMany({
    where: {
      conversationId,
      userId: { not: userId },
    },
    data: { unreadCount: { increment: 1 } },
  });

  // Send notification (fire and forget)
  sendMessageNotification(conversationId, message.id).catch(console.error);

  return NextResponse.json({ message }, { status: 201 });
}
