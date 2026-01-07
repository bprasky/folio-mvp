import { generateContextualQuestions, ContextualQuestion } from './generateContextualQuestions';

// Base questions from existing question bank
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
}

export async function getInterviewQuestions(projectId: string): Promise<InterviewQuestion[]> {
  // Get contextual questions from AI classification
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
  
  return merged;
}
