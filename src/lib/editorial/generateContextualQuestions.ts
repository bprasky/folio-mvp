import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

interface ImageClassification {
  colors?: string[];
  materials?: string[];
  styles?: string[];
  mood?: string[];
  elements?: string[];
  spaces?: string[];
}

export interface ContextualQuestion {
  id: string;
  questionText: string;
  questionType: 'contextual';
  source: 'ai_classification';
  linkedImageId: string;
  linkedProductId?: string;
  attributeType: 'color' | 'material' | 'style' | 'mood' | 'element';
  attributeValue: string;
  roomContext?: string;
  aiConfidence?: number;
}

const QUESTION_TEMPLATES = {
  color: [
    "What drew you to {value} for this space?",
    "The {value} tones really set the mood here. What influenced that choice?",
    "Tell us about the color story - particularly the {value}.",
  ],
  material: [
    "Tell us about the {value} - what led you to that choice?",
    "The {value} is striking. What made it right for this project?",
    "Walk us through your thinking on the {value} selection.",
  ],
  style: [
    "The space feels very {value}. Was that the direction from the start?",
    "There's a clear {value} sensibility here. How did that evolve?",
    "What does {value} mean to you in this context?",
  ],
  mood: [
    "There's a {value} atmosphere throughout. How did you achieve that?",
    "The {value} quality is palpable. Was that intentional?",
    "Tell us about creating this {value} feeling.",
  ],
  element: [
    "The {value} really anchors the space. What's the story there?",
    "Tell us about the {value} - it's such a focal point.",
    "How did the {value} come into the design?",
  ],
};

function pickTemplate(templates: string[]): string {
  return templates[Math.floor(Math.random() * templates.length)];
}

function generateQuestion(
  attributeType: keyof typeof QUESTION_TEMPLATES,
  value: string,
  imageId: string,
  roomContext?: string
): ContextualQuestion {
  const template = pickTemplate(QUESTION_TEMPLATES[attributeType]);
  const questionText = template.replace('{value}', value);
  
  return {
    id: randomUUID(),
    questionText,
    questionType: 'contextual',
    source: 'ai_classification',
    linkedImageId: imageId,
    attributeType,
    attributeValue: value,
    roomContext,
  };
}

export async function generateContextualQuestions(
  projectId: string,
  maxQuestionsPerType: number = 2,
  maxTotalQuestions: number = 6
): Promise<ContextualQuestion[]> {
  // Fetch images with AI classification
  const images = await prisma.projectImage.findMany({
    where: {
      projectId,
      aiClassification: { not: null },
    },
    select: {
      id: true,
      aiClassification: true,
      room: true,
    },
    orderBy: {
      displayOrder: 'asc',
    },
  });

  if (images.length === 0) {
    return [];
  }

  const questions: ContextualQuestion[] = [];
  const usedAttributes = new Set<string>(); // Avoid duplicate questions

  for (const image of images) {
    const classification = image.aiClassification as ImageClassification | null;
    if (!classification) continue;

    const roomContext = image.room || undefined;

    // Process each attribute type
    const attributeTypes: Array<{ key: keyof ImageClassification; type: keyof typeof QUESTION_TEMPLATES }> = [
      { key: 'colors', type: 'color' },
      { key: 'materials', type: 'material' },
      { key: 'styles', type: 'style' },
      { key: 'mood', type: 'mood' },
      { key: 'elements', type: 'element' },
    ];

    for (const { key, type } of attributeTypes) {
      const values = classification[key];
      if (!values || values.length === 0) continue;

      // Take first value (highest confidence) if not already used
      const value = values[0];
      const attributeKey = `${type}:${value.toLowerCase()}`;
      
      if (usedAttributes.has(attributeKey)) continue;
      
      const typeQuestions = questions.filter(q => q.attributeType === type);
      if (typeQuestions.length >= maxQuestionsPerType) continue;
      
      if (questions.length >= maxTotalQuestions) break;

      usedAttributes.add(attributeKey);
      questions.push(generateQuestion(type, value, image.id, roomContext));
    }

    if (questions.length >= maxTotalQuestions) break;
  }

  return questions;
}

