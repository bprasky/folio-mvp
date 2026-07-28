/**
 * Interview Question Types & Conversion
 *
 * Holds the shared question types (QuestionType, GeneratedQuestion), the hook-opener id
 * prefixes, and toInterviewQuestion — the converter used by the live per-room path.
 *
 * The Level 0-5 template generator and the AI-brief pipeline that used to live here were
 * removed in the Phase 4 dead-code deletion (docs/17). Live question generation is in
 * generateProjectQuestions.ts / generateRoomQuestions.ts, gated by validateInterviewQuestion.
 */

import type { ContextLevel } from './contextLevel';

// Question types that can be generated
export type QuestionType =
  | 'generic'
  | 'hook_opener'
  | 'room_specific'
  | 'aesthetic'
  | 'vendor_loyalty'
  | 'hero_piece'
  | 'material_theme'
  | 'vision_realization'
  | 'vision_achieved'
  | 'aesthetic_continuity'
  | 'spatial_narrative'
  | 'spatial_flow'
  | 'sightlines'
  | 'decision_journey'
  | 'promoted_win'
  | 'conviction_piece'
  | 'prospective_vision';

/**
 * Stable question-id prefix for the hook-intent opener. Downstream code
 * (respond route, draft generator) uses this prefix to identify the answer
 * that anchors the article's lead pull quote.
 */
export const HOOK_OPENER_ID_PREFIX = 'hook-opener-';

/**
 * Stable question-id prefix for a hook-opener's adaptive follow-up. The
 * respond route mints these when the parent question is a hook opener.
 */
export const HOOK_FOLLOWUP_ID_PREFIX = 'hook-followup-';

export interface GeneratedQuestion {
  id: string;
  text: string;
  contextLevel: ContextLevel;
  type: QuestionType;

  // Associations for tagging/boosting
  rooms?: string[];
  products?: string[];
  vendors?: string[];

  // Boost eligibility
  boostable: boolean;

  // For editorial pull quote potential
  pullQuotePotential: 'high' | 'medium' | 'low';

  // Helper text (optional)
  helper?: string;

  /** Semantic topic for dedup — questions sharing a topic compete, most specific wins */
  topic?: string;

  // Original question metadata (for compatibility with existing system)
  linkedImageId?: string;
  linkedProductId?: string;
  attributeType?: 'color' | 'material' | 'style' | 'mood' | 'element';
  attributeValue?: string;
  roomContext?: string;
}

/**
 * Convert generated questions to the InterviewQuestion format used by the existing system
 */
export function toInterviewQuestion(question: GeneratedQuestion): {
  id: string;
  questionText: string;
  questionType: 'contextual';
  source: 'ai_classification';
  linkedImageId?: string;
  linkedProductId?: string;
  attributeType?: 'color' | 'material' | 'style' | 'mood' | 'element';
  attributeValue?: string;
  roomContext?: string;
  boostable: boolean;
  pullQuotePotential: 'high' | 'medium' | 'low';
  contextLevel: ContextLevel;
  questionCategory: QuestionType;
} {
  return {
    id: question.id,
    questionText: question.text,
    questionType: 'contextual',
    source: 'ai_classification',
    linkedImageId: question.linkedImageId,
    linkedProductId: question.linkedProductId,
    attributeType: question.attributeType,
    attributeValue: question.attributeValue,
    roomContext: question.roomContext || question.rooms?.[0],
    boostable: question.boostable,
    pullQuotePotential: question.pullQuotePotential,
    contextLevel: question.contextLevel,
    questionCategory: question.type,
  };
}
