/** Wire types only. Source and snapshot are resolved on the server, never from speech. */
export type LiveSourceKind = 'project' | 'spotlight' | 'expertise' | 'story' | 'designer_bio' | 'org_bio' | 'collaboration';
export interface LiveSource { kind: LiveSourceKind; id: string; round?: 1 | 2 | 3 }
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
}
export interface LiveAdapterCommand {
  action: 'answer' | 'correct' | 'skip' | 'reuse' | 'pause' | 'resume' | 'retry' | 'finish';
  requestId: string; questionId?: string; text?: string; confirmPartial?: boolean; selectedImageId?: string;
  inputModality?: 'voice' | 'text';
}
