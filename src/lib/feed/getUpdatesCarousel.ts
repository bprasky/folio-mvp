import { prisma } from "@/lib/prisma";

export type UpdatesCarouselItem = {
  key: string; // `${designer.slug || designer.id}-${project.slug || project.id}`
  designer: { name: string | null; studioName: string | null; slug: string | null; logoUrl: string | null };
  project: { title: string | null; slug: string | null; id: string };
  items: Array<{
    id: string;
    type: "STORY" | "SHORT_VIDEO";
    title: string | null;
    description: string | null;
    publishedAt: Date | null;
    media: any; // [{ url, thumbnailUrl, poster, orientation, aspectRatio }]
  }>;
  cover: string | null; // thumbnail for the bubble
};

export async function getUpdatesCarousel(limitGroups = 12, perGroup = 5): Promise<UpdatesCarouselItem[]> {
  const rows = await prisma.projectModule.findMany({
    where: { publishedAt: { not: null }, type: { in: ["STORY", "SHORT_VIDEO"] as any } },
    orderBy: { publishedAt: "desc" },
    take: 200, // enough to form groups
    select: {
      id: true, type: true, title: true, description: true, media: true, publishedAt: true,
      project: {
        select: {
          id: true, title: true,
          designer: { select: { id: true, name: true, studio: true } },
          post: { select: { slug: true } },
        },
      },
    },
  });

  const groups = new Map<string, UpdatesCarouselItem>();

  for (const r of rows) {
    const designer = r.project?.designer || {};
    const project = { 
      id: r.project.id, 
      title: r.project.title, 
      slug: r.project.post?.slug || null 
    };
    const key = `${designer.id || "designer"}-${project.slug || project.id}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        designer: {
          name: designer.name || null,
          studioName: designer.studio || null,
          slug: designer.id || null, // Using id as slug fallback
          logoUrl: null, // Add profileImage if needed
        },
        project,
        items: [],
        cover: null,
      });
    }

    const g = groups.get(key)!;
    if (g.items.length < perGroup) {
      g.items.push({
        id: r.id,
        type: r.type as any,
        title: r.title || null,
        description: r.description || null,
        publishedAt: r.publishedAt,
        media: r.media,
      });

      // choose first available thumbnail as bubble cover
      if (!g.cover) {
        const m = Array.isArray(r.media) ? r.media[0] : r.media;
        g.cover = m?.thumbnailUrl || m?.poster || m?.url || null;
      }
    }
  }

  return Array.from(groups.values()).slice(0, limitGroups);
}


