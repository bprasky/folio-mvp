import { prisma } from '@/lib/prisma';

export interface TaggingPrompt {
  id: string;
  designerId: string;
  momentId: string;
  detectedMaterial: string;
  searchInterest: number;
  message: string;
  createdAt: Date;
  dismissedAt?: Date;
  actionTakenAt?: Date;
}

/**
 * Generate tagging prompt for a designer
 */
export async function generateTaggingPrompt(
  designerId: string,
  momentId: string,
  detectedMaterial: string,
  searchInterest: number
): Promise<void> {
  // Check if prompt already exists and isn't dismissed
  const existing = await prisma.contextSignal.findFirst({
    where: {
      userId: designerId,
      action: 'tagging_prompt',
      meta: {
        path: ['momentId'],
        equals: momentId,
      },
    },
  });
  
  if (existing) {
    // Prompt already exists, skip
    return;
  }
  
  // Create notification/prompt
  const message = `Users are interested in the ${detectedMaterial} in this photo. Add a tag to invite the vendor to collaborate.`;
  
  // Store as ContextSignal for now (can be moved to dedicated table later)
  await prisma.contextSignal.create({
    data: {
      userId: designerId,
      projectId: null,
      action: 'tagging_prompt',
      tags: [detectedMaterial.toLowerCase()],
      meta: {
        momentId,
        detectedMaterial,
        searchInterest,
        message,
        createdAt: new Date().toISOString(),
      },
    },
  });
  
  // TODO: Send actual notification to designer dashboard
  // This could integrate with an existing notification system
}

/**
 * Get pending tagging prompts for a designer
 */
export async function getTaggingPrompts(designerId: string): Promise<Array<{
  momentId: string;
  detectedMaterial: string;
  searchInterest: number;
  message: string;
  createdAt: Date;
}>> {
  const prompts = await prisma.contextSignal.findMany({
    where: {
      userId: designerId,
      action: 'tagging_prompt',
      meta: {
        path: ['dismissedAt'],
        equals: null,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  
  return prompts.map(p => {
    const meta = p.meta as any;
    return {
      momentId: meta.momentId,
      detectedMaterial: meta.detectedMaterial,
      searchInterest: meta.searchInterest || 0,
      message: meta.message,
      createdAt: p.createdAt,
    };
  });
}

