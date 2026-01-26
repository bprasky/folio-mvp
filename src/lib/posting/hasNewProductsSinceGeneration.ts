import { prisma } from "@/lib/prisma";

/**
 * Check if new products (ProductTags) have been added since the last post generation.
 * Used to prompt designers to regenerate their post after importing PDF specs.
 */
export async function hasNewProductsSinceGeneration(projectId: string): Promise<{
  hasNew: boolean;
  newCount: number;
  lastGeneratedAt: Date | null;
}> {
  // Get the ProjectPost to check last generation timestamp
  const post = await prisma.projectPost.findUnique({
    where: { projectId },
    select: { provenance: true }
  });

  // Extract generatedAt from provenance.interview.generatedAt
  const provenance = post?.provenance as { interview?: { generatedAt?: number } } | null;
  const generatedAtMs = provenance?.interview?.generatedAt;
  const lastGeneratedAt = generatedAtMs ? new Date(generatedAtMs) : null;

  // If post has never been generated, don't show the banner
  if (!lastGeneratedAt) {
    return { hasNew: false, newCount: 0, lastGeneratedAt: null };
  }

  // Count ProductTags created after last generation
  // ProductTags are linked to images which belong to the project
  const newTagCount = await prisma.productTag.count({
    where: {
      image: { projectId },
      createdAt: { gt: lastGeneratedAt }
    }
  });

  return {
    hasNew: newTagCount > 0,
    newCount: newTagCount,
    lastGeneratedAt
  };
}
