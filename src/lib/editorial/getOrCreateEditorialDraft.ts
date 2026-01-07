import { prisma } from "@/lib/prisma";
import { generateEditorialDraft } from "@/lib/posting/generateEditorialDraft";
import { BlocksSchema, type Blocks } from "@/lib/posting/schemas";

/**
 * Get or create editorial draft for a published project
 * 
 * For published posts, we MUST have an editorial draft.
 * If one doesn't exist, we generate it server-side and persist it.
 * 
 * CANONICAL GUARDRAIL: Drafts created here are always stored with status: 'draft'.
 * - AI-generated content is assistive only; user remains author
 * - Never auto-publishes; requires explicit user action
 * - Per /docs/08_AI_ROLE.md: "AI improves clarity and speed, not authorship or judgment"
 */
export async function getOrCreateEditorialDraft(projectId: string): Promise<{
  blocks: Blocks;
  draftId: string | null;
  wasGenerated: boolean;
}> {
  // 🔍 DEBUG: Also check ProjectPost.expandedBlocks
  const projectPost = await prisma.projectPost.findUnique({
    where: { projectId },
    select: {
      id: true,
      status: true,
      expandedBlocks: true,
    },
  });

  console.log('[getOrCreateEditorialDraft] Checking data sources:', {
    projectId,
    hasProjectPost: !!projectPost,
    projectPostStatus: projectPost?.status,
    projectPostHasExpandedBlocks: !!projectPost?.expandedBlocks,
    projectPostExpandedBlocksKeys: projectPost?.expandedBlocks ? Object.keys(projectPost.expandedBlocks as any) : [],
    projectPostLeadKicker: (projectPost?.expandedBlocks as any)?.lead?.kicker,
    projectPostLeadDeck: (projectPost?.expandedBlocks as any)?.lead?.deck,
    projectPostGalleryChaptersCount: Array.isArray((projectPost?.expandedBlocks as any)?.galleryChapters)
      ? (projectPost.expandedBlocks as any).galleryChapters.length
      : 0,
  });

  // Try to fetch existing draft
  const existingDraft = await prisma.editorialDraft.findFirst({
    where: {
      projectId,
      status: { in: ['draft', 'published'] }, // Accept both draft and published status
    },
    orderBy: {
      version: 'desc', // Get latest version
    },
  });

  console.log('[getOrCreateEditorialDraft] EditorialDraft lookup:', {
    foundDraft: !!existingDraft,
    draftId: existingDraft?.id,
    draftStatus: existingDraft?.status,
    draftHasRawState: !!existingDraft?.rawState,
    draftRawStateKeys: existingDraft?.rawState ? Object.keys(existingDraft.rawState as any) : [],
  });

  // If draft exists and has rawState with blocks, use it
  if (existingDraft?.rawState) {
    try {
      const parsed = BlocksSchema.parse(existingDraft.rawState);
      console.log('[getOrCreateEditorialDraft] Using existing EditorialDraft (NOT ProjectPost.expandedBlocks)', {
        draftId: existingDraft.id,
        parsedKeys: Object.keys(parsed),
        leadKicker: parsed.lead?.kicker,
        leadDeck: parsed.lead?.deck,
        galleryChaptersCount: parsed.galleryChapters?.length || 0,
        // ⚠️ WARNING: ProjectPost.expandedBlocks exists but we're using EditorialDraft instead!
        projectPostHasExpandedBlocks: !!projectPost?.expandedBlocks,
      });
      return {
        blocks: parsed,
        draftId: existingDraft.id,
        wasGenerated: false,
      };
    } catch (error) {
      console.warn('[getOrCreateEditorialDraft] Failed to parse existing draft rawState', {
        draftId: existingDraft.id,
        error,
      });
      // Fall through to generation
    }
  }

  // Need to generate - fetch project data
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      designer: {
        select: {
          id: true,
          name: true,
          studio: true,
        },
      },
      images: {
        orderBy: { createdAt: 'asc' },
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
                    },
                  },
                },
              },
            },
          },
        },
      },
      rooms: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Build input for generateEditorialDraft
  // Note: Interview answers are optional - draft can be generated from project data, images, and tags alone
  const input = {
    project: {
      id: project.id,
      title: project.title || 'Untitled Project',
      description: project.description,
      city: project.city,
      regionState: project.regionState,
    },
    designer: project.designer ? {
      id: project.designer.id,
      name: project.designer.name || 'Designer',
      studio: project.designer.studio,
    } : undefined,
    vendors: [] as any[], // Can be populated if needed
    images: project.images.map(img => ({
      id: img.id,
      caption: img.name || undefined,
      room: img.room || undefined, // Include room for chapter grouping
    })),
    tags: project.images.flatMap(img =>
      img.tags.map(tag => ({
        id: tag.id,
        productId: tag.productId,
        product: tag.product ? {
          id: tag.product.id,
          name: tag.product.name,
          vendor: tag.product.vendor ? {
            id: tag.product.vendor.id,
            name: tag.product.vendor.name || tag.product.vendor.companyName || 'Vendor',
          } : undefined,
        } : undefined,
      }))
    ),
    answers: [] as any[], // Interview answers not available - draft will be generated from project data
    followups: [] as any[], // Can be populated if needed
    imageOrder: project.images.map(img => img.id),
    correlationId: `published-${projectId}`,
  };

  // Generate draft
  let blocks: Blocks;
  let usedFallback: boolean;
  
  try {
    const result = await generateEditorialDraft(input);
    blocks = result.blocks;
    usedFallback = result.usedFallback;
  } catch (error) {
    console.error('[getOrCreateEditorialDraft] Generation failed', {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Return minimal fallback blocks
    blocks = {
      lead: {
        deck: project.description || `A curated look at ${project.title || 'this project'}.`,
      },
      galleryChapters: project.images.length > 0 ? [{
        title: project.title || 'Project Feature',
        body: [project.description || 'A thoughtfully designed space.'],
        imageIds: project.images.slice(0, 4).map(img => img.id),
      }] : undefined,
    };
    usedFallback = true;
  }

  // Persist draft to database
  try {
    const draft = await prisma.editorialDraft.create({
      data: {
        projectId,
        status: 'draft',
        title: blocks.lead?.kicker || project.title || undefined,
        subtitle: blocks.lead?.deck || undefined,
        rawState: blocks as any, // Store blocks as JSON
        version: 1,
      },
    });

    return {
      blocks,
      draftId: draft.id,
      wasGenerated: true,
    };
  } catch (error) {
    console.error('[getOrCreateEditorialDraft] Failed to persist draft', {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Return blocks even if persistence failed
    return {
      blocks,
      draftId: null,
      wasGenerated: true,
    };
  }
}

