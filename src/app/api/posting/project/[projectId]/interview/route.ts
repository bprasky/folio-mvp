import { legacyInterviewBoundary } from '@/lib/spotlight/legacyBoundary';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectView, assertProjectWrite } from "@/lib/authz/access";
import {
  normalizeAnswers,
  makeAnswerKey,
  InterviewAnswer,
} from "@/lib/posting/interviewSchemas";
import { makeSlug } from "@/lib/posting/slug";
import {
  rebuildAnswerProjection,
  type AnswerAudioMap,
} from "@/lib/editorial/syncInterviewAnswers";
import { moderateAnswers } from "@/lib/posting/moderation";
import { z } from "zod";
import { randomUUID } from "crypto";
import { Prisma } from '@prisma/client';

// Helper types and functions for tolerant normalization
type QA = {
  id?: string; question?: string; prompt?: string; answer: string; isFollowUp?: boolean;
  section?: string; category?: string; roomId?: string | null; questionSource?: string;
  isCrossRoom?: boolean; inputModality?: string;
  // Carried, not derived. `normalizeQA` runs BEFORE `ensureAnswerShape` and
  // `extractMetadata`, and both of those read their fields off its output — so a
  // key this type does not carry is gone before either reader looks for it.
  //
  // That is not hypothetical: these six were declared first-class in
  // `AnswerBaseSchema` and read by `extractMetadata`, but `normalizeQA` dropped
  // them one step earlier, so the projection's linkage columns were written NULL
  // on every save and `isFeatured` was always false. Declaring a field in the
  // schema is not enough; it has to survive this hop too.
  isFeatured?: boolean;
  role?: string;
  linkedImageId?: string | null;
  linkedProductId?: string | null;
  aiClassificationAttribute?: string | null;
  parentQuestionId?: string | null;
};

/** The answer roles AnswerBaseSchema declares. Unknown input falls back to DESIGNER. */
const ANSWER_ROLES = ['DESIGNER', 'VENDOR', 'ANY'] as const;
type AnswerRole = (typeof ANSWER_ROLES)[number];

function coerceAnswerRole(value: unknown): AnswerRole {
  return (ANSWER_ROLES as readonly string[]).includes(value as string)
    ? (value as AnswerRole)
    : 'DESIGNER';
}

/**
 * Pull the keys `normalizeQA` carries verbatim rather than normalizing, in both
 * camelCase and snake_case. Shared by its array and object-map branches so the
 * two cannot diverge.
 */
function carryAnswerExtras(v: any): Pick<QA, 'isFeatured' | 'role' | 'linkedImageId' | 'linkedProductId' | 'aiClassificationAttribute' | 'parentQuestionId'> {
  return {
    isFeatured: !!(v?.isFeatured ?? false),
    role: typeof v?.role === 'string' ? v.role : undefined,
    linkedImageId: v?.linkedImageId ?? v?.linked_image_id ?? null,
    linkedProductId: v?.linkedProductId ?? v?.linked_product_id ?? null,
    aiClassificationAttribute: v?.aiClassificationAttribute ?? v?.ai_classification_attribute ?? null,
    parentQuestionId: v?.parentQuestionId ?? v?.parent_question_id ?? null,
  };
}

/**
 * Every key this route reads off an incoming answer (spec 21 delta D3).
 *
 * The canonical answer SHAPE is declared once, in `AnswerBaseSchema`
 * (@/lib/posting/interviewSchemas) — deliberately without `.passthrough()`, so
 * `normalizeAnswers` strips anything undeclared. This file is the layer in
 * front of it: three hand-written readers (`normalizeQA`, `ensureAnswerShape`,
 * `extractMetadata`) that map a tolerant client body onto that shape. A key
 * none of them names never reaches the schema at all — it is dropped here, with
 * no error and no log.
 *
 * That silence is the bug. It has already been paid for twice: the "carried
 * first-class, not stripped" comments on roomId and the linkage fields mark
 * where answers were being written with columns that were always NULL.
 *
 * So the lists live here, the readers below index through them, and
 * `warnOnUnmappedAnswerKeys` warns on anything outside them. Because the
 * readers and the warning share these arrays, the warning cannot go stale:
 * teaching a reader a new key necessarily silences the warning for it, and
 * there is no way to silence the warning without teaching a reader.
 */
const ANSWER_TEXT_KEYS = ['answer', 'a', 'value', 'text'] as const;
const ANSWER_PROMPT_KEYS = ['question', 'q', 'prompt', 'label'] as const;
const ANSWER_ID_KEYS = ['questionId', 'id', 'key'] as const;
const ANSWER_SOURCE_KEYS = ['questionSource', 'question_source'] as const;
const ANSWER_MODALITY_KEYS = ['inputModality', 'input_modality'] as const;

/** Keys read by direct property access rather than through `pickStr`. */
const ANSWER_DIRECT_KEYS = [
  'section',
  'category',
  'isFollowUp',
  'isFeatured',
  'role',
  'roomId',
  'room_id',
  'isCrossRoom',
  'is_cross_room',
  'linkedImageId',
  'linked_image_id',
  'linkedProductId',
  'linked_product_id',
  'aiClassificationAttribute',
  'ai_classification_attribute',
  'parentQuestionId',
  'parent_question_id',
] as const;

const READ_ANSWER_KEYS: ReadonlySet<string> = new Set<string>([
  ...ANSWER_TEXT_KEYS,
  ...ANSWER_PROMPT_KEYS,
  ...ANSWER_ID_KEYS,
  ...ANSWER_SOURCE_KEYS,
  ...ANSWER_MODALITY_KEYS,
  ...ANSWER_DIRECT_KEYS,
]);

