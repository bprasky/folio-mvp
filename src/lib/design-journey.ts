/**
 * Design Journey Tracking
 *
 * Tracks the evolution from presentation → final design
 * and infers reasons for changes based on patterns.
 */

import { prisma } from '@/lib/prisma';

type ChangeReason =
  | 'budget'
  | 'availability'
  | 'client_preference'
  | 'design_change'
  | 'substitution'
  | 'unknown';

type ChangeAttribution =
  | 'designer'
  | 'client'
  | 'collaborator'
  | 'system';

interface InferredChange {
  presentationProductId?: string;
  presentationProduct?: {
    name: string;
    brand: string | null;
    price: number | null;
  };
  finalSelectionId?: string;
  finalProduct?: {
    name: string;
    brand: string | null;
    price: number | null;
  };
  status: 'kept' | 'swapped' | 'removed' | 'added';
  inferredReason: ChangeReason;
  inferredAttribution: ChangeAttribution;
  confidence: number;
  reasoning: string;
}

/**
 * Record a selection change in the history
 */
export async function recordSelectionChange(params: {
  selectionId: string;
  projectId: string;
  roomId?: string;
  slotKey?: string;
  action: 'created' | 'updated' | 'deleted' | 'swapped' | 'restored';
  changedByUserId: string;
  changedByRole?: ChangeAttribution;
  previousCachedProductId?: string;
  newCachedProductId?: string;
  changedFields?: Record<string, { from: unknown; to: unknown }>;
  reasonCategory?: ChangeReason;
  reasonNotes?: string;
  source?: string;
}) {
  try {
    const history = await prisma.selectionHistory.create({
      data: {
        selectionId: params.selectionId,
        projectId: params.projectId,
        roomId: params.roomId,
        slotKey: params.slotKey,
        action: params.action,
        changedByUserId: params.changedByUserId,
        changedByRole: params.changedByRole || 'designer',
        previousProductId: params.previousCachedProductId,
        newProductId: params.newCachedProductId,
        changedFields: params.changedFields,
        reasonCategory: params.reasonCategory,
        reasonNotes: params.reasonNotes,
        source: params.source || 'designer_board',
      },
    });

    // If this is a swap, record the swap pattern
    if (params.action === 'swapped' && params.previousCachedProductId && params.newCachedProductId) {
      await recordSwapPattern(
        params.previousCachedProductId,
        params.newCachedProductId,
        params.reasonCategory
      );
    }

    return history;
  } catch (error) {
    console.error('Failed to record selection change:', error);
    return null;
  }
}

/**
 * Record a swap pattern for aggregate analysis
 */
async function recordSwapPattern(
  fromProductId: string,
  toProductId: string,
  reason?: ChangeReason
) {
  try {
    // Check if pattern exists
    const existing = await prisma.swapPattern.findUnique({
      where: {
        fromProductId_toProductId: {
          fromProductId,
          toProductId,
        },
      },
    });

    if (existing) {
      // Update existing pattern
      const currentReasons = (existing.commonReasons as Array<{ reason: string; count: number }>) || [];
      let updatedReasons = [...currentReasons];

      if (reason) {
        const existingReasonIdx = updatedReasons.findIndex(r => r.reason === reason);
        if (existingReasonIdx >= 0) {
          updatedReasons[existingReasonIdx].count++;
        } else {
          updatedReasons.push({ reason, count: 1 });
        }
      }

      await prisma.swapPattern.update({
        where: { id: existing.id },
        data: {
          swapCount: { increment: 1 },
          commonReasons: updatedReasons,
        },
      });
    } else {
      // Create new pattern
      await prisma.swapPattern.create({
        data: {
          fromProductId,
          toProductId,
          swapCount: 1,
          commonReasons: reason ? [{ reason, count: 1 }] : [],
        },
      });
    }
  } catch (error) {
    console.error('Failed to record swap pattern:', error);
  }
}

/**
 * Analyze a project's design journey by comparing:
 * 1. Original presentation products
 * 2. Designer's typical patterns (fingerprint)
 * 3. Final selections
 */
