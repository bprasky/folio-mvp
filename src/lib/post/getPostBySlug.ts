import { prisma } from "@/lib/prisma";
import { getProjectModules } from "@/lib/modules/getProjectModules";
import { publicFolioBlocks } from "@/lib/posting/publicFolioBlocks";
import { stripPrivateInterviewData } from "@/lib/spotlight/privacy";

export async function getPostBySlug(slug: string) {
  try {
    const post = await prisma.projectPost.findUnique({
      where: { slug },
      include: {
        project: {
          select: {
            id: true, title: true, description: true, city: true, regionState: true, isPublic: true,
            designerOrg: { select: { name: true } },
            designer: {
              select: {
                id: true,
                name: true,
                studio: true,
                profileImage: true,
                bio: true,
                website: true,
                instagram: true,
                linkedin: true,
              },
            },
            images: {
              where: { inclusion: 'INCLUDED' },
              select: {
                id: true, url: true, name: true, room: true, roomId: true, displayOrder: true,
                // Exclude tags pointing at pending/unclaimed products so they
                // don't leak onto the public post. Pending products are
                // designer- or import-created stubs awaiting vendor claim;
                // they often lack vendor, price, or canonical name and would
                // render as broken affordances on the public page.
                tags: {
                  where: { product: { isPending: false } },
                  include: {
                    product: {
                      include: {
                        vendor: {
                          select: {
                            id: true,
                            name: true,
                            companyName: true,
                            website: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        // Per-product, per-contributor commentary for the Product Bank
        supplementalQuotes: {
          select: {
            id: true,
            question: true,
            answer: true,
            contributorRole: true,
            userId: true,
            productTagId: true,
            pinned: true,
            displayLocation: true,
            source: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!post || post.status !== "PUBLISHED" || !post.project.isPublic) {
      return null;
    }

    const modules = await getProjectModules(post.projectId);

    // This object crosses into StoryRenderer's client props on the public page.
    return await stripPrivateInterviewData({
      ...post,
      // Raw answers, generation evidence and edit history are author-only.
      provenance: null,
      credits: Array.isArray(post.credits) ? post.credits.map(credit => {
        if (!credit || typeof credit !== 'object' || Array.isArray(credit)) return null;
        return Object.fromEntries(Object.entries(credit).filter(([key]) =>
          ['role', 'userId', 'name', 'profileImage', 'studio', 'url'].includes(key)));
      }).filter(Boolean) : null,
      sectionHistory: null,
      lastGenerationNote: null,
      expandedBlocks: publicFolioBlocks(post.expandedBlocks),
      modules,
    });
  } catch (error) {
    console.error("[getPostBySlug] Failed to fetch post:", slug, error);
    return null;
  }
}

