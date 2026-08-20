/**
 * Audit every quoted string in a generated article against what the designer
 * actually said in the interview.
 *
 * Two different guarantees are being checked, and they are NOT the same:
 *
 *   PULL QUOTES (display type) are selected by code from the designer's own
 *   answers — `selectPullQuotes` hands the model IDs, never text — so these
 *   should be verbatim by construction. A failure here is a pipeline bug.
 *
 *   IN-BODY QUOTES ("…," Rivera recalls) are WRITTEN BY THE MODEL. The prompt
 *   requires at least one attributed quote per chapter and tells the model not
 *   to invent, but nothing verifies the result, and two later passes
 *   (fixSentenceOpeners, applyProseNamingGate) rewrite body paragraphs after
 *   the fact. A failure here is expected to be possible — that is the whole
 *   reason to run this.
 *
 * Verbatim is judged with the same normalizer the pipeline uses
 * (`normalizeForVerbatimCheck`): whitespace, quote/dash glyphs and case are
 * forgiven because typesetting legitimately changes them; a swapped word is not.
 *
 * Anything that is not verbatim is reported with a word-level diff against the
 * closest real line, and left for a human to rule on. The script deliberately
 * does not decide that a small edit was harmless — `wll`->`will` (a repaired
 * transcript typo) and `on`->`in` (the alteration that actually shipped once)
 * are the same edit distance.
 *
 * Run:  npx tsx scripts/audit-article-quotes.ts <projectId> [--json]
 */
process.env.ANTHROPIC_API_KEY ||= 'sk-ant-placeholder-for-static-checks';

import { isVerbatimSpan, normalizeForVerbatimCheck } from '../src/lib/posting/quoteCandidates';

