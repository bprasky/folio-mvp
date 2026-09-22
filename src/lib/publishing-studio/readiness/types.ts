export const READINESS_POLICY = 'editorial-readiness-v1';
export type Readiness = 'ready' | 'quick' | 'developing' | 'suppressed';
export type StoryShape = 'decision' | 'constraint' | 'transformation' | 'material' | 'process' | 'point_of_view' | 'pattern' | 'product_in_context';
export type Dimension = 'story' | 'evidence' | 'visual' | 'specificity' | 'novelty' | 'designerFit' | 'formatFit';
export type Penalty = 'semanticOverlap' | 'visualRepetition' | 'genericFraming' | 'commercialDistortion' | 'staleness';
export interface Evidence {
  id: string; projectId: string; roomId?: string; text: string;
  tier: 'direct' | 'observed' | 'inferred'; source: 'published_prose' | 'designer_answer' | 'metadata' | 'visual';
}
export interface SourceImage { id: string; projectId: string; roomId?: string; url: string; approved: boolean; revision?: string }
export interface CandidateSource {
  key: string; projectIds: string[]; roomId?: string; title: string;
  origin: 'project' | 'room' | 'direction'; evidence: Evidence[]; images: SourceImage[];
  designerName: string; photographer: string | null;
}
export interface CandidateVisual extends SourceImage {
  role: 'hero' | 'context' | 'detail' | 'proof'; reason: string;
  technical: number; relevance: number; aesthetic: number; crop: number;
  width: number; height: number; perceptualHash: string;
}
export interface Blocker {
  id: string; kind: 'truth' | 'story' | 'visual' | 'voice' | 'credit' | 'review';
  question: string; options?: string[]; evidenceIds: string[]; answer?: string;
}
export interface Candidate {
  id: string; version: number; sourceVersion: string; policy: string;
  designerId: string; organizationId: string | null; projectIds: string[]; roomId?: string;
  sourceKey: string; origin: CandidateSource['origin']; source: CandidateSource;
  shape: StoryShape; thesis: string; audienceValue: string; rationale: string;
  format: 'single_image' | 'carousel'; evidence: Evidence[];
  claims: { text: string; evidenceIds: string[] }[];
  visuals: CandidateVisual[];
  draft: { headline: string; caption: string; credits: { designer: string; photographer: string | null }; slides: { imageId: string; purpose: string }[]; pendingAnswer?: { blockerId: string; text: string } };
  dimensions: Record<Dimension, number>; penalties: Record<Penalty, number>;
  score: number; readiness: Readiness; blockers: Blocker[]; reasons: string[];
  dismissed: boolean; confirmedPublishedAt?: string; createdAt: string;
}
export const DISMISSAL_REASONS = ['not_accurate', 'already_shared', 'weak_imagery', 'not_my_voice', 'not_important', 'other'] as const;
export type CandidateEventKind = 'generated' | 'scored' | 'suppressed' | 'shown' | 'opened' | 'configured' | 'answered' | 'edited' | 'dismissed' | 'restored' | 'ready' | 'exported' | 'published' | 'superseded';
export interface CandidateEvent {
  id: string; candidateId: string; version: number; sourceVersion: string;
  kind: CandidateEventKind; payload: Record<string, unknown>; createdAt: string;
}
export interface ReadinessData { candidates: Candidate[]; developing: Candidate[]; enabled: true }
