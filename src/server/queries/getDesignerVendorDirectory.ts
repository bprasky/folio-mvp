/**
 * Get designer-level vendor directory
 * Aggregates all ProductTags across designer's projects (all projects, not just published)
 * Includes product, project, room, and rep email context
 */

import { prisma } from '@/lib/prisma';
import { normalizeVendorName } from '@/lib/vendor/inviteCandidates';

export interface DirectoryEntry {
  productId: string;
  productName: string;
  productBrand: string | null;
  productCategory: string | null;
  productImageUrl: string | null;
  
  projects: Array<{
    projectId: string;
    projectTitle: string;
    roomName: string | null;
  }>;
  
  repEmail: string | null;
  repName: string | null;
  
  lastUsedAt: Date;
  tagCount: number;
}

/**
 * Get all products tagged by designer across all projects
 * Groups by productId, aggregates project/room context
 * Joins to VendorInviteContact for rep emails
 */
export async function getDesignerVendorDirectory(designerId: string): Promise<DirectoryEntry[]> {
  try {
    // 1. Get all project IDs for this designer (all projects, not just published)
    const projects = await prisma.project.findMany({
      where: {
        designerId,
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
            brand: true,
            category: true,
            imageUrl: true,
          }
        },
        image: {
          select: {
            projectId: true,
            room: true, // String field on ProjectImage
            project: {
              select: {
                id: true,
                title: true,
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (productTags.length === 0) {
      return [];
    }

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
    }>();

    productTags.forEach(tag => {
      const existing = productMap.get(tag.productId);
      const projectKey = `${tag.image.projectId}-${tag.image.room || 'no-room'}`;
      
      if (existing) {
        existing.tagCount += 1;
        // Update lastUsedAt if this tag is more recent
        if (tag.createdAt > existing.lastUsedAt) {
          existing.lastUsedAt = tag.createdAt;
        }
        // Add project/room if not already present
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
        });
      }
    });

    // 4. Get unique vendor names for rep email lookup
    const uniqueVendorNames = Array.from(new Set(
      Array.from(productMap.values())
        .map(p => p.product.brand)
        .filter((brand): brand is string => !!brand)
    ));

    // 5. Look up rep emails from VendorInviteContact
    // Note: VendorInviteCandidate/VendorInviteContact may not be in Prisma schema
    // but exist in database via migrations
    const vendorRepEmails = new Map<string, { email: string; name: string | null }>();
    
    if (uniqueVendorNames.length > 0) {
      try {
        // Try to query VendorInviteCandidate and VendorInviteContact
        // Using raw query since models may not be in Prisma schema
        const normalizedVendorNames = uniqueVendorNames.map(normalizeVendorName);
        
        // Use Prisma.$queryRaw with proper parameterization
        const placeholders = normalizedVendorNames.map((_, i) => `$${i + 1}`).join(',');
        const candidates = await prisma.$queryRawUnsafe<Array<{
          id: string;
          normalizedKey: string;
          vendorName: string;
        }>>(
          `SELECT id, "normalizedKey", "vendorName"
           FROM vendor_invite_candidates
           WHERE "normalizedKey" = ANY(ARRAY[${placeholders}])`,
          ...normalizedVendorNames
        );

        if (candidates.length > 0) {
          const candidateIds = candidates.map(c => c.id);
          
          const contactPlaceholders = candidateIds.map((_, i) => `$${i + 1}`).join(',');
          const contacts = await prisma.$queryRawUnsafe<Array<{
            candidateId: string;
            email: string;
            name: string | null;
          }>>(
            `SELECT "candidateId", email, name
             FROM vendor_invite_contacts
             WHERE "candidateId" = ANY(ARRAY[${contactPlaceholders}])
               AND "designerId" = $${candidateIds.length + 1}
             ORDER BY "createdAt" DESC`,
            ...candidateIds,
            designerId
          );

          // Map vendor name to rep email (use first contact found)
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
      } catch (error) {
        // If tables don't exist or query fails, continue without rep emails
        console.warn('[getDesignerVendorDirectory] Could not fetch rep emails:', error);
      }
    }

    // 6. Helper function to infer category from product name if missing
    const inferCategory = (productName: string, existingCategory: string | null): string | null => {
      if (existingCategory) return existingCategory;
      
      const nameLower = productName.toLowerCase();
      
      // Category inference patterns
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

    // 7. Build directory entries
    const directoryEntries: DirectoryEntry[] = Array.from(productMap.values()).map(item => {
      const vendorName = item.product.brand;
      const normalizedVendorName = vendorName ? normalizeVendorName(vendorName) : null;
      const repInfo = normalizedVendorName ? vendorRepEmails.get(normalizedVendorName) : null;
      
      // Infer category if missing
      const category = inferCategory(item.product.name, item.product.category);

      return {
        productId: item.product.id,
        productName: item.product.name,
        productBrand: item.product.brand,
        productCategory: category,
        productImageUrl: item.product.imageUrl,
        projects: Array.from(item.projects.values()),
        repEmail: repInfo?.email || null,
        repName: repInfo?.name || null,
        lastUsedAt: item.lastUsedAt,
        tagCount: item.tagCount,
      };
    });

    // 8. Sort by lastUsedAt (most recent first) by default
    directoryEntries.sort((a, b) => 
      b.lastUsedAt.getTime() - a.lastUsedAt.getTime()
    );

    return directoryEntries;
  } catch (error: any) {
    console.error('[getDesignerVendorDirectory] Error:', {
      designerId,
      message: error?.message,
      stack: error?.stack,
    });
    // Return empty array on error instead of throwing
    return [];
  }
}