/**
 * Shout when an answer arrives carrying a key nothing will store.
 *
 * Never throws and never changes what is saved — a save that would have worked
 * still works. Adding a field to the interview record means editing
 * `normalizeQA`, `ensureAnswerShape`/`extractMetadata`, the key list above, and
 * `ProjectionAnswer` in syncInterviewAnswers.ts. Miss one and the value used to
 * vanish with no error and no failing test; now the first save that carries it
 * says so by name.
 */
function warnOnUnmappedAnswerKeys(raw: unknown, label: string, requestId: string): void {
  // Mirror normalizeQA's accepted shapes: an array of answers, or an object map
  // keyed by question id. Bare strings carry no keys, so there is nothing to drop.
  const candidates: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.values(raw)
      : [];

  const unmapped = new Set<string>();
  for (const item of candidates) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    for (const key of Object.keys(item)) {
      if (!READ_ANSWER_KEYS.has(key)) unmapped.add(key);
    }
  }

  if (unmapped.size > 0) {
    console.warn(
      `[posting/interview] ${label}: keys received but NOT stored — ${Array.from(unmapped).sort().join(', ')}`,
      {
        requestId,
        hint: 'To persist one, add it to ANSWER_DIRECT_KEYS (or the relevant pickStr list), read it in ensureAnswerShape/extractMetadata, declare it in AnswerBaseSchema, and project it in syncInterviewAnswers.ts. All four, or it is silently dropped.',
      },
    );
  }
}

function pickStr(obj: any, keys: readonly string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function normalizeQA(input: any): QA[] {
  if (input == null) return [];
  // array
  if (Array.isArray(input)) {
    return input
      .map((v) => {
        if (typeof v === 'string') return { answer: v.trim() };
        if (v && typeof v === 'object') {
          const ans = pickStr(v, ANSWER_TEXT_KEYS);
          const q   = pickStr(v, ANSWER_PROMPT_KEYS);
          const id  = pickStr(v, ANSWER_ID_KEYS);
          const fu  = !!(v as any).isFollowUp;
          // Preserve section and category from the original object
          const section = pickStr(v, ['section']);
          const category = pickStr(v, ['category']);
          // Room attribution + provenance (D5) — carried first-class, not stripped.
          const roomId = (v as any).roomId ?? (v as any).room_id ?? null;
          const questionSource = pickStr(v, ANSWER_SOURCE_KEYS);
          const isCrossRoom = !!((v as any).isCrossRoom ?? (v as any).is_cross_room);
          const inputModality = pickStr(v, ANSWER_MODALITY_KEYS);
          return ans ? { id, question: q, prompt: (v as any).prompt ?? q, answer: ans, isFollowUp: fu, section, category, roomId, questionSource, isCrossRoom, inputModality, ...carryAnswerExtras(v) } : null;
        }
        return null;
      })
      .filter(Boolean) as QA[];
  }
  // string
  if (typeof input === 'string') {
    const s = input.trim();
    return s ? [{ answer: s }] : [];
  }
  // object map
  if (typeof input === 'object') {
    const out: QA[] = [];
    for (const [k, v] of Object.entries(input)) {
      if (typeof v === 'string') {
        const s = v.trim();
        if (s) out.push({ id: k, question: k, prompt: k, answer: s });
      } else if (v && typeof v === 'object') {
        const ans = pickStr(v, ANSWER_TEXT_KEYS);
        const q   = pickStr(v, ANSWER_PROMPT_KEYS) ?? k;
        const id  = pickStr(v, ANSWER_ID_KEYS) ?? k;
        const fu  = !!(v as any).isFollowUp;
        const section = pickStr(v, ['section']);
        const category = pickStr(v, ['category']);
        const roomId = (v as any).roomId ?? (v as any).room_id ?? null;
        const questionSource = pickStr(v, ANSWER_SOURCE_KEYS);
        const isCrossRoom = !!((v as any).isCrossRoom ?? (v as any).is_cross_room);
        const inputModality = pickStr(v, ANSWER_MODALITY_KEYS);
        if (ans) out.push({ id, question: q, prompt: (v as any).prompt ?? q, answer: ans, isFollowUp: fu, section, category, roomId, questionSource, isCrossRoom, inputModality, ...carryAnswerExtras(v) });
      }
    }
    return out;
  }
  return [];
}

function deepMerge(a: any, b: any) {
  if (Array.isArray(a) || Array.isArray(b)) return b ?? a;
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    const out: any = { ...a };
    for (const [k, v] of Object.entries(b)) {
      out[k] = deepMerge(a[k], v);
    }
    return out;
  }
  return b ?? a;
}

const ALLOWED_SECTIONS = new Set([
  'designIntent','materialsMethod','collaboration','emotionalCore','insightsReflection','lightningRound',
  'why','who','what','where','when','how'
]);

function slugify(s?: string) {
  return (s ?? '').toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 64);
}

function deriveSection(qid?: string, prompt?: string): string {
  const cand = (qid ?? '').split('-')[0] || slugify(prompt).split('-')[0];
  if (ALLOWED_SECTIONS.has(cand)) return cand;
  // last resort bucket to keep schema happy
  return 'how';
}

/**
 * Flatten every persisted question set (both generation phases) into a
 * questionId → question text map. Used to backfill the question text on saved
 * answers that were stored without one. Tolerant of partial/missing snapshots.
 */
