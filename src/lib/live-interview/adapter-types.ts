/** Wire types only. Source and snapshot are resolved on the server, never from speech. */
export type LiveSourceKind = 'project' | 'project_guide' | 'spotlight' | 'expertise' | 'story' | 'designer_bio' | 'org_bio' | 'collaboration';
export interface LiveSource { kind: LiveSourceKind; id: string; round?: 1 | 2 | 3 }
export type ProjectGuideStage = 'upload' | 'tagging' | 'interview_new' | 'interview_resume' | 'interview_complete';
export type ProjectGuideAction = 'start_interview' | 'resume_interview' | 'start_over' | 'add_more' | 'open_upload' | 'open_tagging' | 'none';
export interface ProjectGuideMetadata {
  phase: 'guide' | 'interview' | 'complete'; stage: ProjectGuideStage;
  projectId: string | null; projectName: string;
  photoCount: number; taggedPhotoCount: number; reviewedPhotoCount: number; unreviewedPhotoCount: number; sortedPhotoCount: number;
  answeredCount: number; remainingQuestionCount: number | null;
  allowedActions: ProjectGuideAction[]; action: ProjectGuideAction; actionId: string;
  legacyInterview?: boolean;
  /** Exact designer text offered for explicit confirmation, never saved automatically. */
  offeredDetail?: { text: string; questionId: string };
}
export interface LiveQuestion { id: string; text: string; reaction?: string; sourceImageIds: string[]; roomId?: string | null }
export interface LiveSourceRef { kind: 'project' | 'image' | 'answer' | 'interview' | 'organization' | 'profile'; id: string; version: string; projectId?: string; publicEligible: boolean }
export interface LiveAdapterState {
  schemaVersion: 1;
  questions?: LiveQuestion[];
  skipped: string[];
  /** Private durable restoration data. Not provider context or public provenance. */
  native?: unknown;
  receipts: Record<string, string>;
  status?: 'paused' | 'finished';
}
export interface LiveAdapterSnapshot {
  source: LiveSource; interviewId: string; version: string;
  status: 'active' | 'paused' | 'ready' | 'finished' | 'needs_review';
  currentQuestion: LiveQuestion | null; sourceRefs: LiveSourceRef[];
  state: LiveAdapterState; notice?: string;
  guide?: ProjectGuideMetadata;
}
export interface LiveAdapterCommand {
  action: 'answer' | 'correct' | 'skip' | 'reuse' | 'pause' | 'resume' | 'retry' | 'finish' | 'guide';
  requestId: string; questionId?: string; text?: string; confirmPartial?: boolean; selectedImageId?: string;
  inputModality?: 'voice' | 'text';
  guideAction?: ProjectGuideAction | 'refresh' | 'return_guide';
}
