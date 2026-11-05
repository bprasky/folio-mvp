import { acceptedTurns } from '@/lib/interview/guided/controller';
import type { GuidedSession } from '@/lib/interview/guided/types';
import type { LiveAdapterSnapshot, LiveSavedAnswers } from './adapter-types';

export function snapshotGuidedSession(snapshot?: LiveAdapterSnapshot): GuidedSession | null {
  if (!snapshot || !['project', 'project_guide'].includes(snapshot.source.kind)) return null;
  const native = snapshot.state.native as GuidedSession | { canonical?: GuidedSession } | undefined;
  return (snapshot.source.kind === 'project_guide' ? (native as { canonical?: GuidedSession })?.canonical : native as GuidedSession) || null;
}

export function projectSavedAnswers(snapshot?: LiveAdapterSnapshot, canonical = snapshotGuidedSession(snapshot)): LiveSavedAnswers | null {
  if (!snapshot || !canonical || !['project', 'project_guide'].includes(snapshot.source.kind)) return null;
  // A reset starts a different canonical interview; an old call must not gain
  // editing authority over the replacement session through a refreshed GET.
  if (snapshotGuidedSession(snapshot)?.id !== canonical.id) return null;
  const editable = snapshot.source.kind === 'project' || snapshot.guide?.phase === 'interview' || snapshot.guide?.phase === 'complete';
  return { sessionId: canonical.id, version: canonical.version, answers: acceptedTurns(canonical).map(turn => {
    let original = turn;
    const seen = new Set([turn.id]);
    while (original.supersedes && !seen.has(original.supersedes)) {
      const prior = canonical.turns.find(value => value.id === original.supersedes && value.questionId === turn.questionId);
      if (!prior) break;
      seen.add(prior.id); original = prior;
    }
    return { id: turn.id, questionId: turn.questionId, questionText: turn.questionText, text: turn.text,
      originalText: original.text, inputModality: turn.inputModality, editable };
  }) };
}
