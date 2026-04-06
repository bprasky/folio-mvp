/**
 * Get designer's Sourcebook entries
 * Adapts the ProductTag aggregation from getDesignerVendorDirectory
 * with LEFT JOIN to sourcebook_entries for notes/archived state
 */

import { prisma } from '@/lib/prisma';
import { normalizeVendorName } from '@/lib/vendor/inviteCandidates';
import type { SourcebookEntry } from '@/types/sourcebook';

/**
 * Get all products in designer's Sourcebook across all projects.
 * Products enter via ProductTag aggregation; SourcebookEntry rows are lazy-created
 * only when the designer adds notes or archives a product.
 */
export async function getSourcebookEntries(
  designerId: string,
  includeArchived: boolean = false
): Promise<SourcebookEntry[]> {
  try {
    // 1. Get all project IDs for this designer
    const projects = await prisma.project.findMany({
      where: { designerId },
      select: { id: true },
    });

    const projectIds = projects.map(p => p.id);
    if (projectIds.length === 0) return [];

    // 2. Get all product tags for images in these projects
    const productTags = await prisma.productTag.findMany({
      where: {
        image: {
          projectId: { in: projectIds },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            category: true,
            imageUrl: true,
          },
        },
        image: {
          select: {
            url: true,
            projectId: true,
            room: true,
            project: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (productTags.length === 0) return [];

    // 3. Aggregate by product ID
    const productMap = new Map<string, {
      product: typeof productTags[0]['product'];
      projects: Map<string, {
        projectId: string;
        projectTitle: string;
        roomName: string | null;
      }>;
      lastUsedAt: Date;
      tagCount: number;
      // Best project tag image (most recent tag with a valid image URL)
      bestTagImage: { url: string; x: number; y: number; createdAt: Date } | null;
    }>();

    productTags.forEach(tag => {
      const existing = productMap.get(tag.productId);
      const projectKey = `${tag.image.projectId}-${tag.image.room || 'no-room'}`;

      // Track the most recent tag with a valid image URL for fallback
      const tagImageCandidate = tag.image.url
        ? { url: tag.image.url, x: tag.x, y: tag.y, createdAt: tag.createdAt }
        : null;

      if (existing) {
        existing.tagCount += 1;
        if (tag.createdAt > existing.lastUsedAt) {
          existing.lastUsedAt = tag.createdAt;
        }
        if (tagImageCandidate && (!existing.bestTagImage || tag.createdAt > existing.bestTagImage.createdAt)) {
          existing.bestTagImage = tagImageCandidate;
        }
        if (!existing.projects.has(projectKey)) {
          existing.projects.set(projectKey, {
            projectId: tag.image.projectId,
            projectTitle: tag.image.project.title || 'Untitled Project',
            roomName: tag.image.room || null,
          });
        }
      } else {
        productMap.set(tag.productId, {
          product: tag.product,
          projects: new Map([[projectKey, {
            projectId: tag.image.projectId,
            projectTitle: tag.image.project.title || 'Untitled Project',
            roomName: tag.image.room || null,
          }]]),
          lastUsedAt: tag.createdAt,
          tagCount: 1,
          bestTagImage: tagImageCandidate,
        });
      }
    });

    // 4. Get SourcebookEntry records for this user (notes + archived state)
    const productIds = Array.from(productMap.keys());
    const sourcebookEntries = await prisma.sourcebookEntry.findMany({
      where: {
        userId: designerId,
        productId: { in: productIds },
      },
      select: {
        id: true,
        productId: true,
        notes: true,
        archived: true,
      },
    });

    const sourcebookMap = new Map(
      sourcebookEntries.map(e => [e.productId, e])
    );

    // 5. Get rep emails (same logic as getDesignerVendorDirectory)
    const uniqueVendorNames = Array.from(new Set(
      Array.from(productMap.values())
        .map(p => p.product.brand)
        .filter((brand): brand is string => !!brand)
    ));

    const vendorRepEmails = new Map<string, { email: string; name: string | null }>();

    if (uniqueVendorNames.length > 0) {
      try {
        const normalizedVendorNames = uniqueVendorNames.map(normalizeVendorName);
        const placeholders = normalizedVendorNames.map((_, i) => `$${i + 1}`).join(',');
        const candidates = await prisma.$queryRawUnsafe(
          `SELECT id, "normalizedKey", "vendorName"
           FROM vendor_invite_candidates
           WHERE "normalizedKey" = ANY(ARRAY[${placeholders}])`,
          ...normalizedVendorNames
        ) as Array<{ id: string; normalizedKey: string; vendorName: string }>;

        if (candidates.length > 0) {
          const candidateIds = candidates.map(c => c.id);
          const contactPlaceholders = candidateIds.map((_, i) => `$${i + 1}`).join(',');
          const contacts = await prisma.$queryRawUnsafe(
            `SELECT "candidateId", email, name
             FROM vendor_invite_contacts
             WHERE "candidateId" = ANY(ARRAY[${contactPlaceholders}])
               AND "designerId" = $${candidateIds.length + 1}
             ORDER BY "createdAt" DESC`,
            ...candidateIds,
            designerId
          ) as Array<{ candidateId: string; email: string; name: string | null }>;

          contacts.forEach(contact => {
            const candidate = candidates.find(c => c.id === contact.candidateId);
            if (candidate) {
              const normalizedKey = normalizeVendorName(candidate.vendorName);
              if (!vendorRepEmails.has(normalizedKey)) {
                vendorRepEmails.set(normalizedKey, {
                  email: contact.email,
                  name: contact.name,
                });
              }
            }
          });
        }
      } catch {
        // Tables may not exist; continue without rep emails
      }
    }

    // 6. Category inference helper
    const inferCategory = (productName: string, existingCategory: string | null): string | null => {
      if (existingCategory) return existingCategory;
      const nameLower = productName.toLowerCase();
      const categoryPatterns: Record<string, string[]> = {
        'Lighting': ['chandelier', 'pendant', 'sconce', 'lamp', 'light', 'fixture', 'lantern'],
        'Seating': ['chair', 'sofa', 'settee', 'bench', 'stool', 'ottoman', 'chaise'],
        'Tables': ['table', 'desk', 'console', 'side table', 'coffee table', 'dining table'],
        'Storage': ['cabinet', 'dresser', 'chest', 'wardrobe', 'shelving', 'bookcase', 'sideboard'],
        'Textiles': ['rug', 'carpet', 'pillow', 'throw', 'curtain', 'drapery', 'fabric'],
        'Decorative': ['mirror', 'art', 'sculpture', 'vase', 'bowl', 'accessory'],
        'Hardware': ['faucet', 'fixture', 'handle', 'knob', 'pull', 'hinge'],
        'Flooring': ['tile', 'wood', 'stone', 'marble', 'flooring'],
        'Wall Coverings': ['wallpaper', 'paint', 'panel', 'molding'],
      };
      for (const [category, patterns] of Object.entries(categoryPatterns)) {
        if (patterns.some(pattern => nameLower.includes(pattern))) {
          return category;
        }
      }
      return null;
    };

    // 7. Build sourcebook entries
    const entries: SourcebookEntry[] = Array.from(productMap.values())
      .map(item => {
        const vendorName = item.product.brand;
        const normalizedVendorName = vendorName ? normalizeVendorName(vendorName) : null;
        const repInfo = normalizedVendorName ? vendorRepEmails.get(normalizedVendorName) : null;
        const category = inferCategory(item.product.name, item.product.category);
        const sbEntry = sourcebookMap.get(item.product.id);

        // Resolve image: catalog → project tag → placeholder
        let resolvedImage: SourcebookEntry['resolvedImage'];
        if (item.product.imageUrl) {
          resolvedImage = { url: item.product.imageUrl, type: 'catalog' };
        } else if (item.bestTagImage) {
          resolvedImage = {
            url: item.bestTagImage.url,
            type: 'project',
            focalX: item.bestTagImage.x,
            focalY: item.bestTagImage.y,
          };
        } else {
          resolvedImage = { url: null, type: 'placeholder' };
        }

        return {
          productId: item.product.id,
          productName: item.product.name,
          productBrand: item.product.brand,
          productCategory: category,
          productImageUrl: item.product.imageUrl,
          resolvedImage,
          projects: Array.from(item.projects.values()),
          repEmail: repInfo?.email || null,
          repName: repInfo?.name || null,
          lastUsedAt: item.lastUsedAt,
          tagCount: item.tagCount,
          sourcebookEntryId: sbEntry?.id || null,
          notes: sbEntry?.notes || null,
          archived: sbEntry?.archived || false,
        };
      });

    // 8. Filter archived unless requested
    const filtered = includeArchived
      ? entries
      : entries.filter(e => !e.archived);

    // 9. Sort by lastUsedAt (most recent first)
    filtered.sort((a, b) =>
      b.lastUsedAt.getTime() - a.lastUsedAt.getTime()
    );

    return filtered;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[getSourcebookEntries] Error:', { designerId, message });
    return [];
  }
}
