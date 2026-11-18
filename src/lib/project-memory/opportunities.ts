import type { PrivateProjectDigest, ProjectEvidence } from './digest';

export interface StoryOpportunitySuggestion {
  id: string;
  title: string;
  angle: string;
  evidenceIds: string[];
  confidence: 'supported' | 'needs_clarification';
  missingPiece: string;
  status: 'suggestion';
}

const meaningful = (e: ProjectEvidence) => e.kind !== 'file' && e.kind !== 'image';
const explanation = (e: ProjectEvidence) => e.attribution === 'direct' && e.text.length >= 18;

/**
 * Deterministic first-pass editorial suggestions, never a claim that an event
 * happened on the record/upload date. No AI-generated facts or automatic posts.
 */
export function suggestProjectStories(digest: PrivateProjectDigest): StoryOpportunitySuggestion[] {
  const sources = digest.evidence.filter(meaningful);
  const results: StoryOpportunitySuggestion[] = [];
  const changes = sources.filter(e => e.kind === 'selection_change' && /swapped|removed|updated/i.test(e.text));
  for (const change of changes) {
    const related = sources.find(e => e.id !== change.id && e.roomId && e.roomId === change.roomId && explanation(e));
    const evidenceIds = related ? [change.id, related.id] : [change.id];
    results.push({
      id: `opportunity:change:${change.sourceId}`,
      title: 'The decision behind a design change',
      angle: related
        ? 'Explore the recorded selection change alongside the designer\'s explanation. Verify the connection before drafting.'
        : 'Explore why this selection changed and what the final decision achieved.',
      evidenceIds,
      confidence: related ? 'supported' : 'needs_clarification',
      missingPiece: related
        ? 'Confirm whether these two records describe the same design decision, and what the outcome was.'
        : 'What prompted this change, and how did it improve the finished space?',
      status: 'suggestion',
    });
    if (results.length >= 2) break;
  }
  const decision = sources.find(e => e.kind === 'decision' && explanation(e) && !results.some(r => r.evidenceIds.includes(e.id)));
  if (decision && results.length < 3) {
    results.push({
      id: `opportunity:decision:${decision.sourceId}`,
      title: 'Why this design decision mattered',
      angle: 'A designer-recorded choice may reveal the thinking and tradeoffs behind the project.',
      evidenceIds: [decision.id],
      confidence: 'needs_clarification',
      missingPiece: 'What alternatives did you consider, and what happened after this decision?',
      status: 'suggestion',
    });
  }
  const interview = sources.find(e => e.kind === 'interview' && explanation(e) && !results.some(r => r.evidenceIds.includes(e.id)));
  if (interview && results.length < 3) {
    results.push({
      id: `opportunity:interview:${interview.sourceId}`,
      title: 'The thinking behind this project',
      angle: 'An existing interview answer may contain a perspective worth developing.',
      evidenceIds: [interview.id],
      confidence: 'needs_clarification',
      missingPiece: 'Which photo or moment best illustrates what you described?',
      status: 'suggestion',
    });
  }
  return results;
}
