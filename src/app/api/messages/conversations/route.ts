import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/apiAuth";
import { sendMessageNotification } from "@/lib/messaging/notifications";

export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to send a message" },
      { status: 401 }
    );
  }

  const { recipientOrgId, recipientUserId, body, subject, context } =
    await req.json();

  if (!body?.trim()) {
    return NextResponse.json(
      { error: "Message body is required" },
      { status: 400 }
    );
  }

  if (!recipientOrgId && !recipientUserId) {
    return NextResponse.json(
      { error: "Recipient is required" },
      { status: 400 }
    );
  }

  // Check for existing active conversation between these parties
  const existing = await prisma.conversation.findFirst({
    where: {
      initiatorUserId: userId,
      ...(recipientOrgId ? { recipientOrgId } : {}),
      ...(recipientUserId ? { recipientUserId } : {}),
      status: "ACTIVE",
    },
  });

  if (existing) {
    const message = await prisma.message.create({
      data: {
        conversationId: existing.id,
        senderUserId: userId,
        body: body.trim(),
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: existing.id },
      data: { lastMessageAt: new Date() },
    });

    // Increment unread count for other participants
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId: existing.id,
        userId: { not: userId },
      },
      data: { unreadCount: { increment: 1 } },
    });

    // Send email notification (fire and forget)
    sendMessageNotification(existing.id, message.id).catch(console.error);

    return NextResponse.json({ conversationId: existing.id, message });
  }

  // Create new conversation with first message
  const now = new Date();
  const conversation = await prisma.conversation.create({
    data: {
      initiatorUserId: userId,
      ...(recipientOrgId ? { recipientOrgId } : {}),
      ...(recipientUserId ? { recipientUserId } : {}),
      subject: subject?.trim() || null,
      context: context ?? "GENERAL",
      lastMessageAt: now,
      messages: {
        create: {
          senderUserId: userId,
          body: body.trim(),
        },
      },
      participants: {
        create: {
          userId,
        },
      },
    },
    include: { messages: true },
  });

  // Add recipient participant(s)
  if (recipientUserId) {
    await prisma.conversationParticipant
      .create({
        data: {
          conversationId: conversation.id,
          userId: recipientUserId,
          unreadCount: 1,
        },
      })
      .catch(() => {
        // Recipient user might not exist
      });
  }

  if (recipientOrgId) {
    // Add org owner/admins as participants
    const orgMembers = await prisma.organizationUser.findMany({
      where: {
        organizationId: recipientOrgId,
        isActive: true,
        role: { in: ["OWNER", "ADMIN"] },
      },
      select: { userId: true },
    });

    for (const member of orgMembers) {
      if (member.userId === userId) continue;
      await prisma.conversationParticipant
        .create({
          data: {
            conversationId: conversation.id,
            userId: member.userId,
            orgId: recipientOrgId,
            unreadCount: 1,
          },
        })
        .catch(() => {
          // Skip duplicates
        });
    }
  }

  // Send email notification (fire and forget)
  const messageId = conversation.messages[0]?.id;
  if (messageId) {
    sendMessageNotification(conversation.id, messageId).catch(console.error);
  }

  return NextResponse.json(
    { conversationId: conversation.id },
    { status: 201 }
  );
}
