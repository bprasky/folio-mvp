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
    lead_time: "LEAD_TIME_REQUEST",
    photos: "PHOTO_REQUEST",
    specs: "SPEC_REQUEST",
  };
  const effectiveCategory = category
    ? categoryMap[category] || category
    : undefined;

  // Build AND conditions to avoid conflicting OR keys
  const andConditions: Record<string, unknown>[] = [
    {
      OR: [
        { recipientUserId: userId },
        ...(orgId ? [{ recipientOrgId: orgId }] : []),
        { initiatorUserId: userId },
        { participants: { some: { userId } } },
      ],
    },
  ];

  if (effectiveCategory) {
    andConditions.push({
      OR: [
        { category: effectiveCategory },
        {
          structuredData: {
            path: ['requestTypes'],
            array_contains: effectiveCategory,
          },
        },
      ],
    });
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      AND: andConditions,
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
      ...(filter === "emails" ? { context: "FOLIO_EMAIL" } : {}),
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
  // Primary category counts
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

  // Supplement with requestTypes from structuredData for multi-request conversations
  try {
    // NOTE: orgId must be parameterized, never interpolated — it comes from
    // searchParams and was previously string-concatenated into the SQL,
    // which was a SQL-injection primitive via `?orgId=...`.
    const supplementSql = `
      SELECT rt, COUNT(DISTINCT c.id) as cnt
      FROM conversations c,
           jsonb_array_elements_text(c.structured_data->'requestTypes') AS rt
      WHERE c.status = 'ACTIVE'
        AND c.structured_data->'requestTypes' IS NOT NULL
        AND jsonb_typeof(c.structured_data->'requestTypes') = 'array'
        AND (
          c.recipient_user_id = $1
          OR c.initiator_user_id = $1
          ${orgId ? 'OR c.recipient_org_id = $2' : ''}
        )
        AND rt != c.category
      GROUP BY rt
    `;
    const supplementCounts = orgId
      ? await prisma.$queryRawUnsafe<{ rt: string; cnt: bigint }[]>(
          supplementSql,
          userId,
          orgId,
        )
      : await prisma.$queryRawUnsafe<{ rt: string; cnt: bigint }[]>(
          supplementSql,
          userId,
        );

    for (const row of supplementCounts) {
      const key = row.rt;
      counts[key] = (counts[key] || 0) + Number(row.cnt);
    }
  } catch {
    // Gracefully handle if raw query fails (e.g., column naming differences)
  }

  return NextResponse.json({ conversations, categoryCounts: counts });
}
