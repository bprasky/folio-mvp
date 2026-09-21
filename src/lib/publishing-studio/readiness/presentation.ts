import type { Candidate } from './types';

export function candidatePresentation(candidate: Candidate) {
  const blockers = candidate.blockers.filter(item => !item.answer?.trim());
  let label = 'Ready for review', action = 'Review post';
  if (blockers.length === 1) {
    const kind = blockers[0].kind;
    if (kind === 'credit') { label = 'Photo credit needed'; action = 'Add photo credit'; }
    else if (kind === 'visual') { label = 'Imagery needs review'; action = 'Review imagery'; }
    else if (kind === 'review') { label = 'Source review needed'; action = 'Review changes'; }
    else { label = 'One answer needed'; action = 'Answer one question'; }
  } else if (blockers.length > 1) { label = `${blockers.length} steps remaining`; action = 'Finish this story'; }
  else if (candidate.readiness !== 'ready') { label = 'Needs development'; action = 'Review story'; }
  const caption = Boolean(candidate.draft.caption.trim());
  const cover = Boolean(candidate.visuals[0]?.url);
  const preparation = caption && cover ? 'Caption & cover prepared' : caption ? 'Caption prepared · imagery needs review' : cover ? 'Imagery selected · caption needs work' : 'Source material needs review';
  return { label, action, preparation, blockers };
}

/** Display order is the server's order. Three is a ceiling, never a quota. */
export function storySections(candidates: Candidate[]) {
  const primary = candidates.slice(0, 3);
  const rest = candidates.slice(3);
  const portfolio = rest.find(candidate => candidate.projectIds.length > 1);
  return { primary, portfolio, more: rest.filter(candidate => candidate.id !== portfolio?.id) };
}

export function preparationLine(candidates: Candidate[]) {
  const blockers = candidates.map(candidate => candidatePresentation(candidate).blockers);
  if (blockers.every(items => items.length === 0)) return 'Prepared for you. Ready for your review.';
  if (blockers.every(items => items.length === 0 || (items.length === 1 && ['truth', 'story', 'voice'].includes(items[0].kind)))) return 'Prepared for you. Review a story or add the missing detail.';
  return 'Prepared for you, with the remaining steps clearly marked.';
}
