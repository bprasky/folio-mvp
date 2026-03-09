/**
 * Room Pacing — Types and budget computation for room-by-room interview flow.
 *
 * Spec: tasks/17_EDITORIAL_FLOW_SPEC.md §3 (Interview Pacing Model)
 */

import type { InterviewQuestion } from '@/types/interview';

// ---------------------------------------------------------------------------
// Room progress tracking
// ---------------------------------------------------------------------------

export type RoomProgressStatus = 'not_started' | 'in_progress' | 'complete' | 'skipped';

export interface RoomProgress {
  status: RoomProgressStatus;
  answeredCount: number;
  totalQuestions: number;
  baseQuestions: number;
}

/** Stored on EditorialInterview.roomProgress as JSON */
export type RoomProgressMap = Record<string, RoomProgress>;

// ---------------------------------------------------------------------------
// Room question budgets
// ---------------------------------------------------------------------------

export interface RoomQuestionBudget {
  roomId: string;
  roomName: string;
  roomType: string | null;
  imageCount: number;
  tagCount: number;
  baseQuestions: number;   // 3-6 per formula
  maxFollowUps: number;    // 1-3
}

export interface RoomQuestionsGroup {
  roomId: string;
  roomName: string;
  roomType: string | null;
  budget: RoomQuestionBudget;
  questions: InterviewQuestion[];
}

export interface RoomGroupedQuestions {
  rooms: RoomQuestionsGroup[];
  crossRoomQuestions: InterviewQuestion[];
  globalGates: {
    minimumTotalAnswers: number;
    warnings: Array<{ roomId: string; roomName: string; reason: string }>;
  };
}

// ---------------------------------------------------------------------------
// Budget formula (Spec §3 — Per-Room Question Budget)
//
// baseQuestions = max(3, min(6, ceil(imageCount * 0.7 + tagCount * 0.3)))
//
// Floor of 3 ensures even a powder bath gets 3 questions for editorial depth.
// Follow-ups are additive to base (room total = base + follow-ups).
//
// | Room characteristic              | Base | Follow-ups |
// |----------------------------------|------|------------|
// | 1-2 images, 0-3 tags             | 3    | 1          |
// | 3-4 images, 4-8 tags             | 4    | 2          |
// | 5-7 images, 9-15 tags            | 5    | 2-3        |
// | 8+ images, 16+ tags              | 6    | 3          |
// ---------------------------------------------------------------------------

export function computeRoomBudget(
  imageCount: number,
  tagCount: number,
): { baseQuestions: number; maxFollowUps: number } {
  const base = Math.max(3, Math.min(6, Math.ceil(imageCount * 0.7 + tagCount * 0.3)));
  let followUps: number;
  if (base <= 3) followUps = 1;
  else if (base <= 4) followUps = 2;
  else followUps = 3;
  return { baseQuestions: base, maxFollowUps: followUps };
}

// ---------------------------------------------------------------------------
// Global gates (Spec §3)
// ---------------------------------------------------------------------------

export function computeGlobalGates(
  rooms: Array<{ roomId: string; roomName: string; imageCount: number; tagCount: number }>,
): { minimumTotalAnswers: number; warnings: Array<{ roomId: string; roomName: string; reason: string }> } {
  const minimumTotalAnswers = Math.max(8, rooms.length * 3);
  const warnings: Array<{ roomId: string; roomName: string; reason: string }> = [];

  for (const room of rooms) {
    if (room.imageCount >= 3) {
      warnings.push({
        roomId: room.roomId,
        roomName: room.roomName,
        reason: `${room.roomName} has ${room.imageCount} images but no answers yet`,
      });
    }
    if (room.tagCount >= 5) {
      warnings.push({
        roomId: room.roomId,
        roomName: room.roomName,
        reason: `${room.roomName} has ${room.tagCount} tagged products but no answers yet`,
      });
    }
  }

  return { minimumTotalAnswers, warnings };
}
