import { prisma } from '@/lib/prisma';

export interface TrendingTerm {
  term: string;
  searchCount: number;
  growth: number; // % increase over baseline
  topMoments: string[]; // Moment IDs driving the trend
  untaggedOpportunities: Array<{
    momentId: string;
    designerId: string;
    detectedMaterial: string; // AI-detected but not tagged
  }>;
}

/**
 * Detect trending search terms
 */
export async function detectTrends(
  timeWindow: '24h' | '7d' | '30d' = '7d'
): Promise<TrendingTerm[]> {
  const now = new Date();
  let windowStart: Date;
  
  switch (timeWindow) {
    case '24h':
      windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }
  
  // Get search signals from the time window
  const searchSignals = await prisma.contextSignal.findMany({
    where: {
      action: 'search',
      createdAt: {
        gte: windowStart,
      },
    },
    select: {
      tags: true,
      meta: true,
      createdAt: true,
    },
  });
  
  // Count searches by term
  const termCounts: Record<string, number> = {};
  const termMoments: Record<string, Set<string>> = {};
  
  for (const signal of searchSignals) {
    for (const tag of signal.tags) {
      const term = tag.toLowerCase().trim();
      if (term.length > 0) {
        termCounts[term] = (termCounts[term] || 0) + 1;
        
        // Track moments from this search
        const meta = signal.meta as any;
        if (meta?.resultMomentIds) {
          if (!termMoments[term]) {
            termMoments[term] = new Set();
          }
          for (const momentId of meta.resultMomentIds) {
            termMoments[term].add(momentId);
          }
        }
      }
    }
  }
  
  // Calculate baseline (previous period)
  const baselineStart = new Date(windowStart.getTime() - (now.getTime() - windowStart.getTime()));
  const baselineSignals = await prisma.contextSignal.findMany({
    where: {
      action: 'search',
      createdAt: {
        gte: baselineStart,
        lt: windowStart,
      },
    },
    select: {
      tags: true,
    },
  });
  
  const baselineCounts: Record<string, number> = {};
  for (const signal of baselineSignals) {
    for (const tag of signal.tags) {
      const term = tag.toLowerCase().trim();
      if (term.length > 0) {
        baselineCounts[term] = (baselineCounts[term] || 0) + 1;
      }
    }
  }
  
  // Calculate growth and identify trends
  const trends: TrendingTerm[] = [];
  
  for (const [term, count] of Object.entries(termCounts)) {
    const baseline = baselineCounts[term] || 0;
    const growth = baseline > 0 ? ((count - baseline) / baseline) * 100 : count > 0 ? 100 : 0;
    
    // Only include terms with significant growth or high absolute count
    if (growth > 20 || count >= 10) {
      const topMoments = Array.from(termMoments[term] || []);
      
      // Find untagged opportunities
      const untaggedOpportunities = await findUntaggedOpportunities(term, topMoments);
      
      trends.push({
        term,
        searchCount: count,
        growth,
        topMoments: topMoments.slice(0, 10), // Top 10 moments
        untaggedOpportunities,
      });
    }
  }
  
  // Sort by growth (descending)
  trends.sort((a, b) => b.growth - a.growth);
  
  return trends;
}

/**
 * Find moments with AI-detected materials that aren't explicitly tagged
 */
async function findUntaggedOpportunities(
  term: string,
  momentIds: string[]
): Promise<Array<{
  momentId: string;
  designerId: string;
  detectedMaterial: string;
}>> {
  if (momentIds.length === 0) {
    return [];
  }
  
  // Get moments with AI-detected materials
  const moments = await prisma.projectImage.findMany({
    where: {
      id: { in: momentIds },
      aiMaterials: {
        hasSome: [term.toLowerCase()],
      },
    },
    include: {
      tags: {
        include: {
          product: {
            select: {
              name: true,
              category: true,
            },
          },
        },
      },
      project: {
        select: {
          designerId: true,
        },
      },
    },
  });
  
  const opportunities: Array<{
    momentId: string;
    designerId: string;
    detectedMaterial: string;
  }> = [];
  
  for (const moment of moments) {
    // Check if the material is already explicitly tagged
    const hasExplicitTag = moment.tags.some(tag => {
      const productName = tag.product.name.toLowerCase();
      const productCategory = tag.product.category?.toLowerCase() || '';
      const searchTerm = term.toLowerCase();
      return productName.includes(searchTerm) || productCategory.includes(searchTerm);
    });
    
    if (!hasExplicitTag && moment.project.designerId) {
      opportunities.push({
        momentId: moment.id,
        designerId: moment.project.designerId,
        detectedMaterial: term,
      });
    }
  }
  
  return opportunities;
}

