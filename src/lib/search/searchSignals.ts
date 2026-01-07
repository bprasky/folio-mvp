import { prisma } from '@/lib/prisma';

export interface SearchSignal {
  query: string;
  userId?: string;
  resultMomentIds: string[];
  clickedMomentIds: string[];
  savedMomentIds: string[];
  timestamp: Date;
}

/**
 * Capture search signal for trend analysis
 */
export async function captureSearchSignal(params: {
  query: string;
  userId?: string;
  resultMomentIds: string[];
  clickedMomentIds: string[];
  savedMomentIds: string[];
}): Promise<void> {
  const { query, userId, resultMomentIds, clickedMomentIds, savedMomentIds } = params;
  
  // Store in ContextSignal table (reusing existing infrastructure)
  await prisma.contextSignal.create({
    data: {
      userId: userId || null,
      action: 'search',
      tags: [query.toLowerCase()],
      meta: {
        resultMomentIds,
        clickedMomentIds,
        savedMomentIds,
        resultCount: resultMomentIds.length,
        clickCount: clickedMomentIds.length,
        saveCount: savedMomentIds.length,
      },
    },
  });
  
  // Also track individual moment interactions
  for (const momentId of clickedMomentIds) {
    await prisma.contextSignal.create({
      data: {
        userId: userId || null,
        productId: null,
        projectId: null,
        action: 'moment_click',
        tags: [query.toLowerCase()],
        meta: {
          momentId,
          source: 'search',
        },
      },
    });
  }
  
  for (const momentId of savedMomentIds) {
    await prisma.contextSignal.create({
      data: {
        userId: userId || null,
        productId: null,
        projectId: null,
        action: 'moment_save',
        tags: [query.toLowerCase()],
        meta: {
          momentId,
          source: 'search',
        },
      },
    });
  }
}

