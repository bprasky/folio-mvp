/** Versioned, authored interview activities. Browsing and answering make no model calls. */
export const ACTIVITY_VERSION = 1;
export const ACTIVITY_FORMATS = {
  twenty_questions: { label: '20 Questions with Folio', description: 'Twenty short answers about your eye, choices and way of working.' },
  qa: { label: 'Q&A', description: 'Five questions that uncover a specific story.' },
  material: { label: 'Material story', description: 'Explain one material through an actual choice and its result.' },
  method: { label: 'How it came together', description: 'Walk through a design decision from first thought to finished work.' },
  history: { label: 'The story of the firm', description: 'Tell the moments that shaped your practice.' },
} as const;
export type ActivityFormat = keyof typeof ACTIVITY_FORMATS;
export type ActivitySubject = 'designer' | 'firm' | 'project';
export interface ActivityBrief {
  subject: ActivitySubject;
  projectId?: string;
  roomId?: string;
  format: ActivityFormat;
  topic: string;
  destinations: ('folio' | 'instagram' | 'linkedin')[];
}
export interface ActivityContext {
  designerName: string;
  firmName: string;
  projects: { id: string; title: string; rooms: { id: string; name: string }[] }[];
  profile: { hasBio: boolean; hasPointOfView: boolean };
}
export interface ActivityQuestion { id: string; prompt: string; hint: string; needsExample: boolean }
export interface ActivityDefinition {
  version: number; brief: ActivityBrief; title: string; subjectLabel: string;
  intro: string; questions: ActivityQuestion[];
}
export interface ActivityAnswer { questionId: string; text: string }
export interface ActivityDraft {
  title: string;
  entries: { questionId: string; question: string; answer: string }[];
  socialOptions: { questionId: string; text: string }[];
}

const PERSONAL_TWENTY = [
  'What object first made you pay attention to design?',
  'What do you notice first when you enter a room?',
  'Which part of a room do you like to design first?',
  'What material do you enjoy handling?',
  'Which color are you drawn to lately?',
  'What makes a chair worth keeping?',
  'Where do you look for a reference outside interiors?',
  'What is one detail you keep noticing on walks?',
  'What do you sketch most often?',
  'What question do you ask at a first client meeting?',
  'What tells you a room feels comfortable?',
  'What is one small decision that changed a recent project?',
  'What tool do you reach for every day?',
  'What do you like to collect?',
  'What do you test in person before specifying it?',
  'What has a collaborator taught you?',
  'Which place has changed the way you see light?',
  'What detail do you hope someone notices in your work?',
  'What are you curious to try next?',
  'What piece of advice would you give someone developing their eye?',
];
const FIRM_TWENTY = [
  'What brought the firm into being?', 'What was the first kind of work the firm took on?',
  'What idea guides the practice today?', 'What do you notice first on a site visit?',
  'What question starts a client conversation?', 'Where does a project usually begin on your desk?',
  'What do you like to draw by hand?', 'What material rewards a closer look?',
  'What makes a sample worth keeping?', 'What do you always test in person?',
  'How do you bring another perspective into a design?', 'What detail has become a signature of your work?',
  'What is a small design decision that mattered on a recent job?', 'What has a collaborator taught the firm?',
  'Where do you look for references outside interiors?', 'What does comfort mean in your work?',
  'What tells you a project is coming together?', 'What do you hope clients notice after living in a space?',
  'What is the practice learning now?', 'What would you like the firm to explore next?',
];
const PROJECT_TWENTY = [
  'What was the starting brief?', 'What caught your eye on your first visit?',
  'What did the space need to make possible?', 'What was the first decision you made?',
  'What became the organizing idea?', 'What guided the palette?',
  'Which material did you choose first?', 'What mattered most about that material?',
  'What did you test with a sample or mock-up?', 'What guided the lighting?',
  'What object helps explain the design?', 'What small detail took careful thought?',
  'How did you approach the way people move through the space?', 'What choice made it more comfortable?',
  'What did a collaborator contribute?', 'What did you learn from seeing the work take shape?',
  'What was one alternative you considered before the final choice?', 'What tells you that choice worked?',
  'What do you hope someone notices when they spend time here?', 'What idea from this work will you carry forward?',
];

function validBrief(input: ActivityBrief, context: ActivityContext): { subjectLabel: string; brief: ActivityBrief } {
  if (!input || !['designer', 'firm', 'project'].includes(input.subject) || !Object.hasOwn(ACTIVITY_FORMATS, input.format)) throw new Error('Choose a subject and activity.');
  if (typeof input.topic !== 'string' || input.topic.length > 160) throw new Error('Keep the focus under 160 characters.');
  if (!Array.isArray(input.destinations) || !input.destinations.length || input.destinations.length > 3 ||
      input.destinations.some(value => !['folio', 'instagram', 'linkedin'].includes(value))) throw new Error('Choose at least one destination.');
  if (input.subject !== 'project' && (input.projectId || input.roomId)) throw new Error('Project and room selections do not belong to this subject.');
  if (input.format === 'history' && input.subject !== 'firm') throw new Error('Firm history needs the firm as its subject.');
  const project = context.projects.find(item => item.id === input.projectId);
  if (input.subject === 'project' && !project) throw new Error('Choose an available project.');
  const room = project?.rooms.find(item => item.id === input.roomId);
  if (input.roomId && !room) throw new Error('Choose a room from this project.');
  if (input.format === 'material' && !input.topic.trim()) throw new Error('Name the material or material decision you want to explore.');
  return { brief: { ...input, topic: input.topic.trim(), destinations: Array.from(new Set(input.destinations)) },
    subjectLabel: input.subject === 'designer' ? context.designerName : input.subject === 'firm' ? context.firmName
      : room ? `${room.name} at ${project!.title}` : project!.title };
}

export function createActivity(input: ActivityBrief, context: ActivityContext): ActivityDefinition {
  const { brief, subjectLabel } = validBrief(input, context);
  const focus = brief.topic || subjectLabel;
  const questions = brief.format === 'twenty_questions'
    ? brief.subject === 'project' ? PROJECT_TWENTY : brief.subject === 'firm' ? FIRM_TWENTY : PERSONAL_TWENTY
    : brief.format === 'history' ? [
      'What led you to start the firm?', 'What early project helped define the practice?',
      'What moment changed the way the firm works?', 'What principle has stayed with you?', 'What are you building toward now?',
    ] : brief.format === 'material' ? [
      `Where have you used ${focus}?`, 'What did that setting need from the material?',
      'What made you choose the final specification?', 'What did you learn from a sample or installation?',
      'What should someone understand before making a similar choice?',
    ] : brief.format === 'method' ? [
      'Which decision would you like to walk us through?', 'What did the situation call for?',
      'What did you try before the choice landed?', 'What detail made the final approach work?',
      'What tells you the approach succeeded?',
    ] : [
      `What would you like someone to understand about ${focus}?`,
      'Which specific moment or decision best explains that?', 'What guided your choice?',
      'What detail makes the result work?', 'What would you want another designer to take from this?',
    ];
  return { version: ACTIVITY_VERSION, brief, subjectLabel,
    title: `${ACTIVITY_FORMATS[brief.format].label}: ${subjectLabel}`,
    intro: brief.format === 'twenty_questions' ? 'Twenty questions, in your words. Short answers are welcome. You can pause and come back.'
      : 'Use a real example. Your original answers stay intact when you review the draft.',
    questions: questions.map((prompt, index) => ({ id: `${brief.format}:v${ACTIVITY_VERSION}:${index + 1}`, prompt,
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
    ready: !missing.length };
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
