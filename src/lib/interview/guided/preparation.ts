import { createHash, randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { computeGlobalGates, computeRoomBudget } from '@/lib/editorial/roomPacing';
import { assessProjectContext } from '../contextLevel';
import { generateProjectQuestions, PROJECT_QUESTION_CATEGORIES } from '../generateProjectQuestions';
import { generateRoomQuestions } from '../generateRoomQuestions';
import { distillInterviewFacts } from '../distillInterviewFacts';
import { validateInterviewQuestion } from '../prompts/validateQuestion';
import { GuidedKnownFactsSchema, PreparedCandidateSchema } from './preparation.schemas';
import type { GuidedPreparation, GuidedQuestion, GuidedRoom, GuidedSession } from './types';

const PROJECT_FALLBACKS = {
  CLIENT_BRIEF: 'What did the clients come to you wanting from this project?',
  SCOPE_PARAMETERS: 'What were you working within on this project?',
  DESIGN_DIRECTION: 'What was the overall design idea for this project?',
  SIGNATURE_IDENTITY: 'What in this project is most recognizably yours?',
  SURPRISE_PIVOT: 'What discovery changed the direction of this project along the way?',
} as const;

const ROOM_FALLBACKS = [
  ['room_intent', 'What did you want this room to make possible?'],
  ['room_use', 'How did you want this room to support daily life?'],
  ['room_layout', 'What shaped the layout of this room?'],
  ['room_connection', 'How did you want this room to relate to the rest of the project?'],
  ['room_atmosphere', 'What did you want this room to feel like?'],
  ['room_identity', 'What does the overall design of this room reveal about your approach?'],
] as const;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The protected spotlight flow uses vetted wording for the same reason: a
 * schema and a product-name blocklist cannot exclude unknown visual descriptors.
 * Keep model wording only when its entire meaning fits a room/project grammar.
 * Room names substitute only from exact persisted IDs, never from photo labels. */
export function isGuidedPreparedWordingSafe(text: string, roomNames: string[], projectCategory?: string): boolean {
  if (text.length > 600 || !validateInterviewQuestion(text).ok) return false;
  let normalized = text.trim().replace(/[’]/g, "'");
  for (const name of [...roomNames].sort((a, b) => b.length - a.length)) {
    if (name.trim()) normalized = normalized.replace(new RegExp(`\\b${escapeRegex(name.trim())}\\b`, 'gi'), 'this room');
  }
  normalized = normalized.replace(/\bthe this room\b/gi, 'this room').replace(/\s+/g, ' ').toLowerCase();
  const project = projectCategory && PROJECT_FALLBACKS[projectCategory as keyof typeof PROJECT_FALLBACKS];
  if (project && normalized === project.toLowerCase()) return true;
  if (projectCategory) {
    const grammars: Record<string, RegExp[]> = {
      CLIENT_BRIEF: [/^who was (?:this (?:project|home)|the project) (?:really )?for\?$/, /^what (?:did the clients|did your clients|were the clients) (?:come to you wanting|looking for|hoping for|want) (?:from (?:this|the) project|when (?:you|they) started)\?$/],
      SCOPE_PARAMETERS: [/^what (?:were you (?:starting|working) with|was the (?:scope|starting point|timeline|budget)) (?:on this (?:one|project)|for this project|when you (?:began|started))\?$/],
      DESIGN_DIRECTION: [/^what (?:was|is) (?:the|your) (?:big idea|overall (?:design )?(?:idea|direction)|design (?:idea|direction|concept)) (?:for|behind) (?:this|the) project\?$/],
      SIGNATURE_IDENTITY: [/^what (?:in|about) this project (?:is|feels) most (?:recognizably |distinctly )?(?:yours|like you)\?$/],
      SURPRISE_PIVOT: [/^what (?:changed|evolved|shifted) (?:along the way|during (?:this|the) project|from (?:your|the) original (?:idea|concept|plan))\?$/],
    };
    return (grammars[projectCategory] ?? []).some(re => re.test(normalized));
  }
  if (ROOM_FALLBACKS.some(([, wording]) => wording.toLowerCase() === normalized)) return true;
  return [
    /^what did you want (?:this|the) room to (?:feel like|make possible|do for the clients|support)\?$/,
    /^how (?:did|does) (?:this|the) room (?:relate|connect|respond) to (?:this room|the (?:rest of the (?:project|home|house)|adjacent spaces|surrounding rooms))\?$/,
    /^how did you (?:want|design) (?:this|the) room to (?:support (?:daily life|the clients' routines|everyday use)|work for (?:daily life|the clients' routines|everyday use))\?$/,
    /^what (?:shaped|informed|guided) (?:the layout|the overall composition|the spatial (?:layout|arrangement)) of (?:this|the) room\?$/,
    /^how did (?:the layout|the overall composition|the spatial arrangement) of (?:this|the) room (?:evolve|come together)\?$/,
  ].some(re => re.test(normalized));
}

export async function readGuidedContext(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true, title: true, description: true, projectType: true, clientType: true,
      budgetBand: true, city: true, regionState: true,
      designer: { select: { name: true } }, designerOrg: { select: { name: true } },
      rooms: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: {
        id: true, name: true, type: true, selections: { select: { id: true } },
      } },
      images: { where: { inclusion: 'INCLUDED' }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }], select: {
        id: true, url: true, roomId: true, room: true, aiClassification: true,
        tags: { select: { id: true, productId: true } },
      } },
    },
  });
  if (!project) throw new Error('Project is unavailable.');
  const roomIds = new Set(project.rooms.map(room => room.id));
  // Legacy values are accepted only when they contain an actual persisted room
  // ID. A display name cannot establish question or answer attribution.
  const images = project.images.map(image => ({ ...image,
    roomId: image.roomId && roomIds.has(image.roomId) ? image.roomId :
      !image.roomId && image.room && roomIds.has(image.room) ? image.room : null,
  }));
  const rooms: GuidedRoom[] = project.rooms.map(room => {
    const sourceImages = images.filter(image => image.roomId === room.id);
    const tagCount = Math.max(room.selections.length, sourceImages.reduce((sum, image) => sum + image.tags.length, 0));
    return { id: room.id, name: room.name, imageIds: sourceImages.map(image => image.id), ...computeRoomBudget(sourceImages.length, tagCount) };
  });
  const contextFingerprint = createHash('sha256').update(JSON.stringify({
    project: [project.id, project.title, project.description, project.projectType, project.clientType, project.budgetBand, project.city, project.regionState],
    rooms: rooms.map(room => [room.id, room.name, room.baseQuestions, room.maxFollowUps,
      project.rooms.find(value => value.id === room.id)?.selections.map(selection => selection.id).sort()]),
    images: images.map(image => [image.id, image.roomId, image.url, image.aiClassification, image.tags.map(tag => [tag.id, tag.productId]).sort()]),
  })).digest('hex');
  return { project, images, rooms, contextFingerprint };
}

