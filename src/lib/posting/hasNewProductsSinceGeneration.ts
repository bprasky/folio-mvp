import { prisma } from '@/lib/prisma';

interface NewProductsResult {
  hasNew: boolean;
  newCount: number;
  newestProductAt: Date | null;
  lastGeneratedAt: Date | null;
}

interface ProvenanceShape {
  interview?: {
    generatedAt?: number; // Unix timestamp in milliseconds
  };
}

/**
 * Checks if new products have been tagged since the last post generation.
 *
 * This is used to prompt designers to regenerate their editorial post
 * after importing new products (e.g., from PDF import).
 *
 * @param projectId - The project ID to check
 * @returns Object containing:
 *   - hasNew: true if new products exist since last generation
 *   - newCount: number of new product tags
 *   - newestProductAt: timestamp of most recent product tag
 *   - lastGeneratedAt: timestamp of last post generation
 */
export async function hasNewProductsSinceGeneration(
  projectId: string
): Promise<NewProductsResult> {
  // 1. Get the ProjectPost
  const post = await prisma.projectPost.findUnique({
    where: { projectId },
    select: { provenance: true },
  });

  // 2. If no post exists, nothing to update
  if (!post) {
    return {
      hasNew: false,
      newCount: 0,
      newestProductAt: null,
      lastGeneratedAt: null
    };
  }

  // 3. Extract generatedAt from provenance
  const provenance = post.provenance as ProvenanceShape | null;
  const generatedAtMs = provenance?.interview?.generatedAt;
  const lastGeneratedAt = generatedAtMs
    ? new Date(generatedAtMs)
    : null;

  // 4. Get all ProjectImage IDs for this project
  const projectImages = await prisma.projectImage.findMany({
    where: { projectId },
    select: { id: true },
  });

  // If no images, no tags possible
  if (projectImages.length === 0) {
    return {
      hasNew: false,
      newCount: 0,
      newestProductAt: null,
      lastGeneratedAt
    };
  }

  const imageIds = projectImages.map((img) => img.id);

  // 5. Build the where clause for ProductTags
  // If no generatedAt exists, treat ALL products as new (post exists but never generated)
  const whereClause = {
    imageId: { in: imageIds },
    ...(lastGeneratedAt && { createdAt: { gt: lastGeneratedAt } }),
  };

  // 6. Count new ProductTags and find the newest one
  const [newCount, newestTag] = await Promise.all([
    prisma.productTag.count({ where: whereClause }),
    prisma.productTag.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  return {
    hasNew: newCount > 0,
    newCount,
    newestProductAt: newestTag?.createdAt ?? null,
    lastGeneratedAt,
  };
}
