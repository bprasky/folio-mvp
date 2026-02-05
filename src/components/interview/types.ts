/**
 * Interview Flow Types
 *
 * Type definitions for the new interview flow components and state management.
 */

export type InterviewStep =
  | "mode-selection"
  | "voice-interview"
  | "text-interview"
  | "preview"
  | "generating";

export type InterviewMode = "voice" | "text" | null;

export interface InterviewQuestion {
  id: string;
  text: string;
  followUpTo?: string; // ID of question this follows up on
  source: "ai-personalized" | "ai-followup" | "default";
  relatedImageId?: string;
  context?: string; // Optional lead-in text
}

export interface InterviewResponse {
  questionId: string;
  questionText: string;
  answer: string;
  timestamp: Date;
  inputMode: "voice" | "text";
}

export interface InterviewState {
  step: InterviewStep;
  mode: InterviewMode;
  sessionId: string | null;
  responses: InterviewResponse[];
  currentQuestionIndex: number;
  questions: InterviewQuestion[];
  draftPreview: DraftPreview | null;
  isLoading: boolean;
  error: string | null;
}

export interface DraftPreview {
  title: string;
  excerpt: string;
}

export interface ProjectContext {
  title: string;
  imageCount: number;
  heroImageUrl: string | null;
}

// API Response Types

export interface StartSessionResponse {
  sessionId: string;
  initialQuestions: InterviewQuestion[];
  projectContext: ProjectContext;
}

export interface RespondResponse {
  followUpQuestion: InterviewQuestion | null;
  shouldShowPreview: boolean;
  previewDraft: DraftPreview | null;
}

export interface GenerateDraftResponse {
  draftId: string;
  title: string;
  blocks: unknown[]; // Uses existing expandedBlocks schema
  status: "ready" | "processing";
}

// Voice Interview Types

export type VoiceState =
  | "mic-check"
  | "ai-speaking"
  | "listening"
  | "processing"
  | "complete";

export interface TranscriptSegment {
  text: string;
  startTime: number;
  endTime: number;
}

export interface TranscribeResponse {
  transcript: string;
  confidence: number;
  segments: TranscriptSegment[];
}
