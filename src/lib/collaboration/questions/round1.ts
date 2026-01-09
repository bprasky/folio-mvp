/**
 * Round 1: Static baseline questions for Collaboration Stories
 * These questions establish the foundation for the collaboration narrative
 */

export type CollaborationQuestion = {
  id: string;
  role: 'VENDOR' | 'DESIGNER';
  category: 'relationship' | 'project' | 'process' | 'philosophy' | 'outcome';
  prompt: string;
  helper?: string;
  maxLen?: number;
};

// Vendor Round 1 Questions - Focus on partnership and product perspective
export const VENDOR_ROUND1_QUESTIONS: CollaborationQuestion[] = [
  // Relationship
  {
    id: 'v1-relationship-1',
    role: 'VENDOR',
    category: 'relationship',
    prompt: 'How did you first connect with this designer, and what stood out about their approach?',
    helper: 'Think about the initial interaction or project that brought you together.',
  },
  {
    id: 'v1-relationship-2',
    role: 'VENDOR',
    category: 'relationship',
    prompt: 'What makes this designer particularly effective to work with from a vendor perspective?',
  },

  // Project
  {
    id: 'v1-project-1',
    role: 'VENDOR',
    category: 'project',
    prompt: 'Describe a project where this collaboration really clicked. What made it special?',
  },
  {
    id: 'v1-project-2',
    role: 'VENDOR',
    category: 'project',
    prompt: 'How did your products contribute to the designer\'s vision in memorable ways?',
  },

  // Process
  {
    id: 'v1-process-1',
    role: 'VENDOR',
    category: 'process',
    prompt: 'Walk us through how you typically collaborate on specifications and selections.',
    helper: 'Consider communication style, decision-making, and problem-solving.',
  },
  {
    id: 'v1-process-2',
    role: 'VENDOR',
    category: 'process',
    prompt: 'How do you handle requests for customization or unique applications of your products?',
  },

  // Philosophy
  {
    id: 'v1-philosophy-1',
    role: 'VENDOR',
    category: 'philosophy',
    prompt: 'What do you believe makes a vendor-designer relationship truly successful?',
  },

  // Outcome
  {
    id: 'v1-outcome-1',
    role: 'VENDOR',
    category: 'outcome',
    prompt: 'Has this collaboration influenced how you develop or present your products?',
  },
];

// Designer Round 1 Questions - Focus on creative process and partnership value
export const DESIGNER_ROUND1_QUESTIONS: CollaborationQuestion[] = [
  // Relationship
  {
    id: 'd1-relationship-1',
    role: 'DESIGNER',
    category: 'relationship',
    prompt: 'How did you discover this vendor, and what initially drew you to their work?',
    helper: 'Consider what set them apart from other options.',
  },
  {
    id: 'd1-relationship-2',
    role: 'DESIGNER',
    category: 'relationship',
    prompt: 'What qualities do you value most in your relationship with this vendor?',
  },

  // Project
  {
    id: 'd1-project-1',
    role: 'DESIGNER',
    category: 'project',
    prompt: 'Tell us about a project where their products became central to your design narrative.',
  },
  {
    id: 'd1-project-2',
    role: 'DESIGNER',
    category: 'project',
    prompt: 'Have their products ever surprised you or opened new creative directions?',
  },

  // Process
  {
    id: 'd1-process-1',
    role: 'DESIGNER',
    category: 'process',
    prompt: 'How do you approach sourcing and specifying with this vendor differently than others?',
  },
  {
    id: 'd1-process-2',
    role: 'DESIGNER',
    category: 'process',
    prompt: 'Describe a time when they went above and beyond to support your vision.',
    helper: 'Could be customization, timing, problem-solving, etc.',
  },

  // Philosophy
  {
    id: 'd1-philosophy-1',
    role: 'DESIGNER',
    category: 'philosophy',
    prompt: 'How do strong vendor relationships elevate your work for clients?',
  },

  // Outcome
  {
    id: 'd1-outcome-1',
    role: 'DESIGNER',
    category: 'outcome',
    prompt: 'How has this partnership shaped your approach to material selection or sourcing?',
  },
];

// Combined type for API responses
export type Round1Response = {
  questionId: string;
  answer: string;
  answeredAt: string; // ISO date string
};

export type Round1Data = {
  questions: CollaborationQuestion[];
  responses: Round1Response[];
  completedAt?: string;
};

// Helper to get questions by role
export function getRound1Questions(role: 'VENDOR' | 'DESIGNER'): CollaborationQuestion[] {
  return role === 'VENDOR' ? VENDOR_ROUND1_QUESTIONS : DESIGNER_ROUND1_QUESTIONS;
}

// Helper to check if round 1 is complete for a role
export function isRound1Complete(responses: Round1Response[], role: 'VENDOR' | 'DESIGNER'): boolean {
  const questions = getRound1Questions(role);
  const answeredIds = new Set(responses.map(r => r.questionId));

  // Require at least 5 questions answered (not necessarily all)
  const minRequired = Math.min(5, questions.length);
  const answered = questions.filter(q => answeredIds.has(q.id)).length;

  return answered >= minRequired;
}
