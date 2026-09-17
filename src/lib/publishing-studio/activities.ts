/** Versioned activity structure. Questions are prepared from context on explicit start. */
export const ACTIVITY_VERSION = 2;
export const ACTIVITY_FORMATS = {
  twenty_questions: { label: '20 Questions with Folio', description: 'Twenty short answers about your eye, choices and way of working.' },
  qa: { label: 'Q&A', description: 'Five questions that uncover a specific story.' },
  material: { label: 'Material story', description: 'Explain one material through an actual choice and its result.' },
  method: { label: 'How it came together', description: 'Walk through a design decision from first thought to finished work.' },
  history: { label: 'The story of the firm', description: 'Tell the moments that shaped your practice.' },
} as const;
export type ActivityFormat = keyof typeof ACTIVITY_FORMATS;
export type ActivitySubject = 'designer' | 'firm' | 'project';
const SUBJECT_FORMATS: Record<ActivitySubject, readonly ActivityFormat[]> = {
  designer: ['twenty_questions', 'qa', 'material', 'method'],
  firm: ['history', 'qa', 'twenty_questions'],
  project: ['twenty_questions', 'qa', 'material', 'method'],
};

/** Shared by visible choices and server-side brief validation. */
export function activityFormatsFor(subject: ActivitySubject) {
  return SUBJECT_FORMATS[subject].map(key => {
    const format = ACTIVITY_FORMATS[key];
    if (subject === 'firm') {
      const firmFormats = {
        history: { label: 'How the firm began', description: 'The origins and milestones that shaped the practice.' },
        qa: { label: 'The people behind the firm', description: 'A conversation about the people and ideas that shaped its history.' },
        twenty_questions: { label: '20 Questions about the firm', description: 'A quick look at its beginnings, defining moments and evolution.' },
      };
      return { key, ...firmFormats[key as keyof typeof firmFormats] };
    }
    if (subject === 'designer' && key === 'method') return { key, label: 'How I work', description: 'Your approach, explained through a real example.' };
    return { key, ...format };
  });
}
export interface ActivityBrief {
  subject: ActivitySubject;
  projectId?: string;
  roomId?: string;
  format: ActivityFormat;
}
export interface ActivityContext {
  designerName: string;
  firmName: string;
  projects: { id: string; title: string; rooms: { id: string; name: string }[] }[];
  profile: { hasBio: boolean; hasPointOfView: boolean };
  references?: ActivityReference[];
}
export interface ActivityReference { id: string; kind: 'bio' | 'firm' | 'project'; text: string; projectId?: string; roomId?: string }
export interface ActivityQuestion { id: string; prompt: string; hint: string; needsExample: boolean; sourceIds?: string[]; evidence?: { sourceId: string; quote: string }[] }
export interface ActivityDefinition {
  questionSource: 'template' | 'personalized';
  version: number; brief: ActivityBrief; title: string; subjectLabel: string;
  intro: string; questions: ActivityQuestion[];
}
export interface ActivityAnswer { questionId: string; text: string }
export interface ActivityDraft {
  title: string;
  entries: { questionId: string; question: string; answer: string }[];
  socialOptions: { questionId: string; text: string }[];
}

function validBrief(input: ActivityBrief, context: ActivityContext): { subjectLabel: string; brief: ActivityBrief } {
  if (!input || !['designer', 'firm', 'project'].includes(input.subject) || !Object.hasOwn(ACTIVITY_FORMATS, input.format)) throw new Error('Choose a subject and activity.');
  if (input.subject !== 'project' && (input.projectId || input.roomId)) throw new Error('Project and room selections do not belong to this subject.');
  if (!SUBJECT_FORMATS[input.subject].includes(input.format)) throw new Error('This story type is not available for this topic. Choose a matching activity.');
  const project = context.projects.find(item => item.id === input.projectId);
  if (input.subject === 'project' && !project) throw new Error('Choose an available project.');
  const room = project?.rooms.find(item => item.id === input.roomId);
  if (input.roomId && !room) throw new Error('Choose a room from this project.');
  return { brief: { subject: input.subject, format: input.format, ...(input.projectId ? { projectId: input.projectId } : {}), ...(input.roomId ? { roomId: input.roomId } : {}) },
    subjectLabel: input.subject === 'designer' ? context.designerName : input.subject === 'firm' ? context.firmName
      : room ? `${room.name} at ${project!.title}` : project!.title };
}

