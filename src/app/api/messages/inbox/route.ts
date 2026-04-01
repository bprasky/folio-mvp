import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/apiAuth";

export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const filter = searchParams.get("filter") ?? "all";
  const category = searchParams.get("category");

  // Map category filter shortcuts
  const categoryMap: Record<string, string> = {
    samples: "SAMPLE_REQUEST",
    quotes: "QUOTE_REQUEST",
    general: "GENERAL",
    collaborations: "COLLABORATION",
  };
  const effectiveCategory = category
    ? categoryMap[category] || category
    : undefined;

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { recipientUserId: userId },
        ...(orgId ? [{ recipientOrgId: orgId }] : []),
        { initiatorUserId: userId },
        {
          participants: {
            some: { userId },
          },
        },
      ],
      status: "ACTIVE",
      ...(filter === "unread"
        ? {
            participants: {
              some: {
                userId,
                unreadCount: { gt: 0 },
              },
            },
          }
        : {}),
      ...(filter === "inquiries" ? { context: "CLIENT_INQUIRY" } : {}),
      ...(effectiveCategory ? { category: effectiveCategory } : {}),
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sender: {
            select: { id: true, name: true, profileImage: true },
          },
        },
      },
      participants: {
        where: { userId },
      },
      initiatorUser: {
        select: { id: true, name: true, profileImage: true },
      },
      initiatorOrg: {
        select: { id: true, name: true, logo: true },
      },
      recipientOrg: {
        select: { id: true, name: true, logo: true },
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  // Compute category counts for vendor inbox tabs
  const categoryCounts = await prisma.conversation.groupBy({
    by: ['category'],
    where: {
      OR: [
        { recipientUserId: userId },
        ...(orgId ? [{ recipientOrgId: orgId }] : []),
        { initiatorUserId: userId },
        { participants: { some: { userId } } },
      ],
      status: "ACTIVE",
    },
    _count: { id: true },
  });

  const counts: Record<string, number> = {};
  for (const row of categoryCounts) {
    counts[row.category] = row._count.id;
  }

  return NextResponse.json({ conversations, categoryCounts: counts });
}
