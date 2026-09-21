import type { Candidate, CandidateVisual, Dimension, Penalty } from './types';

export const WEIGHTS: Record<Dimension, number> = { story: 25, evidence: 20, visual: 20, specificity: 10, novelty: 10, designerFit: 10, formatFit: 5 };
export const PENALTY_CAPS: Record<Penalty, number> = { semanticOverlap: 25, visualRepetition: 20, genericFraming: 15, commercialDistortion: 20, staleness: 8 };
const clamp = (n: number, max = 1) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;

/** Extractive grounding is intentional: an LLM's citation is not proof of entailment. */
export function supported(text: string, candidate: Pick<Candidate, 'evidence'>, ids?: string[]): boolean {
  if (ids && (!ids.length || ids.some(id => !candidate.evidence.some(e => e.id === id)))) return false;
  return Boolean(text.trim()) && candidate.evidence.some(e => e.tier === 'direct' && (!ids || ids.includes(e.id)) && e.text.includes(text.trim()));
}

export function visualSuitable(image: CandidateVisual) {
  return image.approved && image.width >= 1080 && image.height >= 1080 &&
    image.technical >= .65 && image.relevance >= .65 && image.aesthetic >= .6 && image.crop >= .65;
}

export function imageSimilarity(a: CandidateVisual, b: CandidateVisual): number {
  if (a.id === b.id || a.url === b.url) return 1;
  if (!a.perceptualHash || a.perceptualHash.length !== b.perceptualHash.length) return 0;
  let distance = 0;
  for (let i = 0; i < a.perceptualHash.length; i++) if (a.perceptualHash[i] !== b.perceptualHash[i]) distance++;
  return 1 - distance / a.perceptualHash.length;
}

const words = (text: string) => new Set(text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3));
export function storySimilarity(a: Candidate, b: Candidate): number {
  const similarity = (x: string, y: string) => {
    const left = words(x), right = words(y);
    const union = new Set([...Array.from(left), ...Array.from(right)]);
    return union.size ? Array.from(left).filter(word => right.has(word)).length / union.size : 0;
  };
  return Math.max(similarity(a.thesis, b.thesis),
    similarity(a.claims.map(claim => claim.text).join(' '), b.claims.map(claim => claim.text).join(' ')));
}

export function evaluateCandidate(input: Candidate, history: Candidate[] = []): Candidate {
  const candidate: Candidate = structuredClone(input);
  const reasons: string[] = candidate.reasons.filter(reason => ['source_contradiction', 'semantic_duplicate'].includes(reason));
  const dimensions = candidate.dimensions;
  for (const key of Object.keys(WEIGHTS) as Dimension[]) dimensions[key] = clamp(dimensions[key]);
  for (const key of Object.keys(PENALTY_CAPS) as Penalty[]) candidate.penalties[key] = clamp(candidate.penalties[key], PENALTY_CAPS[key]);
  if (!candidate.thesis.trim() || dimensions.story < .65 || dimensions.specificity < .6) reasons.push('weak_premise');
  if (!supported(candidate.thesis, candidate)) reasons.push('unsupported_thesis');
  if (!candidate.claims.length || candidate.claims.some(claim => !supported(claim.text, candidate, claim.evidenceIds))) reasons.push('unsupported_claim');
  const caption = candidate.claims.map(claim => claim.text).join('\n\n');
  if (candidate.draft.caption !== caption || !supported(candidate.draft.headline, candidate)) reasons.push('unsupported_copy');
  const creditedCaption = `${candidate.draft.caption}\n\nDesign: ${candidate.draft.credits.designer}\nPhotography: ${candidate.draft.credits.photographer || ''}`;
  if (creditedCaption.length > 2200 || candidate.draft.headline.length > 180) reasons.push('copy_too_long');
  if (!candidate.visuals.length || !visualSuitable(candidate.visuals[0])) reasons.push('unsuitable_hero');
  if (candidate.visuals.slice(1).some(image => !visualSuitable(image))) reasons.push('unsuitable_supporting_image');
  if (candidate.visuals.some(image => !image.approved || !candidate.projectIds.includes(image.projectId))) reasons.push('unauthorized_asset');
  if (candidate.evidence.some(e => !candidate.projectIds.includes(e.projectId))) reasons.push('unauthorized_evidence');
  if (candidate.visuals.some((image, index) => candidate.visuals.slice(0, index).some(other => imageSimilarity(image, other) >= .9))) reasons.push('repetitive_sequence');
  if (candidate.format === 'carousel' && candidate.visuals.length < 2) reasons.push('insufficient_sequence');
  const previous = history.filter(item => item.id !== candidate.id && !item.dismissed &&
    (item.readiness === 'ready' || item.readiness === 'quick' || item.confirmedPublishedAt));
  if (previous.some(item => storySimilarity(candidate, item) >= .7)) reasons.push('duplicate_story');
  if (previous.some(item => item.visuals.some(image => candidate.visuals.some(own => imageSimilarity(own, image) >= .9)))) {
    candidate.penalties.visualRepetition = 20;
  }
  candidate.score = Math.round(clamp((Object.keys(WEIGHTS) as Dimension[]).reduce((sum, key) => sum + WEIGHTS[key] * dimensions[key], 0) -
    (Object.keys(PENALTY_CAPS) as Penalty[]).reduce((sum, key) => sum + candidate.penalties[key], 0), 100));
  const unresolved = candidate.blockers.filter(blocker => !blocker.answer?.trim());
  if (!candidate.draft.credits.designer) reasons.push('missing_designer');
  // Missing credits may be completed, but a cleared blocker cannot mask an empty credit.
  if (!candidate.draft.credits.photographer && !unresolved.some(blocker => blocker.kind === 'credit')) reasons.push('missing_photographer');
  candidate.reasons = Array.from(new Set(reasons));
  candidate.readiness = reasons.length || candidate.score < 50 ? 'suppressed'
    : candidate.score >= 80 && unresolved.length === 0 ? 'ready'
      // Answers currently close bounded blockers; they do not rescore editorial
      // quality. Do not promise a quick finish for a 65–79 story that cannot
      // reach Ready through the offered steps.
      : candidate.score >= 80 && unresolved.length >= 1 && unresolved.length <= 3 ? 'quick' : 'developing';
  return candidate;
}

