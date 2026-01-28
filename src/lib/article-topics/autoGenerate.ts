/**
 * Auto-Generate Article Topics from Trend Signals
 * Monitors trends and creates topics when thresholds are met
 */

import { prisma } from '@/lib/prisma';
import { generateTopicContent, validateGeneratedContent } from './generateContent';

// Configuration for auto-triggering
const AUTO_TRIGGER_CONFIG = {
  minGrowthRate: 0.25, // 25% growth
  minMagnitude: 0.3, // Signal strength threshold
  cooldownDays: 30, // Don't re-trigger same topic within 30 days
  maxTopicsPerRun: 5, // Maximum topics to generate per run
};

/**
 * Slugify a title for URL use
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Determine target roles based on topic type
 */
function determineTargetRoles(topicType: string): string[] {
  switch (topicType) {
    case 'material':
      return ['DESIGNER', 'VENDOR'];
    case 'style':
      return ['DESIGNER', 'INDIVIDUAL'];
    case 'product':
      return ['DESIGNER', 'VENDOR'];
    default:
      return ['DESIGNER', 'VENDOR', 'INDIVIDUAL'];
  }
}

interface GeneratedTopic {
  id: string;
  title: string;
  slug: string;
  category: string;
  signalTopic: string;
  growthRate: number;
}

/**
 * Check for qualifying trend signals and generate topics
 */
export async function checkAndGenerateTopics(): Promise<GeneratedTopic[]> {
  // Find TrendSignals that qualify for auto-topic generation
  const qualifyingSignals = await prisma.trendSignal.findMany({
    where: {
      growthRate: { gte: AUTO_TRIGGER_CONFIG.minGrowthRate },
      magnitude: { gte: AUTO_TRIGGER_CONFIG.minMagnitude },
      status: 'detected', // Not already processed
      // No existing topic generated from this signal
      generatedTopics: { none: {} },
    },
    orderBy: { growthRate: 'desc' },
    take: AUTO_TRIGGER_CONFIG.maxTopicsPerRun,
  });

  console.log(`[autoGenerate] Found ${qualifyingSignals.length} qualifying signals`);

  const generated: GeneratedTopic[] = [];

  for (const signal of qualifyingSignals) {
    try {
      // Check cooldown - don't create duplicate topics on same subject
      const recentSimilar = await prisma.articleTopic.findFirst({
        where: {
          OR: [
            { tags: { hasSome: [signal.topic.toLowerCase()] } },
            { title: { contains: signal.topic, mode: 'insensitive' } },
          ],
          createdAt: {
            gte: new Date(
              Date.now() - AUTO_TRIGGER_CONFIG.cooldownDays * 24 * 60 * 60 * 1000
            ),
          },
        },
      });

      if (recentSimilar) {
        console.log(`[autoGenerate] Skipping "${signal.topic}" - similar topic exists: ${recentSimilar.title}`);
        continue;
      }

      // Generate topic content
      const content = await generateTopicContent({
        topic: signal.topic,
        topicType: signal.topicType,
        growthRate: signal.growthRate,
        topProducts: signal.topProducts,
      });

      // Validate content
      if (!validateGeneratedContent(content)) {
        console.warn(`[autoGenerate] Generated content failed validation for "${signal.topic}"`);
        continue;
      }

      // Generate unique slug
      let baseSlug = slugify(content.title);
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.articleTopic.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Create topic in QUEUED status (admin must activate)
      const topic = await prisma.articleTopic.create({
        data: {
          title: content.title,
          slug,
          promptQuestion: content.promptQuestion,
          description: `Auto-generated from TrendSignal. Growth rate: ${(signal.growthRate * 100).toFixed(1)}%. Magnitude: ${(signal.magnitude * 100).toFixed(1)}%.`,
          category: signal.topicType,
          tags: [signal.topic.toLowerCase(), ...content.suggestedTags],
          targetRoles: determineTargetRoles(signal.topicType),
          targetMaterials: signal.topicType === 'material' ? [signal.topic.toLowerCase()] : [],
          targetStyles: signal.topicType === 'style' ? [signal.topic.toLowerCase()] : [],
          minContributions: 5,
          targetContributions: 15,
          minDesigners: 3,
          autoTriggered: true,
          triggerSignalId: signal.id,
          status: 'QUEUED',
        },
      });

      // Mark signal as processed
      await prisma.trendSignal.update({
        where: { id: signal.id },
        data: { status: 'topic_generated' },
      });

      generated.push({
        id: topic.id,
        title: topic.title,
        slug: topic.slug,
        category: topic.category,
        signalTopic: signal.topic,
        growthRate: signal.growthRate,
      });

      console.log(`[autoGenerate] Created topic: "${topic.title}" from signal "${signal.topic}"`);
    } catch (error) {
      console.error(`[autoGenerate] Error processing signal "${signal.topic}":`, error);
    }
  }

  return generated;
}

/**
 * Get count of signals eligible for auto-generation
 */
export async function getEligibleSignalCount(): Promise<number> {
  return prisma.trendSignal.count({
    where: {
      growthRate: { gte: AUTO_TRIGGER_CONFIG.minGrowthRate },
      magnitude: { gte: AUTO_TRIGGER_CONFIG.minMagnitude },
      status: 'detected',
      generatedTopics: { none: {} },
    },
  });
}

/**
 * Preview what topics would be generated without actually creating them
 */
export async function previewAutoGeneration(): Promise<
  Array<{
    signalTopic: string;
    signalType: string;
    growthRate: number;
    magnitude: number;
    proposedTitle: string;
    proposedQuestion: string;
    wouldCreate: boolean;
    skipReason?: string;
  }>
> {
  const qualifyingSignals = await prisma.trendSignal.findMany({
    where: {
      growthRate: { gte: AUTO_TRIGGER_CONFIG.minGrowthRate },
      magnitude: { gte: AUTO_TRIGGER_CONFIG.minMagnitude },
      status: 'detected',
      generatedTopics: { none: {} },
    },
    orderBy: { growthRate: 'desc' },
    take: 10,
  });

  const previews = [];

  for (const signal of qualifyingSignals) {
    // Check cooldown
    const recentSimilar = await prisma.articleTopic.findFirst({
      where: {
        OR: [
          { tags: { hasSome: [signal.topic.toLowerCase()] } },
          { title: { contains: signal.topic, mode: 'insensitive' } },
        ],
        createdAt: {
          gte: new Date(
            Date.now() - AUTO_TRIGGER_CONFIG.cooldownDays * 24 * 60 * 60 * 1000
          ),
        },
      },
    });

    const content = await generateTopicContent({
      topic: signal.topic,
      topicType: signal.topicType,
      growthRate: signal.growthRate,
      topProducts: signal.topProducts,
    });

    previews.push({
      signalTopic: signal.topic,
      signalType: signal.topicType,
      growthRate: signal.growthRate,
      magnitude: signal.magnitude,
      proposedTitle: content.title,
      proposedQuestion: content.promptQuestion,
      wouldCreate: !recentSimilar,
      skipReason: recentSimilar ? `Similar topic exists: "${recentSimilar.title}"` : undefined,
    });
  }

  return previews;
}
