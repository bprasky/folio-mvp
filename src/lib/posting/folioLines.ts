import { FolioLineSchema, getSelectedRoomLineText, isPullQuoteSelection, type FolioLine, type PullQuoteSelection } from './schemas';
import type { LoadedAnswer } from './loadInterviewAnswers';
import { extractQuoteCandidates, isVerbatimSpan } from './quoteCandidates';
import { formatRoomName } from '@/lib/utils/formatRoomName';

/** Shared draft-load check, including excerpts invalidated by ordinary prose edits. */
export function needsRoomTeaserPreparation(chapter: { kind?: string; body?: string[]; pullQuote?: string | PullQuoteSelection | null }): boolean {
  if (chapter.kind === 'gallery' || !chapter.body?.some(p => p.trim())) return false;
  const pq = chapter.pullQuote;
  if (!getSelectedRoomLineText(pq) || !isPullQuoteSelection(pq) || !pq.folio?.alternatives.length) return true;
  if (pq.folio.alternatives.some(line => !FolioLineSchema.safeParse(line).success)) return true;
  // Older fallback pools could be saved with no direct choices, then treated as
  // complete forever. Attempt their recovery once; version 3 records the attempt
  // even when a room truly has no interview evidence or the provider is down.
  if (pq.folio.generatorVersion !== 3 && (!pq.alternatives.length || pq.folio.alternatives.some(isArticleFolioLine))) return true;
  return pq.folio.alternatives.some(line =>
    line.sources.some(source => 'kind' in source && source.kind === 'article' &&
      !chapter.body![source.paragraphIndex]?.includes(source.excerpt)));
}

export function isArticleFolioLine(line: FolioLine): boolean {
  return line.sources.some(source => 'kind' in source && source.kind === 'article');
}

export function folioRoomAnswers(room: string, answers: LoadedAnswer[]): LoadedAnswer[] {
  return answers.filter(a => a.category === null && a.questionId &&
    formatRoomName(a.section) === formatRoomName(room) && a.answer.trim());
}

/** Resolve against the actual room, never a project-level or private answer. */
export function folioLinesMatchSources(lines: FolioLine[], room: string, answers: LoadedAnswer[], article: string[] = []): boolean {
  const eligible = folioRoomAnswers(room, answers);
  return lines.length > 0 && lines.every(line => FolioLineSchema.safeParse(line).success &&
    line.sources.some(source => isVerbatimSpan(line.originalText, [source.excerpt])) &&
    line.sources.every(source => {
      if ('kind' in source && source.kind === 'article') {
        return Boolean(article[source.paragraphIndex]?.includes(source.excerpt)) &&
          (source.excerpt === line.text || (line.text.endsWith('…') && source.excerpt.startsWith(line.text.slice(0, -1))));
      }
      if (!('questionId' in source)) return false;
      const matches = eligible.filter(a => a.questionId === source.questionId && a.isFollowUp === source.isFollowUp);
      return matches.length > 0 && matches.every(a => a.answer.includes(source.excerpt));
    }));
}

/** No provider call: preserve actual story wording when fresh AI options are unavailable. */
export function articleFolioLines(_room: string, article: string[]): FolioLine[] {
  const lines: FolioLine[] = [];
  const add = (excerpt: string, paragraphIndex: number) => {
    if (lines.length >= 6) return;
    const compact = excerpt.trim();
    if (!compact) return;
    const text = compact.length <= 300 ? compact : `${compact.slice(0, 299).replace(/\s+\S*$/, '').trimEnd()}…`;
    if (lines.some(line => line.text === text)) return;
    lines.push({ text, originalText: compact.slice(0, 300),
      sources: [{ kind: 'article', paragraphIndex, excerpt: compact.slice(0, 4000) }] });
  };
  article.forEach((paragraph, paragraphIndex) => {
    // Remove whole quotations first, including multi-sentence quotes, so an inner
    // sentence can never masquerade as the article's third-person narration.
    const narrative = paragraph.replace(/“[^”]*”|"[^"]*"/g, '');
    for (const sentence of narrative.match(/[^.!?]+(?:[.!?]+|$)/g) || []) {
      const text = sentence.trim();
      if (text.length < 20 || /\b(I|we|our|ours|us|you|your|yours|says|said|explains|adds|admits)\b/i.test(text) ||
        !paragraph.includes(text)) continue;
      add(text, paragraphIndex);
      if (lines.length === 6) return;
    }
  });
  // A quote-only story is still usable evidence. Keep its wording/attribution
  // intact as an editorial excerpt; never relabel it as an interview quote.
  if (!lines.length) article.forEach((paragraph, index) => { if (lines.length < 6) add(paragraph, index); });
  return lines.slice(0, 6);
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
    if (sources.some(s => 'questionId' in s.source && s.source.questionId === answer.questionId && s.source.isFollowUp === answer.isFollowUp)) continue;
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
