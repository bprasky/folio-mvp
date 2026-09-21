import type { ComputedSignal, RawCorpusLayer } from './types';

/** Resolve readable source references without treating model framing as fact. */
export function resolveSignalEvidence(signal: ComputedSignal, raw: RawCorpusLayer): void {
  const evidence = signal.evidence;
  const projectIds = new Set(evidence.projectIds ?? []);
  const imageIds = new Set(evidence.imageIds ?? []);
  const tagIds = new Set(evidence.productTagIds ?? []);
  const productIds = new Set(evidence.productIds ?? []);
  for (const tag of raw.tags) {
    if (tagIds.has(tag.tagId) || imageIds.has(tag.imageId) || productIds.has(tag.productId)) {
      projectIds.add(tag.projectId);
    }
  }
  for (const image of raw.images) if (imageIds.has(image.imageId)) projectIds.add(image.projectId);
  for (const answer of raw.interviewAnswers) {
    if (evidence.interviewAnswerIds?.includes(answer.answerId)) projectIds.add(answer.projectId);
  }
  evidence.projectIds = Array.from(projectIds).sort();
  evidence.sources = [
    { id: signal.id, kind: 'computed_signal', text: signal.headline, detail: signal.detail },
    ...raw.projects.filter(p => projectIds.has(p.projectId)).map(p => ({ id: p.projectId, kind: 'project', text: p.title })),
    ...raw.products.filter(p => productIds.has(p.productId)).map(p => ({ id: p.productId, kind: 'product', text: p.name })),
    ...raw.interviewAnswers.filter(a => evidence.interviewAnswerIds?.includes(a.answerId))
      .map(a => ({ id: a.answerId, kind: 'interview_answer', text: a.answerText })),
  ];
}
