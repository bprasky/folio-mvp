/**
 * Supplemental Quotes System
 * See docs/12_INTELLIGENCE_SYSTEM.md - Layer 6: Designer Ecosystem
 */

import { prisma } from '@/lib/prisma';

export type QuoteSource = 'welcome_back' | 'trend_interview' | 'user_question';
export type DisplayLocation = 'near_product' | 'sidebar' | 'end_of_post';

export interface SupplementalQuoteInput {
  projectPostId: string;
  productTagId?: string;
  question: string;
  answer: string;
  source: QuoteSource;
  pinned?: boolean;
  displayLocation?: DisplayLocation;
}

export interface SupplementalQuoteData {
  id: string;
  projectPostId: string;
  productTagId: string | null;
  question: string;
  answer: string;
  source: QuoteSource;
  pinned: boolean;
  displayLocation: DisplayLocation | null;
  createdAt: Date;
}

/**
 * Add a supplemental quote to a project post
 */
export async function addSupplementalQuote(
  input: SupplementalQuoteInput
): Promise<SupplementalQuoteData> {
  const quote = await prisma.supplementalQuote.create({
    data: {
      projectPostId: input.projectPostId,
      productTagId: input.productTagId,
      question: input.question,
      answer: input.answer,
      source: input.source,
      pinned: input.pinned || false,
      displayLocation: input.displayLocation,
    },
  });

  return {
    id: quote.id,
    projectPostId: quote.projectPostId,
    productTagId: quote.productTagId,
    question: quote.question,
    answer: quote.answer,
    source: quote.source as QuoteSource,
    pinned: quote.pinned,
    displayLocation: quote.displayLocation as DisplayLocation | null,
    createdAt: quote.createdAt,
  };
}

/**
 * Get all supplemental quotes for a project post
 */
export async function getPostSupplementalQuotes(
  projectPostId: string
): Promise<SupplementalQuoteData[]> {
  const quotes = await prisma.supplementalQuote.findMany({
    where: { projectPostId },
    orderBy: [
      { pinned: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  return quotes.map(q => ({
    id: q.id,
    projectPostId: q.projectPostId,
    productTagId: q.productTagId,
    question: q.question,
    answer: q.answer,
    source: q.source as QuoteSource,
    pinned: q.pinned,
    displayLocation: q.displayLocation as DisplayLocation | null,
    createdAt: q.createdAt,
  }));
}

/**
 * Get supplemental quotes for a specific product tag
 */
export async function getProductTagQuotes(
  productTagId: string
): Promise<SupplementalQuoteData[]> {
  const quotes = await prisma.supplementalQuote.findMany({
    where: { productTagId },
    orderBy: { createdAt: 'asc' },
  });

  return quotes.map(q => ({
    id: q.id,
    projectPostId: q.projectPostId,
    productTagId: q.productTagId,
    question: q.question,
    answer: q.answer,
    source: q.source as QuoteSource,
    pinned: q.pinned,
    displayLocation: q.displayLocation as DisplayLocation | null,
    createdAt: q.createdAt,
  }));
}

/**
 * Update a supplemental quote
 */
export async function updateSupplementalQuote(
  quoteId: string,
  updates: Partial<{
    answer: string;
    pinned: boolean;
    displayLocation: DisplayLocation;
  }>
): Promise<SupplementalQuoteData> {
  const quote = await prisma.supplementalQuote.update({
    where: { id: quoteId },
    data: updates,
  });

  return {
    id: quote.id,
    projectPostId: quote.projectPostId,
    productTagId: quote.productTagId,
    question: quote.question,
    answer: quote.answer,
    source: quote.source as QuoteSource,
    pinned: quote.pinned,
    displayLocation: quote.displayLocation as DisplayLocation | null,
    createdAt: quote.createdAt,
  };
}

/**
 * Delete a supplemental quote
 */
export async function deleteSupplementalQuote(quoteId: string): Promise<void> {
  await prisma.supplementalQuote.delete({
    where: { id: quoteId },
  });
}

/**
 * Get project engagement metrics for welcome back banner
 */
export async function getProjectEngagement(
  projectId: string,
  sinceDate?: Date
): Promise<{
  views: number;
  saves: number;
  topInterest: {
    productTagId: string;
    productName: string;
    count: number;
  } | null;
}> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      views: true,
      saves: true,
      images: {
        select: {
          id: true,
          momentSaves: true,
          tags: {
            select: {
              id: true,
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    return { views: 0, saves: 0, topInterest: null };
  }

  // Find the most saved product tag
  let topInterest: { productTagId: string; productName: string; count: number } | null = null;
  let maxSaves = 0;

  for (const image of project.images) {
    if (image.momentSaves > maxSaves && image.tags.length > 0) {
      const topTag = image.tags[0];
      maxSaves = image.momentSaves;
      topInterest = {
        productTagId: topTag.id,
        productName: topTag.product.name,
        count: image.momentSaves,
      };
    }
  }

  return {
    views: project.views,
    saves: project.saves,
    topInterest,
  };
}