export async function analyzeProjectJourney(projectId: string) {
  try {
    // Get presentation products
    const presentationProducts = await prisma.presentationProduct.findMany({
      where: { projectId },
      include: {
        cachedProduct: true,
        finalSelection: true,
      },
    });

    // Get final selections with cached product links
    const selections = await prisma.selection.findMany({
      where: { projectId },
      include: {
        cachedProductLinks: {
          include: {
            cachedProduct: true,
          },
        },
      },
    });

    // Get project owner for fingerprint comparison
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        designerId: true,
        ownerId: true,
      },
    });

    const designerId = project?.designerId || project?.ownerId;

    // Get designer's fingerprint
    let designerFingerprint: {
      topBrands: string[];
      topMaterials: string[];
      avgPriceRange: { min: number; max: number } | null;
    } | null = null;

    if (designerId) {
      const brandAffinities = await prisma.designerProductAffinity.findMany({
        where: {
          designerId,
          brandName: { not: null },
          cachedProductId: null,
        },
        orderBy: { useCount: 'desc' },
        take: 10,
      });

      const materialAffinities = await prisma.designerProductAffinity.findMany({
        where: {
          designerId,
          materialType: { not: null },
          cachedProductId: null,
          brandName: null,
        },
        orderBy: { useCount: 'desc' },
        take: 5,
      });

      designerFingerprint = {
        topBrands: brandAffinities.map(b => b.brandName!),
        topMaterials: materialAffinities.map(m => m.materialType!),
        avgPriceRange: null, // Could compute from their typical product prices
      };
    }

    // Analyze changes
    const changes: InferredChange[] = [];

    // Map presentation products to final selections
    for (const pp of presentationProducts) {
      if (pp.keptInFinal && pp.finalSelection) {
        // Product was kept
        changes.push({
          presentationProductId: pp.id,
          presentationProduct: {
            name: pp.extractedName || 'Unknown',
            brand: pp.extractedBrand,
            price: pp.extractedPrice ? Number(pp.extractedPrice) : null,
          },
          finalSelectionId: pp.finalSelection.id,
          finalProduct: {
            name: pp.finalSelection.productName || 'Unknown',
            brand: pp.finalSelection.vendorName,
            price: pp.finalSelection.unitPrice ? Number(pp.finalSelection.unitPrice) : null,
          },
          status: 'kept',
          inferredReason: 'unknown',
          inferredAttribution: 'designer',
          confidence: 1.0,
          reasoning: 'Product from presentation was kept in final design',
        });
      } else if (!pp.keptInFinal && pp.cachedProductId) {
        // Product was removed or swapped - check if there's a similar replacement
        const replacement = selections.find(s =>
          s.slotKey === pp.suggestedRole &&
          s.cachedProductLinks.some(l => l.cachedProduct?.materialType === pp.cachedProduct?.materialType)
        );

        if (replacement) {
          const replacementProduct = replacement.cachedProductLinks[0]?.cachedProduct;
          const priceDiff = replacementProduct?.priceCents && pp.extractedPrice
            ? (replacementProduct.priceCents / 100) - Number(pp.extractedPrice)
            : null;

          // Infer reason based on patterns
          let inferredReason: ChangeReason = 'unknown';
          let confidence = 0.5;
          let reasoning = '';

          if (priceDiff !== null && priceDiff < -100) {
            // Significant price decrease → likely budget
            inferredReason = 'budget';
            confidence = 0.8;
            reasoning = `Replacement is $${Math.abs(priceDiff).toFixed(0)} cheaper`;
          } else if (designerFingerprint && replacementProduct?.brand) {
            // Check if replacement matches designer's typical choices
            const isDesignerFavorite = designerFingerprint.topBrands.includes(
              replacementProduct.brand.toLowerCase()
            );
            if (isDesignerFavorite && !pp.extractedBrand?.toLowerCase().includes(replacementProduct.brand.toLowerCase())) {
              inferredReason = 'design_change';
              confidence = 0.7;
              reasoning = `Swapped to designer's preferred brand (${replacementProduct.brand})`;
            }
          }

          // Check swap patterns for this combination
          if (pp.cachedProductId && replacementProduct?.id) {
            const swapPattern = await prisma.swapPattern.findUnique({
              where: {
                fromProductId_toProductId: {
                  fromProductId: pp.cachedProductId,
                  toProductId: replacementProduct.id,
                },
              },
            });

            if (swapPattern && swapPattern.swapCount > 3) {
              const reasons = (swapPattern.commonReasons as Array<{ reason: string; count: number }>) || [];
              const topReason = reasons.sort((a, b) => b.count - a.count)[0];
              if (topReason) {
                inferredReason = topReason.reason as ChangeReason;
                confidence = 0.85;
                reasoning = `Common swap pattern (${swapPattern.swapCount} times), usually for: ${topReason.reason}`;
              }
            }
          }

          changes.push({
            presentationProductId: pp.id,
            presentationProduct: {
              name: pp.extractedName || 'Unknown',
              brand: pp.extractedBrand,
              price: pp.extractedPrice ? Number(pp.extractedPrice) : null,
            },
            finalSelectionId: replacement.id,
            finalProduct: {
              name: replacement.productName || 'Unknown',
              brand: replacement.vendorName,
              price: replacement.unitPrice ? Number(replacement.unitPrice) : null,
            },
            status: 'swapped',
            inferredReason,
            inferredAttribution: inferredReason === 'budget' || inferredReason === 'client_preference'
              ? 'client'
              : 'designer',
            confidence,
            reasoning,
          });
        } else {
          // Product was removed entirely
          changes.push({
            presentationProductId: pp.id,
            presentationProduct: {
              name: pp.extractedName || 'Unknown',
              brand: pp.extractedBrand,
              price: pp.extractedPrice ? Number(pp.extractedPrice) : null,
            },
            status: 'removed',
            inferredReason: 'design_change',
            inferredAttribution: 'designer',
            confidence: 0.5,
            reasoning: 'Product removed from final design',
          });
        }
      }
    }

    // Find products that were added (not in presentation)
    const presentationCachedIds = new Set(
      presentationProducts.map(pp => pp.cachedProductId).filter(Boolean)
    );

    for (const selection of selections) {
      const cachedProduct = selection.cachedProductLinks[0]?.cachedProduct;
      if (cachedProduct && !presentationCachedIds.has(cachedProduct.id)) {
        let inferredAttribution: ChangeAttribution = 'designer';
        let reasoning = 'Product added that was not in original presentation';

        if (designerFingerprint && cachedProduct.brand) {
          const isDesignerFavorite = designerFingerprint.topBrands.includes(
            cachedProduct.brand.toLowerCase()
          );
          if (isDesignerFavorite) {
            reasoning = `Designer added their preferred brand (${cachedProduct.brand})`;
          } else {
            inferredAttribution = 'client';
            reasoning = 'Product added that differs from designer\'s typical choices';
          }
        }

        changes.push({
          finalSelectionId: selection.id,
          finalProduct: {
            name: selection.productName || cachedProduct.productName || 'Unknown',
            brand: selection.vendorName || cachedProduct.brand,
            price: selection.unitPrice ? Number(selection.unitPrice) : (cachedProduct.priceCents ? cachedProduct.priceCents / 100 : null),
          },
          status: 'added',
          inferredReason: 'design_change',
          inferredAttribution,
          confidence: 0.6,
          reasoning,
        });
      }
    }

    // Compute summary stats
    const summary = {
      presentationCount: presentationProducts.length,
      finalCount: selections.length,
      kept: changes.filter(c => c.status === 'kept').length,
      swapped: changes.filter(c => c.status === 'swapped').length,
      removed: changes.filter(c => c.status === 'removed').length,
      added: changes.filter(c => c.status === 'added').length,
      budgetChanges: changes.filter(c => c.inferredReason === 'budget').length,
      clientInfluence: changes.filter(c => c.inferredAttribution === 'client').length,
      designerDriven: changes.filter(c => c.inferredAttribution === 'designer').length,
    };

    return {
      projectId,
      changes,
      summary,
      designerFingerprint,
    };
  } catch (error) {
    console.error('Failed to analyze project journey:', error);
    return null;
  }
}

