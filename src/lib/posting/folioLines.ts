import { FolioLineSchema, type FolioLine, type PullQuoteSelection } from './schemas';
import type { LoadedAnswer } from './loadInterviewAnswers';
import { extractQuoteCandidates, isVerbatimSpan } from './quoteCandidates';
import { formatRoomName } from '@/lib/utils/formatRoomName';

export function folioRoomAnswers(room: string, answers: LoadedAnswer[]): LoadedAnswer[] {
  return answers.filter(a => a.category === null && a.questionId &&
    formatRoomName(a.section) === formatRoomName(room) && a.answer.trim());
}

/** Resolve against the actual room, never a project-level or private answer. */
export function folioLinesMatchSources(lines: FolioLine[], room: string, answers: LoadedAnswer[]): boolean {
  const eligible = folioRoomAnswers(room, answers);
  return lines.length > 0 && lines.every(line => FolioLineSchema.safeParse(line).success &&
    line.sources.some(source => isVerbatimSpan(line.originalText, [source.excerpt])) &&
    line.sources.every(source => {
      const matches = eligible.filter(a => a.questionId === source.questionId && a.isFollowUp === source.isFollowUp);
      return matches.length > 0 && matches.every(a => a.answer.includes(source.excerpt));
    }));
}

export interface FolioRewriteSource {
  id: string;
  quote: string;
  source: FolioLine['sources'][number];
}

/** Room prose may draw on answers that do not contain a ranked direct quote. */
export function folioTeaserSources(room: string, answers: LoadedAnswer[], direct?: PullQuoteSelection): FolioRewriteSource[] {
  const sources = folioRewriteSources(room, answers, direct);
  const eligible = folioRoomAnswers(room, answers);
  for (const answer of eligible) {
    if (sources.length >= 12) break;
    if (sources.some(s => s.source.questionId === answer.questionId && s.source.isFollowUp === answer.isFollowUp)) continue;
    if (eligible.some(a => a.questionId === answer.questionId && a.isFollowUp === answer.isFollowUp && a.answer !== answer.answer)) continue;
    const excerpt = answer.answer.slice(0, 4000);
    sources.push({ id: `q${sources.length + 1}`, quote: excerpt.slice(0, 300),
      source: { questionId: answer.questionId!, isFollowUp: answer.isFollowUp, excerpt } });
  }
  return sources;
}

/** Use the ranked pool first; older articles can recover direct candidates. */
export function folioRewriteSources(room: string, answers: LoadedAnswer[], direct?: PullQuoteSelection): FolioRewriteSource[] {
  const eligible = folioRoomAnswers(room, answers);
  const candidates = direct?.alternatives.length
    ? direct.alternatives
    : extractQuoteCandidates(eligible.map(a => ({ ...a, section: room })), room);
  const sources: FolioRewriteSource[] = [];
  for (const candidate of candidates) {
    const matches = eligible.filter(a => isVerbatimSpan(candidate.text, [a.answer]) &&
      (!('provenance' in candidate) || !candidate.provenance ||
        (a.questionId === candidate.provenance.questionId && a.isFollowUp === candidate.provenance.isFollowUp)));
    const answer = matches[0];
    if (!answer || !answer.questionId || candidate.text.length > 300) continue;
    if (matches.some(a => a.questionId !== answer.questionId || a.isFollowUp !== answer.isFollowUp)) continue;
    // Conflicting versions of one row key cannot furnish reliable context.
    if (eligible.some(a => a.questionId === answer.questionId && a.isFollowUp === answer.isFollowUp && a.answer !== answer.answer)) continue;
    if (sources.some(s => s.quote === candidate.text)) continue;
    // A long interview answer still has useful context around its direct quote.
    const at = answer.answer.indexOf(candidate.text);
    if (at < 0) continue;
    const from = Math.max(0, at - 1200);
    const excerpt = answer.answer.slice(from, Math.min(answer.answer.length, from + 4000));
    sources.push({ id: `q${sources.length + 1}`, quote: candidate.text,
      source: { questionId: answer.questionId, isFollowUp: answer.isFollowUp, excerpt } });
    if (sources.length === 6) break;
  }
  return sources;
}