function buildQuestionTextMap(questionSet: any): Map<string, string> {
  const map = new Map<string, string>();
  if (!questionSet || typeof questionSet !== 'object') return map;

  const addQuestion = (q: any) => {
    const id = q?.id;
    const text = q?.questionText ?? q?.prompt;
    if (typeof id === 'string' && typeof text === 'string' && text.trim()) {
      // First writer wins: a later phase re-listing the same id shouldn't
      // overwrite text already resolved from an earlier one.
      if (!map.has(id)) map.set(id, text.trim());
    }
  };

  for (const snapshot of Object.values(questionSet)) {
    const result = (snapshot as any)?.result;
    if (!result) continue;
    for (const room of Array.isArray(result.rooms) ? result.rooms : []) {
      for (const q of Array.isArray(room?.questions) ? room.questions : []) addQuestion(q);
    }
    for (const q of Array.isArray(result.crossRoomQuestions) ? result.crossRoomQuestions : []) {
      addQuestion(q);
    }
  }

  return map;
}

/**
 * Which room an answer belongs to. Answers carry a first-class roomId (D5);
 * project-level answers have none and are identified by their id prefix.
 */
function answerRoomKey(a: any): string | null {
  const rid = a?.roomId;
  if (typeof rid === 'string' && rid) return rid;
  if (typeof a?.questionId === 'string' && a.questionId.startsWith('project-')) return 'project';
  return null;
}

/**
 * Per-room interview coverage, derived from the persisted question set and the
 * saved answers. Drives the Story tab's "what will be included / what can't be
 * written up yet" advisory and the completedRoomIds passed to generation.
 *
 * A room counts as complete once it holds at least as many answers as its base
 * question budget — the same answer-driven rule the modal's resume plan uses,
 * since the separate roomProgress record is frequently null or stale.
 */
function buildCoverage(
  questionSet: any,
  answers: any[],
): Array<{ roomId: string; roomName: string; answered: number; total: number; complete: boolean }> {
  if (!questionSet || typeof questionSet !== 'object') return [];

  // Collect room groups across phases; later phases must not clobber earlier ones.
  const groups = new Map<string, { roomName: string; total: number }>();
  for (const snapshot of Object.values(questionSet)) {
    const result = (snapshot as any)?.result;
    for (const room of Array.isArray(result?.rooms) ? result.rooms : []) {
      const roomId = room?.roomId;
      if (typeof roomId !== 'string' || groups.has(roomId)) continue;
      const total =
        typeof room?.budget?.baseQuestions === 'number'
          ? room.budget.baseQuestions
          : Array.isArray(room?.questions)
            ? room.questions.length
            : 0;
      groups.set(roomId, { roomName: room?.roomName ?? roomId, total });
    }
  }

  const answeredByRoom = new Map<string, number>();
  for (const a of Array.isArray(answers) ? answers : []) {
    if (!a || typeof a.answer !== 'string' || !a.answer.trim()) continue;
    if (a.isFollowUp) continue; // budgets are expressed in base questions
    const key = answerRoomKey(a);
    if (!key) continue;
    answeredByRoom.set(key, (answeredByRoom.get(key) ?? 0) + 1);
  }

  return Array.from(groups.entries()).map(([roomId, g]) => {
    const answered = answeredByRoom.get(roomId) ?? 0;
    return {
      roomId,
      roomName: g.roomName,
      answered,
      total: g.total,
      complete: g.total > 0 ? answered >= g.total : answered > 0,
    };
  });
}

function ensureAnswerShape(a: any, idx: number) {
  const answer = (typeof a === 'string') ? a : (a?.answer ?? a?.text ?? a?.value ?? '');
  const prompt = (a?.prompt ?? a?.question ?? '');
  const qid = (a?.id ?? a?.questionId ?? (slugify(prompt) || `auto-${idx}`));
  // Prefer the original section/category from the frontend if present
  const section = (a?.section && ALLOWED_SECTIONS.has(a.section)) ? a.section : deriveSection(String(qid), String(prompt));
  return {
    questionId: String(qid || `auto-${idx}`),
    section,
    category: a?.category,
    prompt: String(prompt || ''),
    answer: String(answer ?? '').trim(),
    isFollowUp: !!a?.isFollowUp,
    isFeatured: !!a?.isFeatured,
    // Room attribution + provenance (D5) — first-class so they survive into the
    // canonical store (provenance.interview.payload.answers), not dropped here.
    roomId: a?.roomId ?? a?.room_id ?? null,
    questionSource: a?.questionSource ?? a?.question_source ?? undefined,
    isCrossRoom: !!(a?.isCrossRoom ?? a?.is_cross_room),
    inputModality: a?.inputModality ?? a?.input_modality ?? undefined,
  };
}

const POSTING_V1_ENABLED =
  (process.env.POSTING_V1 ?? "").toLowerCase() === "true" ||
  (process.env.NEXT_PUBLIC_POSTING_V1 ?? "").toLowerCase() === "true" ||
  process.env.NODE_ENV !== "production";

// NOTE: there is deliberately no body schema here any more.
//
// A `SaveBodySchema` used to sit at this spot declaring `answers`,
// `selectedQuestionIds`, `imageOrder` and `previousUpdatedAt` — and nothing ever
// parsed against it. POST reads the body untyped ("tolerant body parsing"
// below), so the schema validated nothing while reading exactly like the
// route's contract. Tightening it would have looked like a fix and changed no
// behaviour at all.
//
// The contract that IS real: `AnswerBaseSchema` in
// @/lib/posting/interviewSchemas, enforced by `normalizeAnswers` on the way into
// provenance, plus the key lists at the top of this file, enforced by
// `warnOnUnmappedAnswerKeys`. Don't reintroduce a decorative schema here — if
// the body should be validated, validate it at the parse site.

