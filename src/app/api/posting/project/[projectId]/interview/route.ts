export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectView } from "@/lib/authz/access";
import { normalizeRole } from "@/lib/permissions";
import {
  normalizeAnswers,
  makeAnswerKey,
  InterviewAnswer,
} from "@/lib/posting/interviewSchemas";
import { makeSlug } from "@/lib/posting/slug";
import { moderateAnswers } from "@/lib/posting/moderation";
import { z } from "zod";
import { randomUUID } from "crypto";

// Helper types and functions for tolerant normalization
type QA = { id?: string; question?: string; prompt?: string; answer: string; isFollowUp?: boolean; section?: string; category?: string };

function pickStr(obj: any, keys: string[]): string | undefined {
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
          const ans = pickStr(v, ['answer','a','value','text']);
          const q   = pickStr(v, ['question','q','prompt','label']);
          const id  = pickStr(v, ['questionId','id','key']);
          const fu  = !!(v as any).isFollowUp;
          // Preserve section and category from the original object
          const section = pickStr(v, ['section']);
          const category = pickStr(v, ['category']);
          return ans ? { id, question: q, prompt: (v as any).prompt ?? q, answer: ans, isFollowUp: fu, section, category } : null;
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
        const ans = pickStr(v, ['answer','a','value','text']);
        const q   = pickStr(v, ['question','q','prompt','label']) ?? k;
        const id  = pickStr(v, ['questionId','id','key']) ?? k;
        const fu  = !!(v as any).isFollowUp;
        const section = pickStr(v, ['section']);
        const category = pickStr(v, ['category']);
        if (ans) out.push({ id, question: q, prompt: (v as any).prompt ?? q, answer: ans, isFollowUp: fu, section, category });
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
  };
}

const POSTING_V1_ENABLED =
  (process.env.POSTING_V1 ?? "").toLowerCase() === "true" ||
  (process.env.NEXT_PUBLIC_POSTING_V1 ?? "").toLowerCase() === "true" ||
  process.env.NODE_ENV !== "production";

