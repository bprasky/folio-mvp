// src/lib/magazine/getMagazineData.ts
//
// Magazine Data Layer
//
// Fetches and assembles data for a magazine edition:
// - Hero project/post (featured editorial)
// - Hero products (products from featured project)
// - Mosaic items (remaining projects/posts for grid)
//
// TODO: Replace heuristic scoring with AI/editorial engine based on:
// - User engagement metrics
// - Style tags (when available in schema)
// - Location-based filtering (for "local" edition)
// - Personalization signals (for "for-you" edition)

import { getEditionConfig, type MagazineEditionConfig } from "./editions";
import { prisma } from "@/lib/prisma";

export interface MagazineHero {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  designerName?: string;
  locationLabel?: string;
  projectTitle?: string; // Project title for routing decisions
  postSlug?: string | null; // Post slug for routing to published articles
  // any other fields you need for the editorial hero
}

export interface MagazineProduct {
  id: string;
  name: string;
  imageUrl?: string | null;
  cutoutImageUrl?: string | null;
  vendorName?: string | null;
  // etc.
}

export interface MagazineMosaicItem {
  id: string;
  type: "project" | "post" | "product";
  title: string;
  imageUrl: string;
  publishedAt?: Date | null;
  isEditorial?: boolean; // true for Editor's Picks, false for For You
  projectTitle?: string; // Project title for routing decisions
  postSlug?: string | null; // Post slug for routing to published articles
  // add fields as needed for mosaic layout
}

export interface MagazineData {
  edition: MagazineEditionConfig;
  hero: MagazineHero | null;
  heroProducts: MagazineProduct[];
  mosaicItems: MagazineMosaicItem[];
}