// Helper: merge by questionId (keeps latest answer)
function mergeQA(prev: any[] = [], next: any[] = []): any[] {
  const byId = new Map<string, any>();
  for (const item of prev) {
    if (item?.questionId) {
      byId.set(item.questionId, item);
    }
  }
  for (const item of next) {
    if (item?.questionId) {
      byId.set(item.questionId, { ...byId.get(item.questionId), ...item });
    }
  }
  return Array.from(byId.values());
}

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const spotlightBoundary = await legacyInterviewBoundary(request);
  if (spotlightBoundary) return spotlightBoundary;

  try {
    if (!POSTING_V1_ENABLED) {
      return NextResponse.json(
        { error: "posting_disabled" },
        { status: 404 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.projectId;
    await assertProjectView(session.user.id, projectId);

    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { provenance: true },
    });

    // Story review reads saved evidence only; opening it must not generate rooms.
    // Keep legacy question preparation behind authorization and out of guided reads.
    const provenance = (post?.provenance as any) || {};
    const savedOnly = new URL(request.url).searchParams.get('savedOnly') === '1';
    let contextualQuestions: any[] = [];
    if (!savedOnly && !provenance.interview?.guided) {
      try {
        const { getInterviewQuestions } = await import('@/lib/editorial/getInterviewQuestions');
        const questions = await getInterviewQuestions(params.projectId);
        contextualQuestions = questions
          .filter(q => q.questionType === 'contextual')
          .map(q => ({
            id: q.id,
            prompt: q.questionText,
            section: 'what', // Contextual questions are about "what" they chose
            role: 'DESIGNER' as const,
            contextual: {
              linkedImageId: q.linkedImageId,
              linkedProductId: q.linkedProductId,
              attributeType: q.attributeType,
              attributeValue: q.attributeValue,
            },
          }));
      } catch (error) {
        console.error('[interview/GET] Failed to load contextual questions:', error);
        // Continue without contextual questions
      }
    }

    // Fetch room progress from EditorialInterview (Phase B)
    // Wrapped defensively — room_progress column may not exist if migration hasn't been applied
    let roomProgress: any = null;
    try {
      const editorialInterview = await prisma.editorialInterview.findUnique({
        where: { projectId },
        select: { roomProgress: true },
      });
      roomProgress = editorialInterview?.roomProgress || null;
    } catch (err) {
      console.warn('[interview/GET] Failed to fetch roomProgress (migration may not be applied):', err);
    }

    if (!post) {
      return NextResponse.json({
        guided: false, resetId: null,
        answers: [],
        followUps: [],
        selectedQuestionIds: [],
        roomProgress,
      });
    }

    const interview = provenance.interview || {};
    const payload = interview.payload || {};

    const rawAnswers = payload.answers || interview.answers || [];
    const rawFollowUps = payload.followups || interview.followUps || [];
    const selectedQuestionIds = payload.selectedQuestionIds || interview.selectedQuestionIds || [];

    // Recover question text for saved answers. Answers persist a `prompt`, but
    // historically the modal saved them without one, so older answers read as
    // "Untitled question" everywhere they're listed. The persisted question set
    // (provenance.interview.questionSet) is keyed by the same question ids, so we
    // can resolve the text by id and backfill it on read — no migration needed.
    const questionTextById = buildQuestionTextMap(interview.questionSet);
    const withPrompt = (a: any) => {
      if (!a || typeof a !== 'object') return a;
      const existing = typeof a.prompt === 'string' ? a.prompt.trim() : '';
      if (existing) return a;
      const resolved = questionTextById.get(String(a.questionId ?? ''));
      return resolved ? { ...a, prompt: resolved } : a;
    };
    const answers = Array.isArray(rawAnswers) ? rawAnswers.map(withPrompt) : rawAnswers;
    const followUps = Array.isArray(rawFollowUps) ? rawFollowUps.map(withPrompt) : rawFollowUps;

    console.log('[interview/GET] Returning:', {
      answerCount: answers.length,
      followUpsCount: followUps.length,
      selectedQuestionIdsCount: selectedQuestionIds.length,
      source: payload.answers?.length > 0 ? 'payload.answers' : (interview.answers?.length > 0 ? 'interview.answers' : 'empty'),
      provenanceKeys: Object.keys(provenance),
      interviewKeys: Object.keys(interview),
    });

    return NextResponse.json({
      guided: !!interview.guided, resetId: interview.resetId ?? null,
      answers,
      followUps,
      selectedQuestionIds,
      contextualQuestions, // Include contextual questions from AI classification
      roomProgress,
      // Per-room coverage for the Story tab's include/exclude advisory.
      coverage: buildCoverage(interview.questionSet, answers),
    });
  } catch (e: any) {
    console.error('[posting/interview] GET failed', { err: e?.message });
    return NextResponse.json(
      { error: 'Failed to fetch interview data' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const spotlightBoundary = await legacyInterviewBoundary(request);
  if (spotlightBoundary) return spotlightBoundary;

  try {
    if (!POSTING_V1_ENABLED) {
      return NextResponse.json(
        { error: "posting_disabled" },
        { status: 404 }
      );
    }

    const requestId = randomUUID();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.projectId;

    // Check project write access (owner, designer, org member, or admin)
    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch (e: any) {
      if (e.message === "NotFound") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Tolerant body parsing - accept any reasonable shape
    const guidedPost = await prisma.projectPost.findUnique({ where: { projectId }, select: { provenance: true } });
    if ((guidedPost?.provenance as any)?.interview?.guided) {
      return NextResponse.json({ ok: false, code: 'GUIDED_INTERVIEW_REQUIRED', message: 'Continue this interview or correct its answers in the guided workspace.' }, { status: 409 });
    }
    let body: any = {};
    try { 
      body = await request.json(); 
    } catch { 
      body = {}; 
    }
    const resetId = (guidedPost?.provenance as any)?.interview?.resetId ?? null;
    if ((body.resetId ?? null) !== resetId)
      return NextResponse.json({ ok: false, code: 'INTERVIEW_RESET', message: 'This interview was started over. Reload before saving another answer.' }, { status: 409 });

    const selectedQuestionIds =
      body?.selectedQuestionIds ??
      body?.payload?.selectedQuestionIds ??
      [];

    const answersRaw =
      body?.answers ??
      body?.payload?.answers ??
      body?.interview?.answers ??
      [];

    const followupsRaw =
      body?.followups ??
      body?.payload?.followups ??
      body?.interview?.followups ??
      [];

    // Loud about what we are about to throw away. Runs on the RAW body — the
    // only point where a client's keys are still visible, before normalizeQA
    // flattens them onto QA. Warn-only: it never rejects a save.
    warnOnUnmappedAnswerKeys(answersRaw, 'answers', requestId);
    warnOnUnmappedAnswerKeys(followupsRaw, 'followups', requestId);

    // Room statuses (C0): optional [{ roomId, status }] where status is the
    // roomPacing enum. Generalizes A3's roomSkips — the client now sends it from
    // BOTH skipRoom ('skipped') and finalizeRoomAndAdvance ('complete'), so the
    // server can tell finalized from in-progress. Merged non-destructively into
    // EditorialInterview.roomProgress below, with a never-downgrade rank rule.
    const ROOM_STATUS_VALUES = ['not_started', 'in_progress', 'complete', 'skipped'] as const;
    type RoomStatusValue = (typeof ROOM_STATUS_VALUES)[number];
    // Rank orders the states so a lower status can never clobber a higher one:
    // complete (3) > skipped (2) > in_progress (1) > not_started (0).
    const STATUS_RANK: Record<RoomStatusValue, number> = {
      not_started: 0,
      in_progress: 1,
      skipped: 2,
      complete: 3,
    };
    const roomStatuses: Array<{ roomId: string; status: RoomStatusValue }> = (
      Array.isArray(body?.roomStatuses) ? body.roomStatuses : []
    )
      .filter(
        (s: any) =>
          s &&
          typeof s.roomId === 'string' &&
          s.roomId.length > 0 &&
          (ROOM_STATUS_VALUES as readonly string[]).includes(s.status),
      )
      .map((s: any) => ({ roomId: s.roomId, status: s.status as RoomStatusValue }));

    // Extract metadata fields from answers before normalization
    const extractMetadata = (qa: any) => ({
      linkedImageId: qa?.linkedImageId || qa?.linked_image_id || null,
      linkedProductId: qa?.linkedProductId || qa?.linked_product_id || null,
      questionSource: qa?.questionSource || qa?.question_source || (qa?.isFollowUp ? 'follow_up' : 'base_question'),
      aiClassificationAttribute: qa?.aiClassificationAttribute || qa?.ai_classification_attribute || null,
      // Room pacing fields (Phase B)
      roomId: qa?.roomId || qa?.room_id || null,
      isCrossRoom: qa?.isCrossRoom || qa?.is_cross_room || false,
      // Follow-up → the answer that prompted it. The one causal edge the
      // interview itself creates, and the projection's `parentAnswerId` column
      // has never been written by anything (the draft generator reads it).
      parentQuestionId: qa?.parentQuestionId || qa?.parent_question_id || null,
      // inputModality (Pass B): 'text' | 'voice' | 'mixed', resolved client-side.
      inputModality: qa?.inputModality || qa?.input_modality || null,
    });

    const answers = normalizeQA(answersRaw).map((a, i) => {
      const shaped = ensureAnswerShape(a, i);
      return { ...shaped, metadata: extractMetadata(a) };
    });
    const followups = normalizeQA(followupsRaw).map((a, i) => {
      const shaped = { ...ensureAnswerShape(a, i), isFollowUp: true };
      return { ...shaped, metadata: extractMetadata(a) };
    });

    // Drop empties to avoid Zod too_small
    const cleanedAnswers = answers.filter(a => a.answer.length > 0);
    const cleanedFollowups = followups.filter(a => a.answer.length > 0);

    // split base vs follow-ups (preserve original flags if provided)
    const baseAnswers = cleanedAnswers.filter(a => !a.isFollowUp);
    const fuAnswers = cleanedAnswers.filter(a => a.isFollowUp).concat(cleanedFollowups);

    // Convert to InterviewAnswer format for compatibility, preserving metadata
    let incomingAnswers: InterviewAnswer[] = [];
    try {
      // Try to normalize using existing system first
      const normalized = [...baseAnswers, ...fuAnswers].map(qa => ({
        questionId: qa.questionId,
        section: qa.section,
        // `role` is declared in AnswerBaseSchema and sent by InterviewModal, but
        // was hardcoded here — so the client's value was discarded on every
        // save. Carried now, coerced to the declared enum so an unexpected
        // string falls back to DESIGNER instead of failing the whole parse.
        role: coerceAnswerRole((qa as any).role),
        answer: qa.answer,
        isFollowUp: qa.isFollowUp || false,
        prompt: qa.prompt || '',
        // Room attribution + provenance (D5) — first-class, declared in the schema
        // so normalizeAnswers preserves them (metadata is still stripped).
        roomId: (qa as any).roomId ?? null,
        questionSource: (qa as any).questionSource ?? undefined,
        isCrossRoom: !!(qa as any).isCrossRoom,
        inputModality: (qa as any).inputModality ?? undefined,
        // What the question was about (declared first-class — see the schema).
        // Reading these off `metadata` and nowhere else is why the projection's
        // linkage columns were always null: normalizeAnswers drops undeclared
        // keys, so nothing downstream of this line ever saw them.
        linkedImageId: (qa as any).metadata?.linkedImageId ?? null,
        linkedProductId: (qa as any).metadata?.linkedProductId ?? null,
        aiClassificationAttribute: (qa as any).metadata?.aiClassificationAttribute ?? null,
        parentQuestionId: (qa as any).metadata?.parentQuestionId ?? null,
      }));
      incomingAnswers = normalizeAnswers(normalized as any);
    } catch (err) {
      // If normalization fails, use the cleaned shapes directly
      console.warn("[posting/interview] answer normalization failed, using cleaned shapes", {
        requestId,
        error: err,
      });
      incomingAnswers = [...baseAnswers, ...fuAnswers].map((qa) => ({
        questionId: qa.questionId,
        section: qa.section,
        role: coerceAnswerRole((qa as any).role),
        answer: qa.answer,
        isFollowUp: qa.isFollowUp || false,
        prompt: qa.prompt || '',
        // Room attribution + provenance (D5) — first-class (see try path).
        roomId: (qa as any).roomId ?? null,
        questionSource: (qa as any).questionSource ?? undefined,
        isCrossRoom: !!(qa as any).isCrossRoom,
        inputModality: (qa as any).inputModality ?? undefined,
        // Same first-class linkage as the try path above.
        linkedImageId: (qa as any).metadata?.linkedImageId ?? null,
        linkedProductId: (qa as any).metadata?.linkedProductId ?? null,
        aiClassificationAttribute: (qa as any).metadata?.aiClassificationAttribute ?? null,
        parentQuestionId: (qa as any).metadata?.parentQuestionId ?? null,
      }));
    }

    // Fetch existing projectPost (where provenance is actually stored)
    // Also fetch project for access check
    const [projectCheck, post] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      }),
      prisma.projectPost.findUnique({
        where: { projectId },
        select: { id: true, provenance: true },
      }),
    ]);

    if (!projectCheck) {
      return NextResponse.json({ ok: false, code: 'not_found' }, { status: 404 });
    }

    // Ensure projectPost exists
    if (!post) {
      const projectData = await prisma.project.findUnique({
        where: { id: projectId },
        select: { title: true },
      });
      const slug = makeSlug(projectData?.title || undefined, projectId);
      await prisma.projectPost.create({
        data: {
          projectId,
          slug,
          status: "DRAFT",
        },
      });
    }

    // Fetch fresh post after potential create
    const currentPost = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { provenance: true, updatedAt: true },
    });

    if (!currentPost) {
      return NextResponse.json({ ok: false, code: 'save_failed', message: 'Could not create or find post' }, { status: 422 });
    }

    // Build new interview payload segment with intelligent merging
    const existingProvenance = (currentPost.provenance as any) || {};
    if ((existingProvenance.interview?.resetId ?? null) !== resetId)
      return NextResponse.json({ ok: false, code: 'INTERVIEW_RESET', message: 'This interview was started over while the answer was saving. Reload to continue.' }, { status: 409 });
    if (existingProvenance.interview?.guided) {
      return NextResponse.json({ ok: false, code: 'GUIDED_INTERVIEW_REQUIRED', message: 'Continue this interview or correct its answers in the guided workspace.' }, { status: 409 });
    }
    
    // Clearing is DESTRUCTIVE and must be asked for. It used to be inferred from
    // "the request carried no answers", which is also what a room-status-only
    // save looks like (skip a room before answering anything) — one of those
    // reaching a project that already had answers would have wiped the lot.
    // Interview answers are the one thing here that cannot be regenerated, so
    // the ambiguous case now resolves toward keeping them: an empty payload with
    // no explicit `clearAll` leaves stored answers alone.
    const noIncomingAnswers = cleanedAnswers.length === 0 && cleanedFollowups.length === 0;
    const clearAllRequested = body?.clearAll === true;
    const isClearing = noIncomingAnswers && clearAllRequested;
    if (noIncomingAnswers && !clearAllRequested) {
      console.log('[interview/POST] Empty answer payload without clearAll — preserving stored answers', {
        requestId,
        roomStatusCount: roomStatuses.length,
      });
    }
    
    let mergedAnswers: InterviewAnswer[];
    let mergedBaseAnswers: InterviewAnswer[];
    let mergedFuAnswers: InterviewAnswer[];
    
    if (isClearing) {
      // When clearing, don't merge - use empty arrays
      console.log('[interview/POST] Clearing mode - using empty arrays instead of merging');
      mergedAnswers = [];
      mergedBaseAnswers = [];
      mergedFuAnswers = [];
    } else {
      // Get existing answers in InterviewAnswer format. Follow-ups are stored in
      // their own array, so they have to be read back too: a partial save (one
      // answer from the modal, or an edit from the Story tab) carries no
      // follow-ups, and rebuilding `payload.followups` from the request alone
      // wiped every saved follow-up answer.
      let existingAnswers: InterviewAnswer[] = [];
      try {
        existingAnswers = normalizeAnswers(
          (existingProvenance.interview?.payload?.answers ?? existingProvenance.interview?.answers ?? []) as unknown
        );
      } catch {
        existingAnswers = [];
      }
      try {
        const existingFollowups = normalizeAnswers(
          (existingProvenance.interview?.payload?.followups ?? []) as unknown
        ).map((a) => ({ ...a, isFollowUp: true }));
        existingAnswers = [...existingAnswers, ...existingFollowups];
      } catch {
        /* no stored follow-ups to preserve */
      }

      // Merge incoming answers with existing (non-destructive by questionId)
      mergedAnswers = mergeAnswers(existingAnswers, incomingAnswers);
      
      // Split merged answers into base and follow-ups
      mergedBaseAnswers = mergedAnswers.filter(a => !a.isFollowUp);
      mergedFuAnswers = mergedAnswers.filter(a => a.isFollowUp);
    }
    
    // Ensure all merged answers have proper shapes (questionId and section)
    const ensureShape = (a: any) => ({
      ...a,
      questionId: a.questionId || `auto-${Date.now()}`,
      section: a.section || deriveSection(a.questionId, a.prompt),
    });
    
    // "Start Over" fully resets the interview state, selected questions
    // included — but only on an explicit clear, for the same reason as above.
    const shouldClearSelectedQuestions = isClearing;

    console.log('[interview/POST] Clear check:', {
      cleanedAnswersLength: cleanedAnswers.length,
      cleanedFollowupsLength: cleanedFollowups.length,
      clearAllRequested,
      shouldClearSelectedQuestions,
      incomingSelectedQuestionIds: selectedQuestionIds.length,
    });
    
    const nextInterviewPayload = {
      ...(existingProvenance.interview?.payload ?? {}),
      selectedQuestionIds: shouldClearSelectedQuestions
        ? []  // Clear when starting fresh
        : (selectedQuestionIds.length > 0 
            ? selectedQuestionIds 
            : (existingProvenance.interview?.payload?.selectedQuestionIds ?? [])),
      answers: mergedBaseAnswers.map(ensureShape),
      followups: mergedFuAnswers.map(ensureShape),
    };
    
    console.log('[interview/POST] Final payload:', {
      selectedQuestionIdsCount: nextInterviewPayload.selectedQuestionIds.length,
      answersCount: nextInterviewPayload.answers.length,
      followupsCount: nextInterviewPayload.followups.length,
    });
    
    // Log attribute verifications for training data (after successful save)
    try {
      const { logAttributeVerifications } = await import('@/lib/editorial/logAttributeVerification');
      
      // Get contextual question metadata from GET endpoint response
      // We need to match questionIds to their contextual metadata
      let contextualQuestionMap: Map<string, any> = new Map();
      try {
        const { getInterviewQuestions } = await import('@/lib/editorial/getInterviewQuestions');
        const questions = await getInterviewQuestions(projectId);
        questions
          .filter(q => q.type === 'contextual' && q.contextual)
          .forEach(q => {
            contextualQuestionMap.set(q.id, q.contextual);
          });
      } catch (err) {
        console.warn('[interview/POST] Could not load contextual questions for verification:', err);
      }
      
      // Convert answers to format expected by logAttributeVerifications
      const responsesWithContext = [
        ...mergedBaseAnswers.map(a => ({
          questionId: a.questionId,
          question: a.prompt || a.question || '',
          answer: a.answer,
          contextual: contextualQuestionMap.get(a.questionId), // Get contextual metadata
        })),
        ...mergedFuAnswers.map(a => ({
          questionId: a.questionId,
          question: a.prompt || a.question || '',
          answer: a.answer,
          contextual: contextualQuestionMap.get(a.questionId),
        })),
      ];
      
      await logAttributeVerifications(projectId, responsesWithContext);
    } catch (error) {
      // Don't fail the interview save if verification logging fails
      console.error('[interview/POST] Failed to log attribute verifications:', error);
    }

    const nextProvenance = deepMerge(existingProvenance, {
      interview: {
        ...(existingProvenance.interview ?? {}),
        payload: nextInterviewPayload,
        // legacy mirror for b/c; keep if your generate path still reads it
        answers: nextInterviewPayload.answers,
      }
    });

    // Keep the successful post-row CAS locked through both projection writes.
    // Otherwise a guided answer could commit after this CAS, then be erased by
    // this request's older answer list or room-progress projection.
    const saved = await prisma.$transaction(async (tx) => {
      const changed = await tx.projectPost.updateMany({
        where: { projectId, updatedAt: currentPost.updatedAt, provenance: { equals: currentPost.provenance === null ? Prisma.DbNull : currentPost.provenance } },
        data: { provenance: nextProvenance as any },
      });
      if (changed.count !== 1) return false;
      // The rebuild runs whenever answers were saved, full stop. It used to run
      // only when an incoming answer happened to carry one of a handful of
      // fields (`hasNewFields`) — so an interview that produced none of them
      // wrote provenance and left the queryable table empty, silently, and
      // invisibly until someone tried to query across projects.
      const hasAnswerWrite = incomingAnswers.length > 0 || isClearing;
      const shouldSync = hasAnswerWrite || roomStatuses.length > 0;

      if (shouldSync) {
        const interview = await tx.editorialInterview.upsert({
          where: { projectId },
          create: { projectId, status: 'IN_PROGRESS', selectedQuestionIds: nextInterviewPayload.selectedQuestionIds },
          update: {},
        });

        // One writer owns the row shape (see rebuildAnswerProjection). A
        // skip-only save must not wipe and recreate the answer set, so the
        // rebuild is gated on an actual answer write.
        if (hasAnswerWrite) {
          // Retained recordings live at provenance.interview.audio, written by
          // the transcribe route and keyed by questionId (spec 21 delta D5a).
          // Read from nextProvenance, not existingProvenance — the save above
          // preserves the key, and this is the post-write state.
          await rebuildAnswerProjection(
            interview.id,
            mergedAnswers.map(answer => ({ ...answer, questionCategory: answer.section ?? null })),
            ((nextProvenance as any)?.interview?.audio as AnswerAudioMap) || {},
            tx,
          );
        }

        // --- Room progress (Phase B) — merge non-destructively (A3/C0) ---
        // Start from what's stored, overlay answer-derived counts, then overlay
        // explicit statuses. An explicit status survives the recompute; every
        // status written is a valid member of the client enum in roomPacing.ts:13
        // (not_started | in_progress | complete | skipped).
        const VALID_STATUSES = new Set(ROOM_STATUS_VALUES);
        const existingRP =
          interview.roomProgress && typeof interview.roomProgress === 'object'
            ? (interview.roomProgress as Record<string, any>)
            : {};

        const nextRP: Record<string, { status: string; answeredCount: number; totalQuestions: number; baseQuestions: number }> = {};
        for (const [rid, v] of Object.entries(existingRP)) {
          const s = (v as any)?.status;
          nextRP[rid] = {
            status: VALID_STATUSES.has(s) ? s : 'in_progress',
            answeredCount: Number((v as any)?.answeredCount) || 0,
            totalQuestions: Number((v as any)?.totalQuestions) || 0,
            baseQuestions: Number((v as any)?.baseQuestions) || 0,
          };
        }

        // Answer-derived counts — a room with answers is at least in_progress,
        // but never downgrade a room already complete or skipped.
        const derived: Record<string, number> = {};
        for (const answer of mergedAnswers) {
          const rid = (answer as any).roomId; // D5: first-class, no longer metadata
          if (!rid) continue;
          derived[rid] = (derived[rid] || 0) + 1;
        }
        for (const [rid, count] of Object.entries(derived)) {
          const cur = nextRP[rid];
          const keep = cur && (cur.status === 'complete' || cur.status === 'skipped');
          nextRP[rid] = {
            status: keep ? cur!.status : 'in_progress',
            answeredCount: count,
            totalQuestions: cur?.totalQuestions || 0,
            baseQuestions: cur?.baseQuestions || 0,
          };
        }

        // Explicit statuses (C0) — authoritative, but never downgrade: apply an
        // incoming status only when it ranks >= the stored one. This lets skip
        // ('skipped') and finalize ('complete') land, while a stray lower status
        // can't clobber a room that's already complete or skipped. Counts are
        // preserved from the answer-derived overlay above.
        for (const s of roomStatuses) {
          const cur = nextRP[s.roomId];
          const curRank = cur ? STATUS_RANK[cur.status as RoomStatusValue] ?? -1 : -1;
          if (STATUS_RANK[s.status] >= curRank) {
            nextRP[s.roomId] = {
              status: s.status,
              answeredCount: cur?.answeredCount || 0,
              totalQuestions: cur?.totalQuestions || 0,
              baseQuestions: cur?.baseQuestions || 0,
            };
          }
        }

        await tx.editorialInterview.update({
          where: { id: interview.id },
          data: {
            selectedQuestionIds: nextInterviewPayload.selectedQuestionIds,
            ...(Object.keys(nextRP).length > 0 ? { roomProgress: nextRP } : {}),
          },
        });
      }
      return true;
    }, { maxWait: 5000, timeout: 20000 });
    if (!saved) {
      return NextResponse.json({ ok: false, code: 'STALE_INTERVIEW', message: 'The interview changed while saving. Reload its saved state and retry.' }, { status: 409 });
    }

    // Calculate saved count (new answers only)
    const incomingKeys = new Set(
      incomingAnswers.map((answer) => makeAnswerKey(answer))
    );
    const savedCount = incomingKeys.size;
    const totalCount = mergedAnswers.length;

    return NextResponse.json({
      ok: true,
      savedCount,
      totalCount,
    });
  } catch (e: any) {
    console.error('[posting/interview] save_failed', { err: e?.message, stack: e?.stack });
    return NextResponse.json(
      { ok: false, code: 'save_failed', message: 'Could not save interview payload' },
      { status: 422 }
    );
  }
}