const SaveBodySchema = z.object({
  answers: z.array(z.any()).optional(),
  selectedQuestionIds: z.array(z.string()).optional(),
  imageOrder: z.array(z.string()).optional(),
  previousUpdatedAt: z.string().optional(),
});

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
  // Try to get contextual questions from AI classification
  let contextualQuestions: any[] = [];
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
        answers: [],
        followUps: [],
        selectedQuestionIds: [],
        roomProgress,
      });
    }

    const provenance = (post.provenance as any) || {};
    const interview = provenance.interview || {};
    const payload = interview.payload || {};

    const answers = payload.answers || interview.answers || [];
    const followUps = payload.followups || interview.followUps || [];
    const selectedQuestionIds = payload.selectedQuestionIds || interview.selectedQuestionIds || [];

    console.log('[interview/GET] Returning:', {
      answerCount: answers.length,
      followUpsCount: followUps.length,
      selectedQuestionIdsCount: selectedQuestionIds.length,
      source: payload.answers?.length > 0 ? 'payload.answers' : (interview.answers?.length > 0 ? 'interview.answers' : 'empty'),
      provenanceKeys: Object.keys(provenance),
      interviewKeys: Object.keys(interview),
    });

    return NextResponse.json({
      answers,
      followUps,
      selectedQuestionIds,
      contextualQuestions, // Include contextual questions from AI classification
      roomProgress,
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
    const role = normalizeRole(session?.user?.role);

    // Check project access
    await assertProjectView(session.user.id, projectId);

    // Verify role permission
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, designerId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const isOwner = project.ownerId === session.user.id || project.designerId === session.user.id;
    if (!isOwner && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Tolerant body parsing - accept any reasonable shape
    let body: any = {};
    try { 
      body = await request.json(); 
    } catch { 
      body = {}; 
    }

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

    // Extract metadata fields from answers before normalization
    const extractMetadata = (qa: any) => ({
      linkedImageId: qa?.linkedImageId || qa?.linked_image_id || null,
      linkedProductId: qa?.linkedProductId || qa?.linked_product_id || null,
      questionSource: qa?.questionSource || qa?.question_source || (qa?.isFollowUp ? 'follow_up' : 'base_question'),
      aiClassificationAttribute: qa?.aiClassificationAttribute || qa?.ai_classification_attribute || null,
      // Room pacing fields (Phase B)
      roomId: qa?.roomId || qa?.room_id || null,
      isCrossRoom: qa?.isCrossRoom || qa?.is_cross_room || false,
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
        role: 'DESIGNER' as const,
        answer: qa.answer,
        isFollowUp: qa.isFollowUp || false,
        prompt: qa.prompt || '',
        // Preserve metadata
        metadata: (qa as any).metadata || {},
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
        role: 'DESIGNER' as const,
        answer: qa.answer,
        isFollowUp: qa.isFollowUp || false,
        prompt: qa.prompt || '',
        // Preserve metadata
        metadata: (qa as any).metadata || {},
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
      select: { provenance: true },
    });

    if (!currentPost) {
      return NextResponse.json({ ok: false, code: 'save_failed', message: 'Could not create or find post' }, { status: 422 });
    }

    // Build new interview payload segment with intelligent merging
    const existingProvenance = (currentPost.provenance as any) || {};
    
    // Check if we're clearing (empty incoming arrays means "clear all")
    const isClearing = cleanedAnswers.length === 0 && cleanedFollowups.length === 0;
    
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
      // Get existing answers in InterviewAnswer format
      let existingAnswers: InterviewAnswer[] = [];
      try {
        existingAnswers = normalizeAnswers(
          (existingProvenance.interview?.payload?.answers ?? existingProvenance.interview?.answers ?? []) as unknown
        );
      } catch {
        existingAnswers = [];
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
    
    // If clearing all answers and followups, also clear selectedQuestionIds
    // This ensures "Start Over" fully resets the interview state
    const shouldClearSelectedQuestions = cleanedAnswers.length === 0 && cleanedFollowups.length === 0;
    
    console.log('[interview/POST] Clear check:', {
      cleanedAnswersLength: cleanedAnswers.length,
      cleanedFollowupsLength: cleanedFollowups.length,
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

    await prisma.projectPost.update({
      where: { projectId },
      data: { provenance: nextProvenance as any },
    });

    // Verify the write by reading back (diagnostic - helps catch silent write failures)
    try {
      const verifyPost = await prisma.projectPost.findUnique({
        where: { projectId },
        select: { provenance: true },
      });
      const verifyAnswers = (verifyPost?.provenance as any)?.interview?.payload?.answers;
      const verifyLegacy = (verifyPost?.provenance as any)?.interview?.answers;
      console.log('[interview/POST] Write verification:', {
        requestId,
        writtenPayloadAnswers: nextInterviewPayload.answers.length,
        readBackPayloadAnswers: Array.isArray(verifyAnswers) ? verifyAnswers.length : 'missing',
        readBackLegacyAnswers: Array.isArray(verifyLegacy) ? verifyLegacy.length : 'missing',
        match: Array.isArray(verifyAnswers) && verifyAnswers.length === nextInterviewPayload.answers.length,
      });
    } catch (verifyErr) {
      console.warn('[interview/POST] Write verification failed (non-blocking):', verifyErr);
    }

    // Sync answers to EditorialInterviewAnswer if new fields are present
    try {
      const { syncAnswersToEditorialInterview } = await import('@/lib/editorial/syncInterviewAnswers');
      const hasNewFields = incomingAnswers.some((a: any) => 
        a.metadata?.linkedImageId || a.metadata?.linkedProductId || a.metadata?.questionSource || a.metadata?.aiClassificationAttribute
      );
      
      if (hasNewFields) {
        // Get or create EditorialInterview
        let interview = await prisma.editorialInterview.findUnique({
          where: { projectId },
        });

        if (!interview) {
          interview = await prisma.editorialInterview.create({
            data: {
              projectId,
              status: 'IN_PROGRESS',
              selectedQuestionIds: selectedQuestionIds,
            },
          });
        }

        // Delete existing answers and recreate with new metadata
        await prisma.editorialInterviewAnswer.deleteMany({
          where: { interviewId: interview.id },
        });

        // Create answer records with metadata
        for (const answer of mergedAnswers) {
          const metadata = (answer as any).metadata || {};
          await prisma.editorialInterviewAnswer.create({
            data: {
              interviewId: interview.id,
              questionId: answer.questionId,
              answerText: answer.answer,
              isFollowUp: answer.isFollowUp || false,
              inputModality: 'text',
              linkedImageId: metadata.linkedImageId || null,
              linkedProductId: metadata.linkedProductId || null,
              questionSource: metadata.questionSource || (answer.isFollowUp ? 'follow_up' : 'base_question'),
              aiClassificationAttribute: metadata.aiClassificationAttribute || null,
              roomId: metadata.roomId || null,
              isCrossRoom: metadata.isCrossRoom || false,
            },
          });
        }

        // Compute and update room progress (Phase B)
        const roomProgressMap: Record<string, { status: string; answeredCount: number; totalQuestions: number; baseQuestions: number }> = {};
        for (const answer of mergedAnswers) {
          const meta = (answer as any).metadata || {};
          const rid = meta.roomId;
          if (!rid) continue;
          if (!roomProgressMap[rid]) {
            roomProgressMap[rid] = { status: 'in_progress', answeredCount: 0, totalQuestions: 0, baseQuestions: 0 };
          }
          roomProgressMap[rid].answeredCount++;
        }

        // Update selectedQuestionIds + roomProgress
        await prisma.editorialInterview.update({
          where: { id: interview.id },
          data: {
            selectedQuestionIds,
            ...(Object.keys(roomProgressMap).length > 0 ? { roomProgress: roomProgressMap } : {}),
          },
        });
      }
    } catch (error) {
      // Don't fail the save if sync fails
      console.error('[interview/POST] Failed to sync to EditorialInterviewAnswer:', error);
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

function mergeAnswers(
  existing: InterviewAnswer[],
  incoming: InterviewAnswer[]
): InterviewAnswer[] {
  const merged = [...existing];
  const keyToIndex = new Map<string, number>();

  merged.forEach((answer, idx) =>
    keyToIndex.set(makeAnswerKey(answer), idx)
  );

  for (const answer of incoming) {
    const key = makeAnswerKey(answer);
    if (keyToIndex.has(key)) {
      const idx = keyToIndex.get(key)!;
      merged[idx] = answer;
    } else {
      merged.push(answer);
      keyToIndex.set(key, merged.length - 1);
    }
  }

  return merged;
}

