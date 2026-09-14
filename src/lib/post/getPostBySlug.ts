import { prisma } from "@/lib/prisma";
import { getProjectModules } from "@/lib/modules/getProjectModules";
import { publicFolioBlocks } from "@/lib/posting/publicFolioBlocks";

export async function getPostBySlug(slug: string) {
  try {
    const post = await prisma.projectPost.findUnique({
      where: { slug },
      include: {
        project: {
          include: {
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
              include: {
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

    return {
      ...post,
      expandedBlocks: publicFolioBlocks(post.expandedBlocks),
      modules,
    };
  } catch (error) {
    console.error("[getPostBySlug] Failed to fetch post:", slug, error);
    return null;
  }
}