/**
 * Get common swap patterns (what products often get swapped for what)
 */
export async function getCommonSwapPatterns(options?: {
  materialType?: string;
  role?: string;
  limit?: number;
}) {
  try {
    const patterns = await prisma.swapPattern.findMany({
      where: {
        materialType: options?.materialType,
        role: options?.role,
      },
      orderBy: { swapCount: 'desc' },
      take: options?.limit || 20,
      include: {
        fromProduct: {
          select: {
            id: true,
            productName: true,
            brand: true,
            priceCents: true,
            materialType: true,
          },
        },
        toProduct: {
          select: {
            id: true,
            productName: true,
            brand: true,
            priceCents: true,
            materialType: true,
          },
        },
      },
    });

    return patterns.map(p => ({
      id: p.id,
      fromProduct: p.fromProduct,
      toProduct: p.toProduct,
      swapCount: p.swapCount,
      commonReasons: p.commonReasons as Array<{ reason: string; count: number }>,
      priceDelta: p.fromProduct?.priceCents && p.toProduct?.priceCents
        ? (p.toProduct.priceCents - p.fromProduct.priceCents) / 100
        : null,
    }));
  } catch (error) {
    console.error('Failed to get swap patterns:', error);
    return [];
  }
}

/**
 * Compute and store project design journey summary
 */