export function createActivity(input: ActivityBrief, context: ActivityContext): ActivityDefinition {
  const { brief, subjectLabel } = validBrief(input, context);
  const count = brief.format === 'twenty_questions' ? 20 : 5;
  return { questionSource: 'template', version: ACTIVITY_VERSION, brief, subjectLabel,
    title: `${activityFormatsFor(brief.subject).find(format => format.key === brief.format)!.label}: ${subjectLabel}`,
    intro: brief.format === 'twenty_questions' ? 'Twenty questions, in your words. Short answers are welcome. You can pause and come back.'
      : 'Use a real example. Your original answers stay intact when you review the draft.',
    questions: Array.from({ length: count }, (_, index) => ({ id: `${brief.format}:v${ACTIVITY_VERSION}:${index + 1}`, prompt: '',
      hint: brief.format === 'twenty_questions' ? 'A short, specific answer is enough. You can return to this question.'
        : 'An object, decision, moment or result helps the reader picture what you mean.',
      needsExample: brief.format !== 'twenty_questions' && index === 1 })),
  };
}

/** Only answered, reviewed activity content can become a draft; no inferred biography or testimony. */
export function activityProgress(definition: ActivityDefinition, answers: ActivityAnswer[]) {
  const ids = new Set(definition.questions.map(question => question.id));
  if (answers.some(answer => !ids.has(answer.questionId) || typeof answer.text !== 'string' || answer.text.length > 8000) ||
      new Set(answers.map(answer => answer.questionId)).size !== answers.length) throw new Error('Invalid interview answers.');
  const byId = new Map(answers.map(answer => [answer.questionId, answer.text.trim()]));
  const missing = definition.questions.filter(question => !byId.get(question.id)).map(question => question.id);
  const needsDetail = definition.questions.filter(question => question.needsExample &&
    (byId.get(question.id)?.split(/\s+/).length || 0) < 12).map(question => question.id);
  return { answered: definition.questions.length - missing.length, total: definition.questions.length, missing, needsDetail,
    ready: definition.questionSource === 'personalized' && definition.questions.every(question => question.prompt.trim()) && definition.questions.length === (definition.brief.format === 'twenty_questions' ? 20 : 5) && !missing.length };
}

export function prepareActivityDraft(definition: ActivityDefinition, answers: ActivityAnswer[], reviewed: boolean): ActivityDraft {
  if (!reviewed) throw new Error('Review your answers before preparing the draft.');
  if (!activityProgress(definition, answers).ready) throw new Error('Finish the interview first.');
  const byId = new Map(answers.map(answer => [answer.questionId, answer.text]));
  const entries = definition.questions.map(question => ({ questionId: question.id, question: question.prompt, answer: byId.get(question.id)! }));
  return { title: definition.title, entries,
    socialOptions: entries.filter(entry => entry.answer.trim().length <= 1800).map(entry => ({ questionId: entry.questionId,
      text: `${entry.question}\n\n${entry.answer}` })) };
}

export function profileActivitySuggestions(context: ActivityContext) {
  const suggestions: { label: string; reason: string; subject: ActivitySubject; format: ActivityFormat }[] = [];
  if (!context.profile.hasBio) suggestions.push({ label: 'Introduce yourself', reason: 'Your profile does not yet have an introduction.', subject: 'designer', format: 'twenty_questions' });
  if (!context.profile.hasPointOfView) suggestions.push({ label: 'Share your point of view', reason: 'Your profile does not yet describe how you approach the work.', subject: 'designer', format: 'qa' });
  return suggestions;
}