// Prisma is imported lazily inside `main` so the pure extraction/verification
// logic below can be exercised by a fixture without a database connection.
type Prisma = typeof import('../src/lib/prisma')['prisma'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SourceAnswer {
  answer: string;
  section: string;
  isFollowUp: boolean;
  origin: string;
}

type Surface =
  | 'hookQuote'
  | 'chapter.pullQuote'
  | 'chapter.pullQuote.alternative'
  | 'pullQuotes[]'
  | 'sections[].quote'
  | 'body';

/**
 * "Not verbatim" is not one thing, and lumping the cases together is what makes
 * a report unreadable. A model that repaired a transcript typo and a model that
 * invented a sentence both fail a substring check; only one of them is a
 * hallucination, and they call for opposite responses.
 */
type Verdict =
  /** Exact span of one answer (modulo whitespace/glyph/case). */
  | 'VERBATIM'
  /**
   * Close to a real line, with word-level differences. Deliberately NOT split
   * into "typo repair" and "rewording": `wll`->`will` and `on`->`in` are both
   * one-character substitutions, and only grammar and meaning separate a fixed
   * transcript typo from a changed claim. A rule that called the first benign
   * would call the second benign too — and `on tension` -> `in tension` is the
   * exact defect this pipeline was rebuilt to prevent. The diff is printed and
   * a human decides.
   */
  | 'ALTERED'
  /** Sentences are each verbatim, but not contiguous — joined from separate places. */
  | 'SPLICED'
  /** Verbatim, but from an answer about a different room. */
  | 'WRONG_ROOM'
  /** Nothing in the interview resembles it. */
  | 'INVENTED';

interface WordChange {
  from: string;
  to: string;
  /** Character edit distance. Reported as context, never used to excuse a change. */
  distance: number;
}

interface Finding {
  surface: Surface;
  /** Chapter title / location in the article. */
  where: string;
  text: string;
  verdict: Verdict;
  /** For WRONG_ROOM: the room the line was actually said about. */
  actualRoom?: string;
  /** The closest real thing the designer said, for every non-VERBATIM verdict. */
  source?: { text: string; room: string; similarity: number };
  /** For ALTERED: exactly which words moved, so the call is one glance. */
  changes?: WordChange[];
  /** For SPLICED: per-sentence verdicts, so the invented half is visible. */
  sentences?: Array<{ text: string; verbatim: boolean }>;
}

// ---------------------------------------------------------------------------
// Source of truth: the answers the generator itself read
// ---------------------------------------------------------------------------

/**
 * The generator reads `provenance.interview.payload.answers` (+ `.followups`)
 * and falls back to the EditorialInterviewAnswer table. Audit against BOTH,
 * merged: auditing against a narrower corpus than the writer saw would
 * manufacture false hallucinations.
 */
async function loadAnswers(prisma: Prisma, projectId: string, provenance: any): Promise<SourceAnswer[]> {
  const out: SourceAnswer[] = [];
  const push = (answer: unknown, section: unknown, isFollowUp: unknown, origin: string) => {
    if (typeof answer !== 'string' || !answer.trim()) return;
    out.push({
      answer,
      section: (typeof section === 'string' && section.trim()) || 'General',
      isFollowUp: !!isFollowUp,
      origin,
    });
  };

  const payload = provenance?.interview?.payload ?? {};
  for (const a of Array.isArray(payload.answers) ? payload.answers : []) {
    push(a?.a ?? a?.answer, a?.roomName ?? a?.section, a?.isFollowUp, 'provenance.answers');
  }
  for (const a of Array.isArray(payload.followups) ? payload.followups : []) {
    push(a?.a ?? a?.answer, a?.roomName ?? a?.section, true, 'provenance.followups');
  }
  // Legacy mirror the route also accepts.
  for (const a of Array.isArray(provenance?.interview?.answers) ? provenance.interview.answers : []) {
    push(a?.a ?? a?.answer, a?.roomName ?? a?.section, a?.isFollowUp, 'provenance.interview.answers');
  }

  const interview = await prisma.editorialInterview.findUnique({
    where: { projectId },
    include: { answers: { orderBy: { createdAt: 'asc' } } },
  });
  if (interview?.answers?.length) {
    const rooms = await prisma.room.findMany({
      where: { projectId },
      select: { id: true, name: true },
    }).catch(() => [] as Array<{ id: string; name: string }>);
    const roomName = new Map(rooms.map(r => [r.id, r.name]));
    for (const a of interview.answers) {
      push(a.answerText, a.roomId ? roomName.get(a.roomId) : undefined, a.isFollowUp, 'EditorialInterviewAnswer');
    }
  }

  // De-dupe identical text captured in more than one place.
  const seen = new Set<string>();
  return out.filter(a => {
    const key = `${normalizeForVerbatimCheck(a.section)}::${normalizeForVerbatimCheck(a.answer)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Extracting every quoted string out of the article
// ---------------------------------------------------------------------------

const asText = (v: unknown): string | null => {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (v && typeof v === 'object') {
    const t = (v as any).text ?? (v as any).selected?.text;
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  return null;
};

/**
 * Attributed quotes inside prose. Matches a curly- or straight-quoted span; the
 * pipeline writes curly quotes, but overrides and legacy rows carry straight
 * ones.
 *
 * A quote must be long enough to be speech: short quoted spans in design prose
 * are material names, room nicknames and scare quotes ("the 'good' marble"),
 * not the designer talking, and flagging them buries the real finding.
 */
const MIN_SPEECH_WORDS = 5;

export function extractProseQuotes(paragraph: string): string[] {
  const out: string[] = [];
  const re = /[“"]([^“”"]{10,600})[”"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paragraph)) !== null) {
    const text = m[1].trim().replace(/[,.;:]$/, '');
    if (text.split(/\s+/).filter(Boolean).length < MIN_SPEECH_WORDS) continue;
    out.push(text);
  }
  return out;
}

export function collectQuotes(blocks: any): Array<{ surface: Surface; where: string; text: string; room: string | null }> {
  const found: Array<{ surface: Surface; where: string; text: string; room: string | null }> = [];

  const hook = asText(blocks?.hookQuote);
  if (hook) found.push({ surface: 'hookQuote', where: 'lead', text: hook, room: null });

  for (const q of Array.isArray(blocks?.pullQuotes) ? blocks.pullQuotes : []) {
    const text = asText(q);
    if (!text) continue;
    const section = typeof q === 'object' ? (q as any).sourceSection ?? null : null;
    found.push({ surface: 'pullQuotes[]', where: section ?? 'article', text, room: section });
  }

  const chapters = Array.isArray(blocks?.galleryChapters) ? blocks.galleryChapters : [];
  chapters.forEach((ch: any, i: number) => {
    const title = typeof ch?.title === 'string' && ch.title.trim() ? ch.title.trim() : `chapter ${i}`;

    const selected = asText(ch?.pullQuote);
    if (selected) found.push({ surface: 'chapter.pullQuote', where: title, text: selected, room: title });

    const alternatives = ch?.pullQuote?.alternatives;
    for (const alt of Array.isArray(alternatives) ? alternatives : []) {
      const text = asText(alt);
      // The selected quote is also in alternatives by design; don't double-report.
      if (!text || (selected && normalizeForVerbatimCheck(text) === normalizeForVerbatimCheck(selected))) continue;
      found.push({ surface: 'chapter.pullQuote.alternative', where: title, text, room: title });
    }

    for (const para of Array.isArray(ch?.body) ? ch.body : []) {
      if (typeof para !== 'string') continue;
      for (const text of extractProseQuotes(para)) {
        found.push({ surface: 'body', where: title, text, room: title });
      }
    }
  });

  for (const [i, para] of (Array.isArray(blocks?.introduction) ? blocks.introduction : []).entries()) {
    if (typeof para !== 'string') continue;
    for (const text of extractProseQuotes(para)) {
      found.push({ surface: 'body', where: `introduction[${i}]`, text, room: null });
    }
  }

  // Legacy/compose-stage shape some older rows still carry.
  for (const [i, s] of (Array.isArray(blocks?.sections) ? blocks.sections : []).entries()) {
    const where = typeof s?.heading === 'string' && s.heading.trim() ? s.heading.trim() : `section[${i}]`;
    const quote = asText(s?.quote);
    if (quote) found.push({ surface: 'sections[].quote', where, text: quote, room: where });
    if (typeof s?.body === 'string') {
      for (const text of extractProseQuotes(s.body)) {
        found.push({ surface: 'body', where, text, room: where });
      }
    }
  }

  return found;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

const splitSentences = (s: string) => s.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
const wordsOf = (s: string) => normalizeForVerbatimCheck(s).replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean);

/** Longest common subsequence table over two word arrays. */
function lcsTable(a: string[], b: string[]): number[][] {
  const t = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      t[i][j] = a[i - 1] === b[j - 1] ? t[i - 1][j - 1] + 1 : Math.max(t[i - 1][j], t[i][j - 1]);
    }
  }
  return t;
}

const similarity = (a: string[], b: string[]) =>
  a.length && b.length ? lcsTable(a, b)[a.length][b.length] / Math.max(a.length, b.length) : 0;

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Word-level changes from `said` to `printed`, aligned by LCS so a single
 * substitution reports as one change rather than shifting everything after it.
 */
function wordChanges(said: string[], printed: string[]): WordChange[] {
  const t = lcsTable(said, printed);
  const changes: WordChange[] = [];
  let i = said.length, j = printed.length;
  const removed: string[] = [], added: string[] = [];
  const flush = () => {
    while (removed.length || added.length) {
      const from = removed.pop() ?? '';
      const to = added.pop() ?? '';
      changes.push({ from, to, distance: from && to ? levenshtein(from, to) : Math.max(from.length, to.length) });
    }
  };
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && said[i - 1] === printed[j - 1]) { flush(); i--; j--; }
    else if (j > 0 && (i === 0 || t[i][j - 1] >= t[i - 1][j])) { added.push(printed[j - 1]); j--; }
    else { removed.push(said[i - 1]); i--; }
  }
  flush();
  return changes.reverse();
}

/**
 * Every contiguous 1-to-3-sentence run of every answer — the shapes a legitimate
 * quote can take. Comparing against whole answers instead would drown a short
 * quote's similarity score in surrounding text it never claimed to include.
 */
function sourceSpans(answers: SourceAnswer[]): Array<{ text: string; room: string }> {
  const spans: Array<{ text: string; room: string }> = [];
  for (const a of answers) {
    const sentences = splitSentences(a.answer);
    for (let i = 0; i < sentences.length; i++) {
      for (let n = 1; n <= 3 && i + n <= sentences.length; n++) {
        spans.push({ text: sentences.slice(i, i + n).join(' '), room: a.section });
      }
    }
  }
  return spans;
}

/** Below this, the quote is not a version of anything the designer said. */
const INVENTED_BELOW = 0.5;

/** Room labels are formatted for display, so compare them loosely. */
const sameRoom = (a: string, b: string) => {
  const x = normalizeForVerbatimCheck(a).replace(/[^a-z0-9]/g, '');
  const y = normalizeForVerbatimCheck(b).replace(/[^a-z0-9]/g, '');
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

export function verify(
  q: { surface: Surface; where: string; text: string; room: string | null },
  answers: SourceAnswer[],
  spans: Array<{ text: string; room: string }> = sourceSpans(answers),
): Finding {
  const base = { surface: q.surface, where: q.where, text: q.text };
  const all = answers.map(a => a.answer);

  // Room-scope the check only when the corpus actually knows about that room.
  // Interview answers do not always carry a room, and scoping against an empty
  // set would report every quote in the article as misattributed.
  const roomAnswers = q.room ? answers.filter(a => sameRoom(a.section, q.room!)) : [];
  const roomIsKnown = roomAnswers.length > 0;

  if (isVerbatimSpan(q.text, roomIsKnown ? roomAnswers.map(a => a.answer) : all)) {
    return { ...base, verdict: 'VERBATIM' };
  }

  // Real words, wrong heading. Only reachable when we know the room, so this
  // never fires on an answer set that simply lacks room attribution.
  if (roomIsKnown) {
    const elsewhere = answers.find(a => isVerbatimSpan(q.text, [a.answer]));
    if (elsewhere) return { ...base, verdict: 'WRONG_ROOM', actualRoom: elsewhere.section };
  }

  // Each sentence real, the whole not: the model joined lines the designer said
  // apart. The words are his; the continuity is the model's.
  const sentences = splitSentences(q.text);
  if (sentences.length > 1) {
    const perSentence = sentences.map(text => ({ text, verbatim: isVerbatimSpan(text, all) }));
    if (perSentence.every(s => s.verbatim)) {
      return { ...base, verdict: 'SPLICED', sentences: perSentence };
    }
  }

  const printed = wordsOf(q.text);
  let best: { text: string; room: string; similarity: number } | undefined;
  for (const span of spans) {
    const sim = similarity(wordsOf(span.text), printed);
    if (!best || sim > best.similarity) best = { ...span, similarity: sim };
  }

  if (!best || best.similarity < INVENTED_BELOW) {
    return { ...base, verdict: 'INVENTED', source: best };
  }

  return {
    ...base,
    verdict: 'ALTERED',
    changes: wordChanges(wordsOf(best.text), printed),
    source: best,
    sentences: sentences.length > 1
      ? sentences.map(text => ({ text, verbatim: isVerbatimSpan(text, all) }))
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const PULL_QUOTE_SURFACES: Surface[] = [
  'hookQuote',
  'chapter.pullQuote',
  'chapter.pullQuote.alternative',
  'pullQuotes[]',
  'sections[].quote',
];

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const projectId = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);
  const asJson = process.argv.includes('--json');
  if (!projectId) {
    console.error('usage: npx tsx scripts/audit-article-quotes.ts <projectId> [--json]');
    process.exit(2);
  }

  const post = await prisma.projectPost.findUnique({
    where: { projectId },
    select: { id: true, slug: true, status: true, updatedAt: true, expandedBlocks: true, provenance: true },
  });
  if (!post) {
    console.error(`No ProjectPost for project ${projectId}. Nothing to audit.`);
    process.exit(1);
  }

  const answers = await loadAnswers(prisma, projectId, post.provenance as any);
  if (answers.length === 0) {
    console.error('No interview answers found for this project — every quote would report as invented.');
    console.error('Refusing to produce a misleading report. Check provenance.interview and EditorialInterviewAnswer.');
    process.exit(1);
  }

  const quotes = collectQuotes(post.expandedBlocks as any);
  const spans = sourceSpans(answers);
  const findings = quotes.map(q => verify(q, answers, spans));

  if (asJson) {
    console.log(JSON.stringify({ projectId, slug: post.slug, answers: answers.length, findings }, null, 2));
    await prisma.$disconnect();
    return;
  }

  const isPullQuote = (f: Finding) => PULL_QUOTE_SURFACES.includes(f.surface);
  const pull = findings.filter(isPullQuote);
  const body = findings.filter(f => !isPullQuote(f));

  const sections = Array.from(new Set(answers.map(a => a.section)));
  console.log(`\nArticle quote audit — project ${projectId}`);
  console.log(`post ${post.slug} (${post.status}), regenerated ${post.updatedAt.toISOString()}`);
  console.log(`${answers.length} interview answers, grouped under: ${sections.join(', ')}`);
  // Room-scoping is only as good as the room labels on the answers. Say so
  // rather than letting a reader assume misattribution was ruled out.
  const chapterTitles = new Set(
    (((post.expandedBlocks as any)?.galleryChapters ?? []) as any[])
      .map(c => c?.title).filter((t): t is string => typeof t === 'string'),
  );
  const matched = Array.from(chapterTitles).filter(t => sections.some(sec => sameRoom(sec, t)));
  if (matched.length < chapterTitles.size) {
    console.log(
      `NOTE: ${chapterTitles.size - matched.length} of ${chapterTitles.size} chapters have no room-labelled answers, ` +
      'so their quotes are checked against the whole interview. Misattribution between those rooms is NOT ruled out.',
    );
  }

  const MARK: Record<Verdict, string> = {
    VERBATIM: 'OK  ', ALTERED: 'EDIT', SPLICED: 'JOIN',
    WRONG_ROOM: 'ROOM', INVENTED: 'FAIL',
  };

  const section = (label: string, group: Finding[]) => {
    const counts = group.reduce<Record<string, number>>((acc, f) => {
      acc[f.verdict] = (acc[f.verdict] ?? 0) + 1;
      return acc;
    }, {});
    const tally = Object.entries(counts).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ') || 'none';
    console.log(`\n${label}: ${group.length} quote(s) — ${tally}`);
    for (const f of group) {
      console.log(`  ${MARK[f.verdict]}  [${f.surface} @ ${f.where}]`);
      console.log(`        "${f.text}"`);
      if (f.verdict === 'WRONG_ROOM') {
        console.log(`        ^ verbatim, but the designer said it about: ${f.actualRoom}`);
      }
      if (f.verdict === 'SPLICED') {
        console.log('        ^ each sentence is real, but they were not said together:');
        for (const sen of f.sentences ?? []) console.log(`          - "${sen.text}"`);
      }
      if (f.verdict === 'ALTERED') {
        const edits = (f.changes ?? [])
          .map(c => `${c.from || '∅'} → ${c.to || '∅'}`).join(', ');
        console.log(`        ^ ALTERED (${Math.round((f.source?.similarity ?? 0) * 100)}% match): ${edits}`);
        console.log(`          he said: "${f.source?.text}"`);
        for (const sen of f.sentences ?? []) {
          if (!sen.verbatim) console.log(`          unmatched sentence: "${sen.text}"`);
        }
      }
      if (f.verdict === 'INVENTED') {
        console.log(
          f.source
            ? `        ^ NOT in the interview. Closest real line (${Math.round(f.source.similarity * 100)}% match, ${f.source.room}):\n          "${f.source.text}"`
            : '        ^ NOT in the interview, and nothing in it resembles this.',
        );
      }
    }
  };

  section('PULL QUOTES (code-selected — any failure is a pipeline bug)', pull);
  section('IN-BODY ATTRIBUTED QUOTES (model-written — unverified by the pipeline)', body);

  const fabricated = findings.filter(f => f.verdict === 'INVENTED' || f.verdict === 'WRONG_ROOM');
  const altered = findings.filter(f => f.verdict === 'ALTERED' || f.verdict === 'SPLICED');
  if (fabricated.length) {
    console.log(`\n${fabricated.length} quote(s) are not in the interview at all, or are attributed to the wrong room.`);
  }
  if (altered.length) {
    console.log(
      `\n${altered.length} quote(s) differ from the transcript. Read each diff: a repaired typo and a changed ` +
      'claim look identical to this script, and only one of them is publishable.',
    );
  }
  if (!fabricated.length && !altered.length) {
    console.log('\nEvery quote in this article is verbatim from the interview.');
  }
  console.log('');

  await prisma.$disconnect();
  // Any difference from the transcript is a finding: an alteration needs a
  // human decision just as much as an invention does.
  process.exit(fabricated.length + altered.length === 0 ? 0 : 1);
}

// Only run when invoked directly, so the exports above stay importable.
if (process.argv[1] && /audit-article-quotes\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