export async function computeProjectJourneySummary(projectId: string) {
  const analysis = await analyzeProjectJourney(projectId);
  if (!analysis) return null;

  try {
    const journey = await prisma.projectDesignJourney.upsert({
      where: { projectId },
      create: {
        projectId,
        presentationProductCount: analysis.summary.presentationCount,
        finalSelectionCount: analysis.summary.finalCount,
        productsKept: analysis.summary.kept,
        productsSwapped: analysis.summary.swapped,
        productsAdded: analysis.summary.added,
        productsRemoved: analysis.summary.removed,
        totalChanges: analysis.changes.length,
        changesByDesigner: analysis.summary.designerDriven,
        changesByClient: analysis.summary.clientInfluence,
        changesForBudget: analysis.summary.budgetChanges,
        budgetImpactPercent: analysis.changes.length > 0
          ? (analysis.summary.budgetChanges / analysis.changes.length) * 100
          : 0,
        clientInfluenceScore: analysis.changes.length > 0
          ? (analysis.summary.clientInfluence / analysis.changes.length) * 100
          : 0,
      },
      update: {
        presentationProductCount: analysis.summary.presentationCount,
        finalSelectionCount: analysis.summary.finalCount,
        productsKept: analysis.summary.kept,
        productsSwapped: analysis.summary.swapped,
        productsAdded: analysis.summary.added,
        productsRemoved: analysis.summary.removed,
        totalChanges: analysis.changes.length,
        changesByDesigner: analysis.summary.designerDriven,
        changesByClient: analysis.summary.clientInfluence,
        changesForBudget: analysis.summary.budgetChanges,
        budgetImpactPercent: analysis.changes.length > 0
          ? (analysis.summary.budgetChanges / analysis.changes.length) * 100
          : 0,
        clientInfluenceScore: analysis.changes.length > 0
          ? (analysis.summary.clientInfluence / analysis.changes.length) * 100
          : 0,
        computedAt: new Date(),
      },
    });

    return journey;
  } catch (error) {
    console.error('Failed to compute project journey summary:', error);
    return null;
  }
}

/**
 * Link presentation products to cached products and track matches
 */
export async function matchPresentationToCatalog(projectId: string) {
  try {
    const presentationProducts = await prisma.presentationProduct.findMany({
      where: {
        projectId,
        matchStatus: 'unmatched',
      },
    });

    const matched: string[] = [];

    for (const pp of presentationProducts) {
      // Try to find a matching cached product by URL first
      if (pp.extractedUrl) {
        const normalizedUrl = pp.extractedUrl.split('?')[0].replace(/\/+$/, '');
        const cachedProduct = await prisma.cachedProduct.findUnique({
          where: { url: normalizedUrl },
        });

        if (cachedProduct) {
          await prisma.presentationProduct.update({
            where: { id: pp.id },
            data: {
              cachedProductId: cachedProduct.id,
              matchStatus: 'matched',
              matchConfidence: 1.0,
            },
          });
          matched.push(pp.id);
          continue;
        }
      }

      // Try to find by name and brand
      if (pp.extractedName && pp.extractedBrand) {
        const cachedProduct = await prisma.cachedProduct.findFirst({
          where: {
            productName: { contains: pp.extractedName, mode: 'insensitive' },
            brand: { contains: pp.extractedBrand, mode: 'insensitive' },
          },
        });

        if (cachedProduct) {
          await prisma.presentationProduct.update({
            where: { id: pp.id },
            data: {
              cachedProductId: cachedProduct.id,
              matchStatus: 'matched',
              matchConfidence: 0.8,
            },
          });
          matched.push(pp.id);
        }
      }
    }

    return { matched: matched.length, total: presentationProducts.length };
  } catch (error) {
    console.error('Failed to match presentation products:', error);
    return { matched: 0, total: 0 };
  }
}
