// @idor-allow: public-read reason="Public published project post viewable anonymously by slug"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRelatedProjects } from "@/lib/article/getRelatedProjects";
import { getProjectModules } from "@/lib/modules/getProjectModules";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;

    // Fetch post with project
    const post = await prisma.projectPost.findUnique({
      where: { slug },
      include: {
        project: {
          include: {
            designer: {
              select: {
                id: true,
                name: true,
                profileImage: true,
                bio: true,
                studio: true,
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

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    // Only return if PUBLISHED
    if (post.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    const { project } = post;

    // Derive materials ledger if not in expandedBlocks
    let materialsLedger: any[] = [];
    if (post.expandedBlocks && typeof post.expandedBlocks === "object") {
      const blocks = post.expandedBlocks as any;
      if (blocks.materialsLedger?.items && Array.isArray(blocks.materialsLedger.items)) {
        materialsLedger = blocks.materialsLedger.items;
      }
    }

    // If no explicit ledger, derive from ProductTags
    if (materialsLedger.length === 0) {
      const productMap = new Map<string, {
        productId: string;
        name: string;
        finish?: string;
        vendorId?: string;
        vendorName?: string;
        note?: string;
      }>();

      for (const image of project.images) {
        for (const tag of image.tags) {
          const product = tag.product;
          if (!productMap.has(product.id)) {
            productMap.set(product.id, {
              productId: product.id,
              name: product.name,
              vendorId: product.vendorId || undefined,
              vendorName: product.vendor?.name || product.vendor?.companyName || undefined,
            });
          }
        }
      }

      materialsLedger = Array.from(productMap.values());
    }

    // Extract unique vendors
    const vendors = new Map<string, any>();
    for (const image of project.images) {
      for (const tag of image.tags) {
        const vendor = tag.product.vendor;
        if (vendor && !vendors.has(vendor.id)) {
          vendors.set(vendor.id, vendor);
        }
      }
    }

    // Get hero image
    const heroImage = post.heroAssetId
      ? project.images.find(img => img.id === post.heroAssetId)
      : project.images[0];

    // Build payload
    const payload = {
      post: {
        id: post.id,
        status: post.status,
        variant: post.variant,
        slug: post.slug,
        excerpt: post.excerpt,
        keywords: post.keywords,
        expandedBlocks: post.expandedBlocks,
        provenance: post.provenance,
        credits: post.credits,
        publishedAt: post.publishedAt,
      },
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        city: project.city,
        regionState: project.regionState,
        projectType: project.projectType,
        clientType: project.clientType,
        budgetBand: project.budgetBand,
      },
      heroImage: heroImage ? {
        id: heroImage.id,
        url: heroImage.url,
        name: heroImage.name,
      } : null,
      images: project.images.map(img => ({
        id: img.id,
        url: img.url,
        name: img.name,
        room: img.room,
        tags: img.tags.map(tag => ({
          id: tag.id,
          x: tag.x,
          y: tag.y,
          product: {
            id: tag.product.id,
            name: tag.product.name,
            description: tag.product.description,
            price: tag.product.price,
            imageUrl: tag.product.imageUrl,
            category: tag.product.category,
            brand: tag.product.brand,
            url: tag.product.url,
          },
        })),
      })),
      tags: project.images.flatMap(img =>
        img.tags.map(tag => ({
          id: tag.id,
          imageId: img.id,
          productId: tag.product.id,
          productName: tag.product.name,
        }))
      ),
      products: Array.from(
        new Map(
          project.images.flatMap(img =>
            img.tags.map(tag => [tag.product.id, tag.product])
          )
        ).values()
      ).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        imageUrl: p.imageUrl,
        category: p.category,
        brand: p.brand,
        url: p.url,
      })),
      designer: project.designer,
      vendors: Array.from(vendors.values()),
      derivedMaterialsLedger: materialsLedger,
      relatedProjects: await getRelatedProjects(project.id, project.designerId),
      modules: await getProjectModules(project.id),
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("[posting/[slug]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
