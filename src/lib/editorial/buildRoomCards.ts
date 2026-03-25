import { formatRoomName } from "@/lib/utils/formatRoomName";
import { slugify } from "@/lib/urls";
import { getSelectedPullQuoteText } from "@/lib/posting/schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoryProductData {
  id: string;
  name: string;
  slug?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  vendor?: { name?: string; companyName?: string; website?: string };
  // Tag-level data (position on image)
  tagId: string;
  x?: number;
  y?: number;
  xPercent?: number;
  yPercent?: number;
  cropUrl?: string;
}

export interface RoomCardData {
  roomId: string;
  roomLabel: string;
  roomSlug: string;
  heroImage: { id: string; url: string; tags?: any[] };
  pullQuote: string | null;
  editorialExcerpt: string | null;
  products: StoryProductData[];
  productCount: number;
  additionalImages: { id: string; url: string; tags?: any[] }[];
  /** Index within the story (for nav) */
  index: number;
}

export interface StoryData {
  title: string;
  subtitle: string | null;
  slug: string;
  heroImage: { id: string; url: string; tags?: any[] } | null;
  projectPullQuote: string | null;
  designer: {
    name: string;
    studio: string | null;
    profileImage: string | null;
    instagram: string | null;
  } | null;
  roomCards: RoomCardData[];
  roomCount: number;
  topVendors: string[];
  supplementalQuotes: any[];
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildRoomCards(post: any): StoryData {
  const project = post?.project;
  const designer = project?.designer;
  const expandedBlocks = post?.expandedBlocks;
  const projectImages: any[] = project?.images ?? [];

  // Build image lookup map
  const imageMap = new Map<string, any>(
    projectImages.map((img: any) => [img.id, img])
  );

  // Track which imageIds are assigned to chapters
  const assignedImageIds = new Set<string>();

  // Parse gallery chapters into room cards
  const chaptersRaw: any[] =
    expandedBlocks?.galleryChapters && Array.isArray(expandedBlocks.galleryChapters)
      ? expandedBlocks.galleryChapters
      : [];

  const roomCards: RoomCardData[] = [];

  for (let idx = 0; idx < chaptersRaw.length; idx++) {
    const ch = chaptersRaw[idx];

    // Resolve images
    const imageIds: string[] = Array.isArray(ch.imageIds) ? ch.imageIds : [];
    const images = imageIds.map((id: string) => imageMap.get(id)).filter(Boolean);

    // Skip chapters with no images
    if (images.length === 0) continue;

    // Track assigned images
    imageIds.forEach((id) => assignedImageIds.add(id));

    const [heroImage, ...additionalImages] = images;

    // Room label and slug
    const rawTitle = ch.title ?? `Room ${idx + 1}`;
    const roomLabel = formatRoomName(rawTitle);
    const roomSlug = slugify(rawTitle);

    // Pull quote
    const pullQuote = getSelectedPullQuoteText(ch.pullQuote) ?? null;

    // Editorial excerpt (body can be string or string[])
    let editorialExcerpt: string | null = null;
    if (ch.body) {
      editorialExcerpt = Array.isArray(ch.body) ? ch.body.join("\n\n") : ch.body;
    } else if (ch.narrative) {
      editorialExcerpt = ch.narrative;
    }

    // Extract products from all chapter images
    const products = extractProducts(images);

    roomCards.push({
      roomId: ch.id ?? `room-${idx}`,
      roomLabel,
      roomSlug,
      heroImage: { id: heroImage.id, url: heroImage.url, tags: heroImage.tags },
      pullQuote,
      editorialExcerpt,
      products,
      productCount: products.length,
      additionalImages: additionalImages.map((img: any) => ({
        id: img.id,
        url: img.url,
        tags: img.tags,
      })),
      index: roomCards.length,
    });
  }

  // Catch-all: unroomed images not assigned to any chapter
  const unroomedImages = projectImages.filter(
    (img: any) => !assignedImageIds.has(img.id)
  );
  if (unroomedImages.length > 0) {
    const [heroImage, ...additionalImages] = unroomedImages;
    const products = extractProducts(unroomedImages);
    roomCards.push({
      roomId: "details",
      roomLabel: "Details",
      roomSlug: "details",
      heroImage: { id: heroImage.id, url: heroImage.url, tags: heroImage.tags },
      pullQuote: null,
      editorialExcerpt: null,
      products,
      productCount: products.length,
      additionalImages: additionalImages.map((img: any) => ({
        id: img.id,
        url: img.url,
        tags: img.tags,
      })),
      index: roomCards.length,
    });
  }

  // Best pull quote for hero (Layer 0)
  const projectPullQuote = resolveProjectPullQuote(expandedBlocks, roomCards);

  // Hero image: heroAssetId match, or first project image
  const heroAssetId = post?.heroAssetId;
  const heroImage = heroAssetId
    ? imageMap.get(heroAssetId) ?? projectImages[0]
    : projectImages[0];

  // Top vendors (unique, max 3)
  const topVendors = extractTopVendors(roomCards, 3);

  return {
    title: project?.title ?? "Untitled Project",
    subtitle: expandedBlocks?.lead?.deck ?? project?.description ?? null,
    slug: post?.slug ?? "",
    heroImage: heroImage
      ? { id: heroImage.id, url: heroImage.url, tags: heroImage.tags }
      : null,
    projectPullQuote,
    designer: designer
      ? {
          name: designer.name ?? "",
          studio: designer.studio ?? null,
          profileImage: designer.profileImage ?? null,
          instagram: designer.instagram ?? null,
        }
      : null,
    roomCards,
    roomCount: roomCards.length,
    topVendors,
    supplementalQuotes: post?.supplementalQuotes ?? [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractProducts(images: any[]): StoryProductData[] {
  const seen = new Set<string>();
  const products: StoryProductData[] = [];

  for (const img of images) {
    if (!img?.tags || !Array.isArray(img.tags)) continue;
    for (const tag of img.tags) {
      const product = tag?.product;
      if (!product || seen.has(product.id)) continue;
      seen.add(product.id);
      products.push({
        id: product.id,
        name: product.name ?? "Unnamed Product",
        slug: product.slug,
        imageUrl: product.primaryImageUrl ?? product.imageUrl ?? product.thumbnailUrl,
        thumbnailUrl: product.thumbnailUrl ?? product.imageUrl,
        vendor: product.vendor
          ? {
              name: product.vendor.name,
              companyName: product.vendor.companyName,
              website: product.vendor.website,
            }
          : undefined,
        tagId: tag.id,
        x: tag.x,
        y: tag.y,
        xPercent: tag.xPercent,
        yPercent: tag.yPercent,
        cropUrl: tag.cropUrl,
      });
    }
  }

  return products;
}

function resolveProjectPullQuote(
  expandedBlocks: any,
  roomCards: RoomCardData[]
): string | null {
  // Try top-level pullQuotes array first
  const topLevel = expandedBlocks?.pullQuotes;
  if (Array.isArray(topLevel) && topLevel.length > 0) {
    const first = topLevel[0];
    if (typeof first === "string") return first;
    if (first?.text) return first.text;
  }

  // Fallback: first room card's pull quote
  for (const card of roomCards) {
    if (card.pullQuote) return card.pullQuote;
  }

  return null;
}

function extractTopVendors(roomCards: RoomCardData[], max: number): string[] {
  const vendorCounts = new Map<string, number>();

  for (const card of roomCards) {
    for (const product of card.products) {
      const vendorName =
        product.vendor?.companyName ?? product.vendor?.name;
      if (vendorName) {
        vendorCounts.set(vendorName, (vendorCounts.get(vendorName) ?? 0) + 1);
      }
    }
  }

  return Array.from(vendorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([name]) => name);
}
