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

