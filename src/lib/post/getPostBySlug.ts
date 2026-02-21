import { prisma } from "@/lib/prisma";
import { getProjectModules } from "@/lib/modules/getProjectModules";

export async function getPostBySlug(slug: string) {
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
              tags: {
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

  if (!post || post.status !== "PUBLISHED") {
    return null;
  }

  const modules = await getProjectModules(post.projectId);

  return {
    ...post,
    modules,
  };
}