function candidates(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  // A malformed neighbor cannot erase valid prepared identities. Keep failed
  // slots in place so only their own obligations receive fallback wording.
  return raw.map(value => {
    const parsed = PreparedCandidateSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  });
}

export function adaptGuidedProjectQuestions(raw: unknown, rooms: GuidedRoom[], sourceImageIds: string[]): GuidedQuestion[] {
  const generated = candidates(raw);
  return PROJECT_QUESTION_CATEGORIES.map(category => {
    const candidate = generated.find(q => q && (q.id.startsWith(`project-${category}-`) || q.topic === `project_${category.toLowerCase()}`));
    const safe = !!candidate && !candidate.products?.length && !candidate.vendors?.length && !candidate.linkedProductId &&
      isGuidedPreparedWordingSafe(candidate.text, rooms.map(room => room.name), category);
    return {
      id: candidate?.id ?? `project-${category}-${randomUUID()}`, category,
      text: safe ? candidate!.text : PROJECT_FALLBACKS[category],
      ...(candidate ? { preparedText: candidate.text } : {}),
      preparationStatus: safe ? 'validated' : 'safe_fallback',
      ...(!safe ? { validationReason: candidate ? 'Prepared wording could not be verified as one project-level question.' : 'The generator did not return this required project category.' } : {}),
      roomId: null, sourceImageIds, sourceAnswerIds: [], status: 'pending', kind: 'prepared',
    };
  });
}

