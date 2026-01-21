import { generateContextualQuestions, ContextualQuestion } from './generateContextualQuestions';
import {
  assessProjectContext,
  generateInterviewQuestions,
  toInterviewQuestion,
  type ContextLevel,
  type GeneratedQuestion,
} from '@/lib/interview';

// Base questions from existing question bank (Level 0 fallback)
const BASE_QUESTIONS = [
  {
    id: 'base_1',
    questionText: "What was the initial brief or vision for this project?",
    questionType: 'base' as const,
    source: 'base_question' as const,
    category: 'brief',
  },
  {
    id: 'base_2',
    questionText: "What was the biggest challenge you faced?",
    questionType: 'base' as const,
    source: 'base_question' as const,
    category: 'process',
  },
  {
    id: 'base_3',
    questionText: "Is there a particular detail or moment you're most proud of?",
    questionType: 'base' as const,
    source: 'base_question' as const,
    category: 'highlight',
  },
  {
    id: 'base_4',
    questionText: "How would you describe the overall aesthetic?",
    questionType: 'base' as const,
    source: 'base_question' as const,
    category: 'aesthetic',
  },
  {
    id: 'base_5',
    questionText: "What do you hope people feel when they experience this space?",
    questionType: 'base' as const,
    source: 'base_question' as const,
    category: 'emotion',
  },
];

export interface InterviewQuestion {
  id: string;
  questionText: string;
  questionType: 'base' | 'contextual' | 'follow_up';
  source: 'base_question' | 'ai_classification' | 'follow_up';
  category?: string;
  linkedImageId?: string;
  linkedProductId?: string;
  attributeType?: string;
  attributeValue?: string;
  roomContext?: string;
  // New fields for contextual interview system
  boostable?: boolean;
  pullQuotePotential?: 'high' | 'medium' | 'low';
  contextLevel?: ContextLevel;
  questionCategory?: string;
  vendors?: string[];
  rooms?: string[];
  products?: string[];
}

export interface InterviewQuestionsResult {
  questions: InterviewQuestion[];
  contextLevel: ContextLevel;
  contextDescription: string;
  upgradeSuggestion: string | null;
}

/**
 * Get interview questions for a project using the contextual interview system.
 * Questions scale with available project context.
 */
export async function getInterviewQuestions(projectId: string): Promise<InterviewQuestion[]> {
  const result = await getInterviewQuestionsWithContext(projectId);
  return result.questions;
}

/**
 * Get interview questions with full context information.
 * Returns questions along with context level and upgrade suggestions.
 */
