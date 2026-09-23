export type EvidenceKind = 'observation' | 'project_fact' | 'designer_answer' | 'published_prose';
export interface ExpertiseEvidence {
  id: string; revision: string; projectId: string; projectName: string; roomId?: string; roomName?: string;
  kind: EvidenceKind; text: string; visibility: 'public' | 'private';
  assetId?: string; imageUrl?: string; photographer?: string; alt?: string;
}
export interface ExpertiseOpportunity {
  id: string; thesis: string; headline?: string; headlineSources?: { evidenceId: string; quote: string }[]; readerBenefit: string; comparisonType: string; projectIds: string[];
  evidence: ExpertiseEvidence[]; gaps: string[]; qualification: string[];
  ranking: { evidence: number; specificity: number; clientValue: number; novelty: number; effort: number };
  sourceSignature: string; state: 'active' | 'dismissed' | 'archived';
}
export type ExpertisePurpose = 'orient' | 'context' | 'comparison' | 'judgment' | 'confirm';
export interface ExpertiseQuestion {
  id: string; purpose: ExpertisePurpose; text: string; evidenceIds: string[]; gapId: string;
  thesisRevision: number; followUp: number; choices?: string[];
}
export interface ExpertiseAnswer {
  id: string; questionId: string; purpose: ExpertisePurpose; text: string; evidenceIds: string[];
  thesisRevision: number; skipped: boolean; invalidated?: boolean;
}
export interface ExpertiseCoverage {
  angle: boolean; examples: string[]; reasoning: boolean; judgment: boolean; confirmed: boolean;
  contradictions: string[]; gaps: string[];
}
export interface ExpertiseSession {
  opportunityId: string; thesis: string; thesisRevision: number; questions: ExpertiseQuestion[];
  answers: ExpertiseAnswer[]; corrections: { text: string; evidenceIds: string[]; revision: number }[];
  coverage: ExpertiseCoverage; position: number; nextQuestion: ExpertiseQuestion | null;
  status: 'interview' | 'confirm' | 'ready';
}
export interface ExpertiseClaim {
  id: string; text: string; evidenceIds: string[]; answerIds: string[];
  status: 'observed' | 'designer_confirmed' | 'attributed' | 'unresolved' | 'contradicted';
}
export interface ExpertiseArticle {
  title: string; introduction: string; claims: ExpertiseClaim[];
  introductionEvidenceIds?: string[]; introductionAnswerIds?: string[]; titleEvidenceIds?: string[]; titleAnswerIds?: string[];
  media: { evidenceId: string; assetId: string; projectId: string; projectName: string; roomName?: string; url: string; caption: string; alt: string; photographer?: string }[];
  cover: 'project' | 'portrait' | 'logo'; coverUrl?: string; coverPosition?: { x: number; y: number }; featured: boolean;
  thesisRevision: number; reviewed: boolean;
}