export function adaptGuidedRoomQuestions(raw: unknown, room: GuidedRoom, sourceAnswerIds: string[], roomNames: string[]): GuidedQuestion[] {
  const generated = candidates(raw);
  // No total-project cap discards a room obligation. Fill missing generator
  // slots; retain all returned slots, even if the model exceeded its request.
  return Array.from({ length: Math.max(room.baseQuestions, generated.length) }, (_, index) => {
    const candidate = generated[index];
    const safe = !!candidate && !candidate.products?.length && !candidate.vendors?.length && !candidate.linkedProductId &&
      isGuidedPreparedWordingSafe(candidate.text, roomNames);
    const fallback = ROOM_FALLBACKS[index % ROOM_FALLBACKS.length];
    return {
      id: candidate?.id ?? `guided-room-${room.id}-${randomUUID()}`,
      text: safe ? candidate!.text : fallback[1], category: safe ? candidate?.topic || fallback[0] : fallback[0],
      ...(candidate ? { preparedText: candidate.text, preparedCategory: candidate.topic } : {}),
      preparationStatus: safe ? 'validated' : 'safe_fallback',
      ...(!safe ? { validationReason: candidate ? 'Prepared wording could not be verified as a room-level question without an individual product target.' : 'Required room budget filled after missing or failed generation.' } : {}),
      roomId: room.id, sourceImageIds: room.imageIds.slice(0, 8), sourceAnswerIds,
      status: 'pending', kind: 'prepared',
    };
  });
}

export async function prepareGuidedProjectPlan(projectId: string): Promise<GuidedPreparation> {
  const current = await readGuidedContext(projectId);
  const { project, rooms, images, contextFingerprint } = current;
  const context = await assessProjectContext(projectId);
  const representativeImages = images.filter(image => image.roomId).slice(0, 3);
  let generated: unknown = [];
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== 'false') {
    try {
      generated = (await generateProjectQuestions({
        projectTitle: project.title, projectDescription: project.description ?? undefined,
        designerName: project.designer?.name ?? undefined, studioName: project.designerOrg?.name ?? undefined,
        location: [project.city, project.regionState].filter(Boolean).join(', '),
        projectType: project.projectType, clientType: project.clientType, budgetBand: project.budgetBand,
        representativeImages, roomNames: rooms.map(room => room.name),
        roomTypes: project.rooms.map(room => room.type).filter((type): type is string => !!type),
        materialPalette: context.materialThemes, contextLevel: context.level, respondentRole: 'DESIGNER',
      })).questions;
    } catch { /* Every required category has a deterministic fallback. */ }
  }
  const gates = computeGlobalGates(rooms.map(room => ({ roomId: room.id, roomName: room.name, imageCount: room.imageIds.length, tagCount: 0 })));
  return { questions: adaptGuidedProjectQuestions(generated, rooms, representativeImages.map(image => image.id)), rooms, contextFingerprint, minimumTotalAnswers: gates.minimumTotalAnswers };
}

export async function prepareGuidedRoomPlan(projectId: string, session: GuidedSession): Promise<GuidedQuestion[]> {
  if (session.projectId !== projectId || session.roomsPrepared || session.plan.some(q => q.roomId === null && ['active', 'pending'].includes(q.status)))
    throw new Error('Finish the prepared project section before preparing room questions.');
  const current = await readGuidedContext(projectId);
  if (current.contextFingerprint !== session.contextFingerprint) throw new Error('The project sources changed. Resume to review the current room assignments.');
  const accepted = session.turns.filter(turn => turn.roomId === null && turn.kind !== 'skip' && !turn.supersededBy &&
    session.plan.some(q => q.id === turn.questionId && q.status === 'answered'));
  const rawFacts = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== 'false'
    ? await distillInterviewFacts(accepted.map(turn => ({ prompt: turn.questionText, answer: turn.text })))
    : null;
  const parsedFacts = GuidedKnownFactsSchema.safeParse(rawFacts);
  const context = await assessProjectContext(projectId);
  const sourceAnswerIds = accepted.map(turn => turn.id);
  const results = await Promise.all(session.rooms.map(async room => {
    let generated: unknown = [];
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== 'false') {
      try {
        generated = (await generateRoomQuestions({
          roomName: room.name, roomImages: current.images.filter(image => image.roomId === room.id).map(image => ({ url: image.url, classification: image.aiClassification as Record<string, unknown> | null })),
          // General-room questions cannot select products. The legacy generator's
          // subscription naming lane is deliberately empty in this pilot.
          roomTags: [], budget: room.baseQuestions, contextLevel: context.level,
          projectContext: { projectTitle: current.project.title, otherRoomNames: session.rooms.filter(other => other.id !== room.id).map(other => other.name),
            materialPalette: context.materialThemes, knownFacts: parsedFacts.success ? parsedFacts.data : null },
        })).questions;
      } catch { /* Retain the room's complete budget when one model call fails. */ }
    }
    return adaptGuidedRoomQuestions(generated, room, sourceAnswerIds, session.rooms.map(value => value.name));
  }));
  return results.flat();
}
