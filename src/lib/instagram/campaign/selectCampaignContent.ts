import { prisma } from "@/lib/prisma";
import { extractRoomTeasers } from "@/lib/instagram/roomTeasers";
import { BlocksSchema } from "@/lib/posting/schemas";
import { resolvePublishingStudioContext, StudioAccessError } from '@/lib/publishing-studio/data';

export type CampaignPreset = "compact" | "standard" | "complete" | "custom";

export interface CampaignContentSelection {
  preset: CampaignPreset;
  totalPosts: number;
  projectTitle: string;
  designerName: string;
  imagesById: Record<string, { url: string }>;
  launch: {
    enabled: true;
    heroImageId: string;
  };
  rooms: Array<{
    name: string;
    imageIds: string[];
    imageCount: number;
    teaser?: { text: string; authorship: 'verbatim' | 'folio' };
    suggested: boolean; // Auto-selected for this preset
  }>;
  products: Array<{
    id: string;
    name: string;
    brand: string;
    imageId: string; // Image where product is tagged
    suggested: boolean;
  }>;
  quotes: Array<{
    text: string;
    authorship: 'verbatim' | 'folio';
    imageId?: string; // Optional: image to pair with
    suggested: boolean;
  }>;
  details: Array<{
    imageId: string;
    caption: string;
  }>;
  closer: {
    enabled: true;
    imageId: string;
  };
}

/**
 * Analyzes project data and returns auto-curated content selection
 * based on the chosen preset (compact/standard/complete)
 */
export async function selectCampaignContent(
  projectId: string,
  preset: CampaignPreset,
  userId: string
): Promise<CampaignContentSelection> {
  const workspace = await resolvePublishingStudioContext(userId);
  // Fetch project with all relevant data
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      designer: {
        select: { name: true, studio: true },
      },
      rooms: { select: { id: true, name: true } },
      images: {
        where: { inclusion: 'INCLUDED' },
        include: {
          tags: {
            where: { reviewedAt: { not: null }, product: { isPending: false } },
            include: {
              product: {
                include: {
                  vendor: true,
                },
              },
            },
          },
        },
        orderBy: {
          displayOrder: "asc",
        },
      },
      post: {
        select: {
          expandedBlocks: true,
          status: true,
          heroAssetId: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const inWorkspace = workspace.id
    ? workspace.canWriteCampaigns && project.designerOrgId === workspace.id
    : !project.designerOrgId && (project.ownerId === userId || project.designerId === userId);
  if (!inWorkspace) throw new StudioAccessError('Project is not available in this workspace', 403);
  if (!project.isPublic || project.post?.status !== 'PUBLISHED') {
    throw new Error('CAMPAIGN_INELIGIBLE: Publish this project before building a campaign.');
  }
  const images = project.images.filter(image => image.inclusion === 'INCLUDED');
  if (images.length === 0) {
    throw new Error(
      'CAMPAIGN_INELIGIBLE: This project has no images yet. Add images before generating an Instagram campaign.'
    );
  }
  const heroImage = images.find(image => image.id === project.post?.heroAssetId) || images[0];

  // Group images by room
  const imagesByRoom = new Map<string, typeof images>();
  images.forEach((img) => {
    const name = img.roomId ? project.rooms.find(room => room.id === img.roomId)?.name : img.room;
    if (name) {
      const existing = imagesByRoom.get(name) || [];
      imagesByRoom.set(name, [...existing, img]);
    }
  });

  const parsedBlocks = BlocksSchema.pick({ galleryChapters: true, pullQuotes: true })
    .passthrough().safeParse(project.post?.expandedBlocks);
  const roomTeasers = extractRoomTeasers(parsedBlocks.success ? parsedBlocks.data : undefined);

  // Extract rooms with image counts
  // The legacy room renderer requires three source photographs.
  const allRooms = Array.from(imagesByRoom.entries()).filter(([, imgs]) => imgs.length >= 3).map(([name, imgs]) => ({
    name,
    imageIds: imgs.map((i) => i.id),
    imageCount: imgs.length,
    teaser: roomTeasers.find(teaser => teaser.imageIds?.some(id => imgs.some(image => image.id === id))),
    suggested: false, // Will be set based on preset
  }));

  // Sort rooms by image count (most images first)
  allRooms.sort((a, b) => b.imageCount - a.imageCount);

  // Extract unique products (complete data only)
  const productMap = new Map<
    string,
    {
      id: string;
      name: string;
      brand: string;
      imageId: string;
    }
  >();

  images.forEach((img) => {
    img.tags.forEach((tag) => {
      if (tag.reviewedAt && tag.product && !tag.product.isPending && tag.product.name && tag.product.vendor) {
        const productId = tag.product.id;
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            id: productId,
            name: tag.product.name,
            brand: tag.product.vendor.companyName || tag.product.vendor.name,
            imageId: img.id,
          });
        }
      }
    });
  });

  const allProducts = Array.from(productMap.values()).map((p) => ({
    ...p,
    suggested: false,
  }));

  // These formats have no image renderer yet; never advertise absent ZIP posts.
  const allQuotes: CampaignContentSelection['quotes'] = [];
  const detailImages: CampaignContentSelection['details'] = [];

  // Apply preset-based curation
  let selectedRoomCount = 0;
  let selectedProductCount = 0;
  let selectedQuoteCount = 0;
  let includeDetails = false;

  switch (preset) {
    case "compact":
      // Compact: 2 best rooms, no products/quotes
      selectedRoomCount = Math.min(2, allRooms.length);
      selectedProductCount = 0;
      selectedQuoteCount = 0;
      includeDetails = false;
      break;

    case "standard":
      // Standard: All rooms, 2-3 products, 1-2 quotes
      selectedRoomCount = allRooms.filter((r) => r.imageCount >= 3).length;
      selectedProductCount = Math.min(3, allProducts.length);
      selectedQuoteCount = Math.min(2, allQuotes.length);
      includeDetails = false;
      break;

    case "complete":
      // Complete: Everything
      selectedRoomCount = allRooms.length;
      selectedProductCount = allProducts.length;
      selectedQuoteCount = allQuotes.length;
      includeDetails = true;
      break;

    case "custom":
      // Custom: Nothing auto-selected, user chooses
      selectedRoomCount = 0;
      selectedProductCount = 0;
      selectedQuoteCount = 0;
      includeDetails = false;
      break;
  }

  // Mark suggested items
  allRooms.forEach((room, idx) => {
    room.suggested = idx < selectedRoomCount;
  });

  allProducts.forEach((product, idx) => {
    product.suggested = idx < selectedProductCount;
  });

  allQuotes.forEach((quote, idx) => {
    quote.suggested = idx < selectedQuoteCount;
  });

  // Calculate total posts
  const totalPosts =
    2 + // launch + closer
    allRooms.filter((r) => r.suggested).length +
    allProducts.filter((p) => p.suggested).length +
    allQuotes.filter((q) => q.suggested).length +
    (includeDetails ? detailImages.length : 0);

  const imagesById: Record<string, { url: string }> = {};
  for (const img of images) {
    imagesById[img.id] = { url: img.url };
  }

  return {
    preset,
    totalPosts,
    projectTitle: project.title,
    designerName: project.designer?.studio || project.designer?.name || 'Designer',
    imagesById,
    launch: {
      enabled: true,
      heroImageId: heroImage.id,
    },
    rooms: allRooms,
    products: allProducts,
    quotes: allQuotes,
    details: includeDetails ? detailImages : [],
    closer: {
      enabled: true,
      imageId: images[Math.min(1, images.length - 1)].id, // Second image or first if only one
    },
  };
}