/**
 * Merge incoming answers over stored ones, keyed by the QUESTION — questionId
 * plus whether it's a follow-up — not by the answer's content.
 *
 * `makeAnswerKey` folds the answer text into the key, which is right for
 * deduplicating a single payload but wrong for merging across saves: rewriting
 * an answer changes its key, so the edited answer landed as a NEW entry and the
 * old wording stayed in provenance. A question has one answer; re-answering it
 * replaces that answer.
 *
 * Field-level rule: an incoming answer wins, EXCEPT that a blank `prompt` never
 * overwrites question text already stored. Bulk re-saves from a session that
 * couldn't resolve a question's text (its ids were regenerated) would otherwise
 * erase the wording the designer answered.
 */
function mergeAnswers(
  existing: InterviewAnswer[],
  incoming: InterviewAnswer[]
): InterviewAnswer[] {
  const questionKey = (answer: InterviewAnswer) =>
    `${answer.questionId}|${answer.isFollowUp ? 'F' : 'P'}`;

  const merged = [...existing];
  const keyToIndex = new Map<string, number>();

  merged.forEach((answer, idx) => keyToIndex.set(questionKey(answer), idx));

  for (const answer of incoming) {
    const key = questionKey(answer);
    const idx = keyToIndex.get(key);
    if (idx !== undefined) {
      const stored = merged[idx];
      merged[idx] = {
        ...answer,
        prompt: (answer.prompt ?? '').trim() || stored.prompt || '',
      };
    } else {
      merged.push(answer);
      keyToIndex.set(key, merged.length - 1);
    }
  }

  return merged;
}
