import type { ExpertiseArticle, ExpertiseEvidence, ExpertiseOpportunity, ExpertiseSession } from '@/lib/publishing-studio/expertise/types';
export interface ExpertiseSnapshot {
  id: string; version: number; revisionNumber: number; opportunity: ExpertiseOpportunity; session: ExpertiseSession;
  article: ExpertiseArticle | null; status: 'interview' | 'review' | 'published' | 'archived'; publishedUrl: string | null;
  sourceChanges: string[]; availableEvidence?: ExpertiseEvidence[]; identity: { name: string | null; profileUrl: string; portraitUrl?: string; logoUrl?: string }; error?: string;
  exports?: { id: string; revision: number; title: string; caption: string; mediaIds: string[]; images?: ExpertiseArticle['media']; createdAt: string }[];
}
export interface ExpertiseListing {
  identity?: ExpertiseSnapshot['identity'];
  selectableEvidence?: ExpertiseEvidence[]; enabled: boolean; opportunities: ExpertiseOpportunity[]; work: ExpertiseSnapshot[]; projects: { id: string; title: string }[];
  discovery: { status: 'not_started' | 'current' | 'changed' | 'empty' | 'processing' | 'error'; message?: string };
}
