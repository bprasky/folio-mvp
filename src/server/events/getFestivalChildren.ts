// SERVER-ONLY (no "use client")
import prisma from "@/lib/prisma";

const toIso = (v: any) =>
  v instanceof Date ? v.toISOString() : (typeof v === "string" ? v : null);

const toStr = (v: any) => (v == null ? "" : String(v));

export type FestivalChild = {
  id: string;
  title: string | null;
  description: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  city: string | null;
  venue: string | null;
  festivalId: string | null;
  eventTypes: string[] | null; // keep as strings to avoid leaking enums to client
  coverImageUrl: string | null;
};

export async function getFestivalById(id: string) {
  if (!id) return null;

  // No brittle `select` — fetch scalars and map safely
  const r: any = await prisma.event.findUnique({
    where: { id }, // findUnique must only use the unique field
  });
  if (!r) return null;

  return {
    id: r.id,
    title: toStr(r.title ?? r.name),
    description: toStr(r.description),
    startsAt: toIso(r.startDate ?? r.startsAt),
    endsAt:   toIso(r.endDate   ?? r.endsAt),
    city:  toStr(r.city ?? r.location),
    venue: toStr(r.venue),
    coverImageUrl: r.coverImageUrl ?? null,
    eventTypes: Array.isArray(r.eventTypes) ? r.eventTypes.map((t: any) => String(t)) : [],
    isApproved: r.isApproved ?? null,
  };
}

export async function getFestivalChildren(festivalId: string) {
  if (!festivalId) return [];

  // 1) PRIMARY: fetch via relation (covers seeds that didn't set parentFestivalId)
  try {
    const fest = await prisma.event.findUnique({
      where: { id: festivalId },
      select: {
        subevents: {
          orderBy: [{ createdAt: "asc" as any }],
        },
      },
    });

    const rel = fest?.subevents ?? [];
    if (rel.length > 0) {
      if (process.env.NODE_ENV !== "production") {
        const counts = rel.reduce((acc, r) => {
          const has = Array.isArray(r?.eventTypes) && r.eventTypes.length > 0;
          acc[has ? "typed" : "untagged"] = (acc[has ? "typed" : "untagged"] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log("[children:typed breakdown]", rel.length, counts);
      }
      return rel.map(mapRowToUI);
    }
  } catch (_) {
    // swallow and try fallbacks
  }

  // 2) FALLBACK A: direct foreign key (for records with parentFestivalId persisted)
  try {
    const rows = await prisma.event.findMany({
      where: {
        parentFestivalId: festivalId,
      },
      orderBy: [{ createdAt: "asc" as any }],
    });
    if (rows.length > 0) {
      if (process.env.NODE_ENV !== "production") {
        const counts = rows.reduce((acc, r) => {
          const has = Array.isArray(r?.eventTypes) && r.eventTypes.length > 0;
          acc[has ? "typed" : "untagged"] = (acc[has ? "typed" : "untagged"] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log("[children:typed breakdown]", rows.length, counts);
      }
      return rows.map(mapRowToUI);
    }
  } catch (_) {}

  // 3) FALLBACK B: last resort—no exclusion, just anything pointing to this festival
  try {
    const rows = await prisma.event.findMany({
      where: { parentFestivalId: festivalId },
      orderBy: [{ createdAt: "asc" as any }],
    });
    if (process.env.NODE_ENV !== "production") {
      const counts = rows.reduce((acc, r) => {
        const has = Array.isArray(r?.eventTypes) && r.eventTypes.length > 0;
        acc[has ? "typed" : "untagged"] = (acc[has ? "typed" : "untagged"] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log("[children:typed breakdown]", rows.length, counts);
    }
    return rows.map(mapRowToUI);
  } catch (_) {
    return [];
  }
}

function mapRowToUI(r: any) {
  return {
    id: r.id,
    title: String(r.title ?? r.name ?? ""),
    description: String(r.description ?? ""),
    startsAt: r.startDate ? new Date(r.startDate).toISOString()
           : r.startsAt  ? new Date(r.startsAt).toISOString()
           : null,
    endsAt:   r.endDate   ? new Date(r.endDate).toISOString()
           : r.endsAt    ? new Date(r.endsAt).toISOString()
           : null,
    city:  String(r.city ?? r.location ?? ""),
    venue: String(r.venue ?? ""),
    festivalId: r.parentFestivalId ?? r.festivalId ?? null,
    eventTypes: Array.isArray(r.eventTypes) ? r.eventTypes.map((t: any) => String(t)) : [],
    coverImageUrl: r.coverImageUrl ?? null,
  };
}

// Dev helper to assert the data path (optional)
export async function getFestivalChildrenCount(festivalId: string) {
  const count = await prisma.event.count({
    where: {
      parentFestivalId: festivalId,
      NOT: { eventTypes: { has: "FESTIVAL" as any } },
    },
  });
  return count;
} 