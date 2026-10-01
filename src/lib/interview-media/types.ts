export const MAX_CHUNK_BYTES = 5 * 1024 * 1024;
export const MAX_CAPTURE_BYTES = 512 * 1024 * 1024;
export const MAX_CAPTURE_MS = 60 * 60 * 1000;
export const MAX_CHUNKS = 2000;
export type MediaSource = { sourceType: string; sourceId: string; canonicalId: string };
export type Chunk = { index: number; key: string; bytes: number; uploaded: boolean };
export type AlignedSegment = { order: number; startMs: number; endMs: number; text: string; speaker: 'creator'; speakerId: string };
export interface Capture {
  schemaVersion: 1; mimeType: string; offsetMs: number; durationMs: number; chunks: Chunk[];
  consent: { mode: 'audio' | 'video'; version: string; at: string; disclosure: string };
  source: MediaSource; sourceVersion?: string; recordingScopeVersion?: string; speakerId: string;
  key?: string; hasVideo?: boolean; transcript?: AlignedSegment[]; rawTranscript?: unknown;
  moments?: { startMs: number; endMs: number; quoteText: string; useCase: 'SOCIAL_CLIP_HOOK'; score: number }[];
  evidence?: { sourceRefs: unknown[]; turns: unknown[]; note: string };
  error?: string;
}
export type Scene = {
  captureId: string; captureVersion: number; startMs: number; endMs: number;
  speakerId: string; imageId?: string; focalX: number; focalY: number; transition: 'cut';
  captionOrders: number[]; chapter: string;
};
export interface EditPlan {
  schemaVersion: 1; title: string; description: string; credits: string;
  format: 'short' | 'episode' | 'audio'; aspect: 'portrait' | 'landscape'; scenes: Scene[];
  source: MediaSource; sourceVersion: string; destination: string | null;
  approval?: { actorId: string; digest: string; at: string }; publishedAt?: string;
  output?: { key: string; previewKey: string; mimeType: string; durationMs: number; digest: string };
  error?: string;
}
export interface MediaJob { task: 'finalize' | 'render'; targetId: string; targetVersion: number; error?: string }
export interface MediaRecord<T = Capture | EditPlan | MediaJob> {
  id: string; actorId: string; sessionId: string; kind: 'capture' | 'plan' | 'job'; state: string; payload: T;
  version: number; jobKey: string | null; leaseToken: string | null; leaseUntil: Date | null;
  attempts: number; availableAt: Date; createdAt: Date; updatedAt: Date;
}
export class MediaError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function captureMime(value: string) {
  const mime = value.toLowerCase();
  if (!/^(audio|video)\/(webm|mp4)(;codecs=[a-z0-9., -]+)?$/.test(mime)) throw new MediaError('This recording format is not supported.');
  return mime;
}