export async function getMagazineData(
  editionSlug: string,
  userId?: string | null
): Promise<MagazineData> {
  const edition = getEditionConfig(editionSlug);

  // Fetch published project posts (similar to getPublishedProjectPosts)
  // This mirrors the existing feed logic
  const posts = await prisma.projectPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 40,
    select: {
      id: true,
      slug: true,
      publishedAt: true,
      heroAssetId: true,
      excerpt: true,
      expandedBlocks: true,
      project: {
        select: {
          id: true,
          title: true,
          city: true,
          regionState: true,
          images: {
            select: {
              id: true,
              url: true,
              // Also fetch product tags from images for cutout display
              tags: {
                select: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      imageUrl: true,
                      cutoutImageUrl: true,
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
            take: 10, // Increased to get more products
            orderBy: {
              createdAt: "asc",
            },
          },
          designer: {
            select: {
              id: true,
              name: true,
              studio: true,
              location: true,
            },
          },
          // Also fetch products from selections
          selections: {
            select: {
              vendorProductId: true,
            },
            where: {
              vendorProductId: { not: null },
            },
            take: 10,
          },
        },
      },
    },
  });

  if (posts.length === 0) {
    return {
      edition,
      hero: null,
      heroProducts: [],
      mosaicItems: [],
    };
  }

  // Prefer "Meru" project if it exists (for demo content)
  // Search by project title, ID, or slug containing "meru"
  const meruPost =
    posts.find((p) => {
      const title = (p.project?.title ?? "").toLowerCase();
      const id = (p.project?.id ?? "").toLowerCase();
      const slug = (p.slug ?? "").toLowerCase();
      return title.includes("meru") || id.includes("meru") || slug.includes("meru");
    }) ?? null;

  // For demo: force Meru as hero for Global + Modern if found
  // Otherwise prefer Meru for "for-you" and "modern" editions
  let heroPost = posts[0];
  if (meruPost && (edition.slug === "global" || edition.slug === "modern" || edition.slug === "for-you")) {
    heroPost = meruPost;
  } else if (meruPost && !posts[0]) {
    // Fallback to Meru if no other posts
    heroPost = meruPost;
  }

  // Resolve hero image with multiple fallbacks
  // 1. Try heroAssetId image
  // 2. Try first project image
  // 3. Try any image from the project
  const heroImageObj = heroPost.heroAssetId
    ? heroPost.project?.images?.find((img) => img.id === heroPost.heroAssetId)
    : null;
  
  const heroImageUrl = heroImageObj?.url 
    ?? heroPost.project?.images?.[0]?.url 
    ?? heroPost.project?.images?.find((img) => img.url && img.url.length > 0)?.url
    ?? "";

  // Extract editorial context from expandedBlocks (same as getPublishedProjectPosts)
  const blocks = heroPost.expandedBlocks as any;
  const editorialTitle =
    blocks?.lead?.title ?? blocks?.lead?.kicker ?? heroPost.project?.title ?? "Untitled Project";
  const editorialDeck = blocks?.lead?.deck ?? heroPost.excerpt ?? undefined;

  // Build hero (use project ID for linking)
  // Ensure we have a real image URL - if no image found, return null so skeleton shows
  const hero: MagazineHero | null = heroPost.project?.id && heroImageUrl
    ? {
        id: heroPost.project.id,
        title: editorialTitle,
        subtitle: editorialDeck ?? heroPost.project?.city ?? undefined,
        imageUrl: heroImageUrl, // Guaranteed to have a real image URL
        designerName: heroPost.project?.designer?.studio ?? heroPost.project?.designer?.name ?? undefined,
        locationLabel: heroPost.project?.city ?? heroPost.project?.regionState ?? undefined,
        projectTitle: heroPost.project?.title ?? undefined,
        postSlug: heroPost.slug ?? null,
      }
    : null;

  // Hero products: products from the hero project
  // Fetch from all sources (matching generate-2d-cutouts logic):
  // 1. ProductTag (tags on project images)
  // 2. Selections (products selected in rooms)
  const productMap = new Map<string, MagazineProduct>();

  // 1. Add products from ProductTag (via images)
  if (heroPost.project?.images) {
    for (const image of heroPost.project.images) {
      if (image.tags) {
        for (const tag of image.tags) {
          if (tag.product && !productMap.has(tag.product.id)) {
            productMap.set(tag.product.id, {
              id: tag.product.id,
              name: tag.product.name,
              imageUrl: tag.product.imageUrl ?? null,
              cutoutImageUrl: tag.product.cutoutImageUrl ?? null,
              vendorName: tag.product.vendor?.name ?? tag.product.vendor?.companyName ?? null,
            });
          }
        }
      }
    }
  }

  // 2. Add products from Selections (fetch by vendorProductId)
  if (heroPost.project?.selections && heroPost.project.selections.length > 0) {
    const selectionProductIds = heroPost.project.selections
      .map((s) => s.vendorProductId)
      .filter((id): id is string => id !== null);
    
    if (selectionProductIds.length > 0) {
      const selectionProducts = await prisma.product.findMany({
        where: { id: { in: selectionProductIds } },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          cutoutImageUrl: true,
          vendor: {
            select: {
              id: true,
              name: true,
              companyName: true,
            },
          },
        },
      });

      for (const product of selectionProducts) {
        if (!productMap.has(product.id)) {
          productMap.set(product.id, {
            id: product.id,
            name: product.name,
            imageUrl: product.imageUrl ?? null,
            cutoutImageUrl: product.cutoutImageUrl ?? null,
            vendorName: product.vendor?.name ?? product.vendor?.companyName ?? null,
          });
        }
      }
    }
  }

  const heroProducts: MagazineProduct[] = Array.from(productMap.values());

  // Debug logging to verify cutout data
  if (heroProducts.length > 0) {
    const cutoutCount = heroProducts.filter((p) => p.cutoutImageUrl).length;
    console.log('[MAGAZINE] Hero products loaded:', {
      projectId: heroPost.project?.id,
      totalProducts: heroProducts.length,
      productsWithCutouts: cutoutCount,
      productIds: heroProducts.map((p) => p.id),
      cutoutProductIds: heroProducts.filter((p) => p.cutoutImageUrl).map((p) => p.id),
    });
  }

  // Mosaic items: remaining posts (excluding hero)
  const mosaicItems: MagazineMosaicItem[] = posts
    .filter((p) => p.id !== heroPost.id && p.project?.id)
    .map((post) => {
      const mosaicImageObj = post.heroAssetId
        ? post.project?.images?.find((img) => img.id === post.heroAssetId)
        : post.project?.images?.[0];
      const mosaicImageUrl = mosaicImageObj?.url ?? "";
      const blocks = post.expandedBlocks as any;
      const title =
        blocks?.lead?.title ?? blocks?.lead?.kicker ?? post.project?.title ?? "Untitled Project";

      return {
        id: post.project!.id, // Use project ID for linking
        type: "project" as const,
        title,
        imageUrl: mosaicImageUrl,
        publishedAt: post.publishedAt ?? null,
        isEditorial: true, // TODO: Determine based on editorial scoring/curation
        projectTitle: post.project?.title ?? undefined,
        postSlug: post.slug ?? null,
      };
    })
    .filter((item) => item.imageUrl); // Only include items with images

  return {
    edition,
    hero,
    heroProducts,
    mosaicItems,
  };
}

