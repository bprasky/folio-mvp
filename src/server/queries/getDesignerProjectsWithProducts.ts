/**
 * DESIGNER PROFILE DATA MODEL
 * 
 * PROJECT RELATION SUMMARY:
 * - Project.id: Primary key (NOT projectId - Project table does NOT have projectId field)
 * - Project.designerId: Links to User.id via @relation("DesignerProjects")
 * - Project.ownerId: Links to User.id via @relation("OwnedProjects")
 * - User.designerProjects: Reverse relation from User to Projects where user is designer
 * - User.ownedProjects: Reverse relation from User to Projects where user is owner
 * - Join tables: ProjectParticipant (for explicit project membership)
 *   - ProjectParticipant.projectId: EXISTS (joins to Project.id)
 * 
 * IMPORTANT: Project model uses `id`, not `projectId`. Related tables (ProjectImage,
 * ProjectParticipant, Selection, etc.) have `projectId` fields that reference Project.id.
 * 
 * PUBLISHED PROJECT QUERY SUMMARY:
 * - A project is considered "published" if ANY of:
 *   - isPublic: true
 *   - publishedAt: { not: null }
 *   - status: 'published'
 * - Projects shown here are the same "published projects" used in the global/project feed
 * 
 * TAGGING RELATION SUMMARY:
 * - Table used: ProductTag
 * - Fields: productId (links to Product.id), imageId (links to ProjectImage.id)
 * - ProjectImage.projectId: Links ProductTag -> ProjectImage -> Project
 *   - ProjectImage.projectId references Project.id (not a field on Project itself)
 * - Product metadata joined via Product table (includes brand, price, imageUrl, etc.)
 * 
 * KNOWN FOR PRODUCTS:
 * - Derived from tagged products across this designer's published projects
 * - Aggregates ProductTag records linked to ProjectImages that belong to published Projects
 * - Groups by productId, counts occurrences, returns top 10 most-tagged products
 */

import { prisma } from '@/lib/prisma';

/**
 * Get published projects for a specific designer
 * Uses the same "published" filter as the public project feed
 */
export async function getDesignerPublishedProjects(designerId: string) {
  return prisma.project.findMany({
    where: {
      designerId,
      // Only return published projects (same filter as public feed)
      OR: [
        { isPublic: true },
        { publishedAt: { not: null } },
        { status: 'published' }
      ]
    },
    orderBy: [
      { publishedAt: 'desc' },
      { updatedAt: 'desc' }
    ],
    select: {
      id: true,
      title: true,
      // NOTE: Project model does NOT have a slug field (only ProjectPost has slug)
      description: true,
      category: true,
      isPublic: true,
      publishedAt: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      city: true,
      regionState: true,
      views: true,
      images: {
        take: 1,
        select: {
          id: true,
          url: true,
          projectId: true, // Foreign key on ProjectImage (not on Project)
        },
      },
    },
  });
}

/**
 * Get tagged products for a designer's published projects
 * Aggregates ProductTag records across all published project images
 */
export async function getTaggedProductsForDesigner(designerId: string) {
  try {
    // 1. Find all published project IDs for this designer
    const projects = await prisma.project.findMany({
      where: {
        designerId,
        // Only published projects (same filter as public feed)
        OR: [
          { isPublic: true },
          { publishedAt: { not: null } },
          { status: 'published' }
        ]
      },
      select: { id: true },
    });

    const projectIds = projects.map(p => p.id);
    if (projectIds.length === 0) {
      return [];
    }

    // 2. Get all product tags for images in these projects
    const productTags = await prisma.productTag.findMany({
    where: {
      image: {
        projectId: { in: projectIds }
      }
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
          brand: true,
          category: true,
          description: true,
        }
      },
      image: {
        select: {
          projectId: true,
        }
      }
    }
  });

  // 3. Aggregate by product ID (count occurrences)
  const productCounts = new Map<string, { 
    count: number; 
    product: typeof productTags[0]['product'];
    projectIds: Set<string>;
  }>();

  productTags.forEach(tag => {
    const existing = productCounts.get(tag.productId);
    if (existing) {
      existing.count += 1;
      existing.projectIds.add(tag.image.projectId);
    } else {
      productCounts.set(tag.productId, {
        count: 1,
        product: tag.product,
        projectIds: new Set([tag.image.projectId]),
      });
    }
  });

    // 4. Sort by count (most-tagged first) and return top 10
    const topProducts = Array.from(productCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(item => ({
        id: item.product.id,
        name: item.product.name,
        vendor: item.product.brand || 'Unknown Vendor',
        imageUrl: item.product.imageUrl,
        thumbnail: item.product.imageUrl,
        price: item.product.price,
        category: item.product.category,
        description: item.product.description,
        tagCount: item.count,
        projectCount: item.projectIds.size,
      }));

    return topProducts;
  } catch (error: any) {
    console.error('[getTaggedProductsForDesigner] Error:', {
      designerId,
      message: error?.message,
      stack: error?.stack,
    });
    // Return empty array on error instead of throwing
    return [];
  }
}

/**
 * Get project tag counts for display in project cards
 * Returns a map of projectId -> tag count
 */
export async function getProjectTagCounts(projectIds: string[]): Promise<Map<string, number>> {
  try {
    if (projectIds.length === 0) {
      return new Map();
    }

    const productTags = await prisma.productTag.findMany({
      where: {
        image: {
          projectId: { in: projectIds }
        }
      },
      select: {
        image: {
          select: {
            projectId: true,
          }
        }
      }
    });

    const tagCounts = new Map<string, number>();
    productTags.forEach(tag => {
      const projectId = tag.image.projectId;
      tagCounts.set(projectId, (tagCounts.get(projectId) || 0) + 1);
    });

    return tagCounts;
  } catch (error: any) {
    console.error('[getProjectTagCounts] Error:', {
      projectIdsCount: projectIds.length,
      message: error?.message,
      stack: error?.stack,
    });
    // Return empty map on error instead of throwing
    return new Map<string, number>();
  }
}