export async function getInterviewQuestionsWithContext(
  projectId: string,
  options?: {
    maxQuestions?: number;
    prioritizeBoostable?: boolean;
    includeGeneric?: boolean;
  }
): Promise<InterviewQuestionsResult> {
  try {
    // Assess project context to determine what data is available
    const context = await assessProjectContext(projectId);

    // Generate contextual questions based on available data
    const contextualQuestions = await generateInterviewQuestions(context, {
      maxQuestions: options?.maxQuestions || 15,
      prioritizeBoostable: options?.prioritizeBoostable ?? true,
      includeGeneric: options?.includeGeneric ?? false, // Don't include generic by default, we add base questions
    });

    // Also get legacy contextual questions from AI classification (for backward compatibility)
    const legacyContextualQuestions = await generateContextualQuestions(projectId, 2, 4);

    // Convert generated questions to interview format
    const contextualInterviewQuestions: InterviewQuestion[] = contextualQuestions.map((q) => {
      const converted = toInterviewQuestion(q);
      return {
        id: converted.id,
        questionText: converted.questionText,
        questionType: converted.questionType,
        source: converted.source,
        linkedImageId: converted.linkedImageId,
        linkedProductId: converted.linkedProductId,
        attributeType: converted.attributeType,
        attributeValue: converted.attributeValue,
        roomContext: converted.roomContext,
        boostable: converted.boostable,
        pullQuotePotential: converted.pullQuotePotential,
        contextLevel: converted.contextLevel,
        questionCategory: converted.questionCategory,
        vendors: q.vendors,
        rooms: q.rooms,
        products: q.products,
      };
    });

    // Convert legacy contextual questions
    const legacyInterviewQuestions: InterviewQuestion[] = legacyContextualQuestions.map(cq => ({
      id: cq.id,
      questionText: cq.questionText,
      questionType: 'contextual' as const,
      source: 'ai_classification' as const,
      linkedImageId: cq.linkedImageId,
      linkedProductId: cq.linkedProductId,
      attributeType: cq.attributeType,
      attributeValue: cq.attributeValue,
      roomContext: cq.roomContext,
      contextLevel: 1 as ContextLevel,
    }));

    // Deduplicate legacy questions that overlap with new contextual questions
    const contextualIds = new Set(contextualInterviewQuestions.map(q => q.id));
    const contextualTexts = new Set(
      contextualInterviewQuestions.map(q => q.questionText.toLowerCase().slice(0, 50))
    );
    const uniqueLegacy = legacyInterviewQuestions.filter(q =>
      !contextualIds.has(q.id) &&
      !contextualTexts.has(q.questionText.toLowerCase().slice(0, 50))
    );

    // Build merged list: prioritize contextual, then legacy, then base
    const merged: InterviewQuestion[] = [];

    // Add contextual questions first (they're already sorted by priority)
    merged.push(...contextualInterviewQuestions);

    // Add unique legacy contextual questions
    merged.push(...uniqueLegacy);

    // Add base questions at the end
    for (const bq of BASE_QUESTIONS) {
      merged.push({
        id: bq.id,
        questionText: bq.questionText,
        questionType: bq.questionType,
        source: bq.source,
        category: bq.category,
        contextLevel: 0,
      });
    }

    // Get context description and upgrade suggestion
    const { getContextLevelDescription, getContextUpgradeSuggestion } = await import('@/lib/interview');

    return {
      questions: merged,
      contextLevel: context.level,
      contextDescription: getContextLevelDescription(context.level),
      upgradeSuggestion: getContextUpgradeSuggestion(context.level),
    };
  } catch (error) {
    console.error('[getInterviewQuestions] Error generating contextual questions:', error);

    // Fall back to legacy behavior if the new system fails
    return fallbackToLegacyQuestions(projectId);
  }
}

/**
 * Fallback to legacy question generation if the new system fails
 */
async function fallbackToLegacyQuestions(projectId: string): Promise<InterviewQuestionsResult> {
  // Get contextual questions from AI classification (legacy)
  const contextualQuestions = await generateContextualQuestions(projectId);

  // Convert contextual questions to interview format
  const contextualInterviewQuestions: InterviewQuestion[] = contextualQuestions.map(cq => ({
    id: cq.id,
    questionText: cq.questionText,
    questionType: 'contextual' as const,
    source: 'ai_classification' as const,
    linkedImageId: cq.linkedImageId,
    linkedProductId: cq.linkedProductId,
    attributeType: cq.attributeType,
    attributeValue: cq.attributeValue,
    roomContext: cq.roomContext,
  }));

  // Interleave: base question, contextual, base, contextual, etc.
  const merged: InterviewQuestion[] = [];
  const baseQ = [...BASE_QUESTIONS];
  const contextQ = [...contextualInterviewQuestions];

  // Start with brief question
  if (baseQ.length > 0) {
    merged.push({
      id: baseQ[0].id,
      questionText: baseQ[0].questionText,
      questionType: baseQ[0].questionType,
      source: baseQ[0].source,
      category: baseQ[0].category,
    });
    baseQ.shift();
  }

  // Interleave remaining
  while (baseQ.length > 0 || contextQ.length > 0) {
    if (contextQ.length > 0) {
      merged.push(contextQ.shift()!);
    }
    if (baseQ.length > 0) {
      const bq = baseQ.shift()!;
      merged.push({
        id: bq.id,
        questionText: bq.questionText,
        questionType: bq.questionType,
        source: bq.source,
        category: bq.category,
      });
    }
  }

  return {
    questions: merged,
    contextLevel: contextualInterviewQuestions.length > 0 ? 1 : 0,
    contextDescription: contextualInterviewQuestions.length > 0
      ? 'Questions based on project photos'
      : 'No project context available',
    upgradeSuggestion: 'Upload more project files to unlock personalized questions',
  };
}
