/** Shared wire types only. This file is safe to import from the client. */
export const GUIDED_ANSWER_LIMIT = 2000;
export const PROJECT_CATEGORIES = ['CLIENT_BRIEF', 'SCOPE_PARAMETERS', 'DESIGN_DIRECTION', 'SIGNATURE_IDENTITY', 'SURPRISE_PIVOT'] as const;
export type GuidedQuestionStatus = 'pending' | 'active' | 'answered' | 'skipped' | 'invalidated';

export interface GuidedEvidence {
  answerId: string;
  quote: string;
}

export interface GuidedQuestion {
  id: string;
  text: string;
  reaction?: string;
  baselineText?: string;
  adaptation?: { remainingDetail: string; evidence: GuidedEvidence[] };
  confirmation?: GuidedEvidence;
  /** Original generated wording, retained when the display validator rejects it. */
  preparedText?: string;
  preparedCategory?: string;
  preparationStatus?: 'validated' | 'safe_fallback';
  validationReason?: string;
  category: string;
  roomId: string | null;
  sourceImageIds: string[];
  sourceAnswerIds: string[];
  status: GuidedQuestionStatus;
  kind: 'prepared' | 'followup' | 'clarification';
  parentQuestionId?: string;
  parentAnswerId?: string;
  purpose?: string;
  invalidationReason?: string;
  wordingHistory?: Array<{ text: string; reaction?: string; sourceAnswerIds?: string[]; correctedAnswerId?: string }>;
  preparationHistory?: Array<{ text: string; sourceImageIds: string[]; sourceAnswerIds: string[]; reason: string }>;
}

export interface GuidedRoom {
  id: string;
  name: string;
  imageIds: string[];
  baseQuestions: number;
  maxFollowUps: number;
}

export interface GuidedTurn {
  id: string;
  requestId: string;
  questionId: string;
  questionText: string;
  reaction?: string;
  reusedFromAnswerId?: string;
  confirmationText?: string;
  text: string;
  roomId: string | null;
  sourceImageIds: string[];
  selectedImageId: string | null;
  inputModality: 'text' | 'voice' | 'mixed';
  kind: 'answer' | 'correction' | 'skip' | 'confirmation';
  createdAt: string;
  supersedes?: string;
  supersededBy?: string;
  recordingId?: string;
  recording?: GuidedRecording & { textMatchesTranscript: boolean };
}

/** Immutable provisional recording produced by this project's transcription route. */
export interface GuidedRecording {
  id: string;
  projectId: string;
  questionId: string;
  transcript: string;
  audioUrl: string;
  words: Array<{ word: string; start: number; end: number }>;
  capturedAt: string;
}

export interface GuidedSession {
  id: string;
  schemaVersion: 1;
  projectId: string;
  version: number;
  status: 'active' | 'paused' | 'deciding' | 'ready' | 'finished' | 'needs_review';
  phase: 'project' | 'rooms' | 'review';
  plan: GuidedQuestion[];
  rooms: GuidedRoom[];
  turns: GuidedTurn[];
  activeQuestionId: string | null;
  roomsPrepared: boolean;
  contextFingerprint: string;
  minimumTotalAnswers: number;
  pendingDecisionTurnId: string | null;
  requestIds: string[];
  requestDigests?: Record<string, string>;
  notice: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuidedPreparation {
  questions: GuidedQuestion[];
  rooms: GuidedRoom[];
  contextFingerprint: string;
  minimumTotalAnswers: number;
}

export type GuidedNextProposal = { kind: 'advance' } | {
  kind: 'followup' | 'clarification';
  text: string;
  reaction?: string;
  purpose: string;
  sourceAnswerIds: string[];
  evidence?: GuidedEvidence[];
} | {
  kind: 'ask_prepared' | 'confirm_coverage';
  questionId: string;
  text: string;
  reaction?: string;
  purpose: string;
  sourceAnswerIds: string[];
  evidence: GuidedEvidence[];
};

export interface GuidedCommand {
  action: 'start' | 'answer' | 'confirm' | 'skip' | 'skip_room' | 'section' | 'pause' | 'resume' | 'retry' | 'finish' | 'correct';
  requestId: string;
  version: number;
  questionId?: string;
  text?: string;
  inputModality?: 'text' | 'voice' | 'mixed';
  recordingId?: string;
  roomId?: string | null;
  selectedImageId?: string | null;
  confirmPartial?: boolean;
}
