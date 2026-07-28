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

// Vendor Round 1 Questions — observational, single-topic. The working relationship is the
// legitimate subject; questions ask for specifics and let the substance emerge (no presumptive
// praise). docs/17 §1 (merit-not-prestige), §2 rule 2 (one question at a time).
export const VENDOR_ROUND1_QUESTIONS: CollaborationQuestion[] = [
  // Relationship
  {
    id: 'v1-relationship-1',
    role: 'VENDOR',
    category: 'relationship',
    prompt: 'How did you first start working with this designer?',
    helper: 'Think about the initial project or interaction that brought you together.',
  },
  {
    id: 'v1-relationship-2',
    role: 'VENDOR',
    category: 'relationship',
    prompt: 'From a vendor\'s side, walk us through what it\'s actually like to work with this designer.',
  },

  // Project
  {
    id: 'v1-project-1',
    role: 'VENDOR',
    category: 'project',
    prompt: 'Walk us through a specific project the two of you worked on together.',
  },
  {
    id: 'v1-project-2',
    role: 'VENDOR',
    category: 'project',
    prompt: 'Tell us about a specific place one of your products ended up in this designer\'s work.',
  },

  // Process
  {
    id: 'v1-process-1',
    role: 'VENDOR',
    category: 'process',
    prompt: 'How do the two of you communicate day-to-day on a project?',
  },
  {
    id: 'v1-process-2',
    role: 'VENDOR',
    category: 'process',
    prompt: 'When there\'s a decision to make on a specification, how do you land on it together?',
  },
  {
    id: 'v1-process-3',
    role: 'VENDOR',
    category: 'process',
    prompt: 'When a spec needs adjusting mid-project, how do you work through it together?',
  },

  // Philosophy
  {
    id: 'v1-philosophy-1',
    role: 'VENDOR',
    category: 'philosophy',
    prompt: 'What do you think makes a vendor-designer relationship work?',
  },

  // Outcome
  {
    id: 'v1-outcome-1',
    role: 'VENDOR',
    category: 'outcome',
    prompt: 'How has working with this designer shown up in how you develop your products, if at all?',
  },
];

// Designer Round 1 Questions — observational, single-topic. The working relationship is the
// legitimate subject; questions ask for specifics and let the substance emerge (no presumptive
// praise). docs/17 §1 (merit-not-prestige), §2 rule 2 (one question at a time).
export const DESIGNER_ROUND1_QUESTIONS: CollaborationQuestion[] = [
  // Relationship
  {
    id: 'd1-relationship-1',
    role: 'DESIGNER',
    category: 'relationship',
    prompt: 'How did you first come across this vendor?',
    helper: 'Think about the project or moment you started working with them.',
  },
  {
    id: 'd1-relationship-2',
    role: 'DESIGNER',
    category: 'relationship',
    prompt: 'Walk us through how you and this vendor actually work together.',
  },

  // Project
  {
    id: 'd1-project-1',
    role: 'DESIGNER',
    category: 'project',
    prompt: 'Tell us about a specific project where you used their products.',
  },
  {
    id: 'd1-project-2',
    role: 'DESIGNER',
    category: 'project',
    prompt: 'Tell us about a specific time one of their products shaped a decision in your work.',
  },

  // Process
  {
    id: 'd1-process-1',
    role: 'DESIGNER',
    category: 'process',
    prompt: 'How do you and this vendor communicate through a project?',
  },
  {
    id: 'd1-process-2',
    role: 'DESIGNER',
    category: 'process',
    prompt: 'When you\'re specifying with them and a choice comes up, how do you land on it?',
  },
  {
    id: 'd1-process-3',
    role: 'DESIGNER',
    category: 'process',
    prompt: 'When something on an order needs sorting out, how do the two of you handle it?',
  },

  // Philosophy
  {
    id: 'd1-philosophy-1',
    role: 'DESIGNER',
    category: 'philosophy',
    prompt: 'How do your vendor relationships show up in the work you deliver to clients?',
  },

  // Outcome
  {
    id: 'd1-outcome-1',
    role: 'DESIGNER',
    category: 'outcome',
    prompt: 'How has working with this vendor shaped how you select materials?',
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
