/**
 * Conversational interview questions for the Interview-First Profile system.
 *
 * These replace the 3-layer form-based system with 7 warm, conversational questions.
 * Recognition is intentionally excluded — it's pulled via Publication Search Agent, not self-reported.
 */

export interface ConversationalQuestion {
  id: string;
  question: string;
  extractsTo: string[];
}

export const ORG_ABOUT_QUESTIONS: ConversationalQuestion[] = [
  {
    id: 'founding',
    question: "Tell me about how the studio started — what was the moment or project that made it real?",
    extractsTo: ['foundingYear', 'description', 'philosophy'],
  },
  {
    id: 'approach',
    question: "How would you describe the way you approach a new project? What do you do first?",
    extractsTo: ['processDescription', 'philosophy'],
  },
  {
    id: 'clients',
    question: "What does a long-term client relationship look like for you?",
    extractsTo: ['description', 'philosophy'],
  },
  {
    id: 'location',
    question: "Where are you based, and where does most of your work happen? Do you take projects outside your home market?",
    extractsTo: ['city', 'primaryMarket', 'travelsForWork', 'additionalMarkets'],
  },
  {
    id: 'work_style',
    question: "What kind of work do you take on — residential, commercial, both? Any particular scale or scope you focus on?",
    extractsTo: ['specialties', 'markets'],
  },
  {
    id: 'materials',
    question: "Are there materials, finishes, or details you keep coming back to?",
    extractsTo: ['description', 'philosophy', 'specialties'],
  },
  {
    id: 'team',
    question: "How big is the studio right now, and how do you structure the work?",
    extractsTo: ['teamSize', 'processDescription'],
  },
];

export const PERSONAL_ABOUT_QUESTIONS: ConversationalQuestion[] = [
  {
    id: 'background',
    question: "How did you get into design? What's your origin story?",
    extractsTo: ['bio', 'studio'],
  },
  {
    id: 'philosophy',
    question: "What guides your approach to a project?",
    extractsTo: ['bio', 'designPhilosophy'],
  },
  {
    id: 'specialties',
    question: "What kind of work do you gravitate toward — certain styles, spaces, or project types?",
    extractsTo: ['specialties', 'bio'],
  },
  {
    id: 'location',
    question: "Where are you based, and where do you work?",
    extractsTo: ['location'],
  },
  {
    id: 'current',
    question: "What are you working on right now that excites you?",
    extractsTo: ['bio', 'title'],
  },
];

/**
 * Build a transcript string from conversational answers for extraction.
 */
export function buildTranscriptFromAnswers(
  answers: Record<string, string>,
  questions: ConversationalQuestion[]
): string {
  return questions
    .filter((q) => answers[q.id]?.trim())
    .map((q) => `Q: ${q.question}\nA: ${answers[q.id]}`)
    .join('\n\n');
}
