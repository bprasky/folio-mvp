import { prisma } from '@/lib/prisma';
import { searchMoments } from './searchMoments';

export interface ProactiveEdition {
  id: string;
  designerId: string;
  title: string; // e.g., "Your Blue Moments"
  trigger: string; // The trending term
  momentIds: string[];
  previewUrl?: string;
  status: 'suggested' | 'dismissed' | 'published';
  createdAt: Date;
}

/**
 * Assemble proactive edition for a designer based on trending term
 */
export async function assembleProactiveEdition(
  designerId: string,
  trendingTerm: string
): Promise<ProactiveEdition | null> {
  // Search designer's moments for the trending term
  const searchResult = await searchMoments({
    query: trendingTerm,
    scope: 'private',
    userId: designerId,
    limit: 20,
  });
  
  if (searchResult.moments.length < 3) {
    // Not enough relevant content
    return null;
  }
  
  // Filter to only published moments (for now)
  const publishedMoments = searchResult.moments.filter(m => 
    'section' in m ? m.section === 'published' : m.isPublished
  );
  
  if (publishedMoments.length < 3) {
    // Not enough published content
    return null;
  }
  
  const momentIds = publishedMoments.slice(0, 12).map(m => m.id);
  
  // Generate title
  const title = `Your ${trendingTerm.charAt(0).toUpperCase() + trendingTerm.slice(1)} Moments`;
  
  // Create proactive edition record
  // For now, store in ContextSignal (can be moved to dedicated table later)
  const editionId = `edition_${designerId}_${trendingTerm}_${Date.now()}`;
  
  await prisma.contextSignal.create({
    data: {
      userId: designerId,
      action: 'proactive_edition',
      tags: [trendingTerm.toLowerCase()],
      meta: {
        editionId,
        title,
        trigger: trendingTerm,
        momentIds,
        status: 'suggested',
        createdAt: new Date().toISOString(),
      },
    },
  });
  
  return {
    id: editionId,
    designerId,
    title,
    trigger: trendingTerm,
    momentIds,
    status: 'suggested',
    createdAt: new Date(),
  };
}

/**
 * Get proactive editions for a designer
 */
export async function getProactiveEditions(
  designerId: string
): Promise<ProactiveEdition[]> {
  const signals = await prisma.contextSignal.findMany({
    where: {
      userId: designerId,
      action: 'proactive_edition',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  
  return signals
    .map(s => {
      const meta = s.meta as any;
      if (!meta || meta.status === 'dismissed') {
        return null;
      }
      return {
        id: meta.editionId || s.id,
        designerId,
        title: meta.title || 'Untitled Edition',
        trigger: meta.trigger || '',
        momentIds: meta.momentIds || [],
        status: meta.status || 'suggested',
        createdAt: s.createdAt,
      };
    })
    .filter((e): e is ProactiveEdition => e !== null);
}

/**
 * Dismiss a proactive edition
 */
export async function dismissProactiveEdition(
  editionId: string,
  designerId: string
): Promise<void> {
  // Find and update the signal
  const signal = await prisma.contextSignal.findFirst({
    where: {
      userId: designerId,
      action: 'proactive_edition',
      meta: {
        path: ['editionId'],
        equals: editionId,
      },
    },
  });
  
  if (signal) {
    const meta = signal.meta as any;
    await prisma.contextSignal.update({
      where: { id: signal.id },
      data: {
        meta: {
          ...meta,
          status: 'dismissed',
          dismissedAt: new Date().toISOString(),
        },
      },
    });
  }
}

/**
 * Publish a proactive edition (convert to ProjectPost)
 */
export async function publishProactiveEdition(
  editionId: string,
  designerId: string
): Promise<void> {
  // Find the edition
  const signal = await prisma.contextSignal.findFirst({
    where: {
      userId: designerId,
      action: 'proactive_edition',
      meta: {
        path: ['editionId'],
        equals: editionId,
      },
    },
  });
  
  if (!signal) {
    throw new Error('Edition not found');
  }
  
  const meta = signal.meta as any;
  
  // TODO: Convert to ProjectPost following existing editorial workflow
  // This would:
  // 1. Create a ProjectPost with the moments
  // 2. Generate editorial content
  // 3. Set status to PUBLISHED or REVIEW based on workflow
  
  // For now, mark as published
  await prisma.contextSignal.update({
    where: { id: signal.id },
    data: {
      meta: {
        ...meta,
        status: 'published',
        publishedAt: new Date().toISOString(),
      },
    },
  });
}