/** Quality bands are five points wide. Diversity never promotes a lower band. No filler. */
export function selectCandidates(candidates: Candidate[], limit = 6): Candidate[] {
  const eligible = candidates.filter(c => !c.dismissed && !c.confirmedPublishedAt && ['ready', 'quick'].includes(c.readiness));
  const result: Candidate[] = [];
  while (eligible.length && result.length < Math.min(6, Math.max(0, limit))) {
    eligible.sort((a, b) => Math.floor(b.score / 5) - Math.floor(a.score / 5) ||
      result.filter(c => c.shape === a.shape).length - result.filter(c => c.shape === b.shape).length || b.score - a.score || a.id.localeCompare(b.id));
    const next = eligible.shift()!;
    if (result.some(item => storySimilarity(item, next) >= .7 || item.visuals.some(a => next.visuals.some(b => imageSimilarity(a, b) >= .9)))) continue;
    if (next.projectIds.some(id => result.filter(c => c.projectIds.includes(id)).length >= 2)) continue;
    result.push(next);
  }
  return result;
}

/** A saved answer is direct evidence. It never silently changes the designer's words. */
export function answerBlocker(candidate: Candidate, blockerId: string, answer: string): Candidate {
  const next: Candidate = structuredClone(candidate);
  const blocker = next.blockers.find(item => item.id === blockerId);
  if (!blocker || !answer.trim() || answer.length > 2200) throw new Error('Provide a valid answer to this step.');
  if (blocker.options && !blocker.options.includes(answer)) throw new Error('Choose one of the offered options.');
  blocker.answer = answer.trim();
  const id = `answer:${blockerId}`;
  next.evidence = next.evidence.filter(e => e.id !== id);
  next.evidence.push({ id, projectId: next.projectIds[0], text: answer.trim(), tier: 'direct', source: 'designer_answer' });
  if (blocker.kind === 'credit') next.draft.credits.photographer = answer.trim();
  if (blocker.kind === 'truth' || blocker.kind === 'story') {
    next.claims = next.claims.filter(claim => !claim.evidenceIds.includes(id));
    next.claims.push({ text: answer.trim(), evidenceIds: [id] });
    next.draft.caption = next.claims.map(claim => claim.text).join('\n\n');
  }
  if (blocker.kind === 'visual') {
    const chosen = next.visuals.find(image => image.id === answer);
    if (!chosen) throw new Error('Choose an approved image.');
    next.visuals = [chosen, ...next.visuals.filter(image => image.id !== chosen.id)];
  }
  return evaluateCandidate(next);
}
