import { prisma } from "@/lib/prisma";
import { getProjectModules } from "@/lib/modules/getProjectModules";

/**
 * Fetches a ProjectPost for the staging/preview environment.
 * Same data shape as getPostBySlug but:
 * - Takes projectId instead of slug
 * - Does NOT gate on PUBLISHED status (shows drafts too)
 */
export async function getPostForStaging(projectId: string) {
  try {
    const post = await prisma.projectPost.findUnique({
      where: { projectId },
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

    if (!post) {
      return null;
    }

    let modules: any[] = [];
    try {
      modules = await getProjectModules(post.projectId);
    } catch {
      // Modules may not exist yet for drafts — that's fine
    }

    return {
      ...post,
      modules,
    };
  } catch (error) {
    console.error("[getPostForStaging] Failed to fetch post for project:", projectId, error);
    return null;
  }
}
