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

type Verdict = 'VERBATIM' | 'WRONG_ROOM' | 'NOT_IN_INTERVIEW';

interface Finding {
  surface: Surface;
  /** Chapter title / location in the article. */
  where: string;
  text: string;
  verdict: Verdict;
  /** For WRONG_ROOM: the room the line was actually said about. */
  actualRoom?: string;
  /** For NOT_IN_INTERVIEW: the closest thing the designer really said. */
  nearest?: { text: string; room: string; overlap: number };
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

const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'to', 'in', 'it', 'we', 'that', 'is', 'was', 'for', 'on', 'with', 'you', 'i']);
const contentWords = (s: string) =>
  normalizeForVerbatimCheck(s).replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));

/** Sentence-level nearest neighbour, so the report shows what was really said. */
function nearestSaid(text: string, answers: SourceAnswer[]): Finding['nearest'] {
  const needle = new Set(contentWords(text));
  if (needle.size === 0) return undefined;
  let best: Finding['nearest'];
  for (const a of answers) {
    for (const sentence of a.answer.split(/(?<=[.!?])\s+/)) {
      if (!sentence.trim()) continue;
      const words = contentWords(sentence);
      if (words.length === 0) continue;
      const hits = words.filter(w => needle.has(w)).length;
      const overlap = hits / needle.size;
      if (!best || overlap > best.overlap) {
        best = { text: sentence.trim(), room: a.section, overlap };
      }
    }
  }
  return best && best.overlap > 0 ? best : undefined;
}

/** Room labels are formatted for display, so compare them loosely. */
const sameRoom = (a: string, b: string) => {
  const x = normalizeForVerbatimCheck(a).replace(/[^a-z0-9]/g, '');
  const y = normalizeForVerbatimCheck(b).replace(/[^a-z0-9]/g, '');
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

export function verify(
  q: { surface: Surface; where: string; text: string; room: string | null },
  answers: SourceAnswer[],
): Finding {
  const all = answers.map(a => a.answer);

  if (q.room) {
    const roomAnswers = answers.filter(a => sameRoom(a.section, q.room!)).map(a => a.answer);
    if (isVerbatimSpan(q.text, roomAnswers)) {
      return { surface: q.surface, where: q.where, text: q.text, verdict: 'VERBATIM' };
    }
  } else if (isVerbatimSpan(q.text, all)) {
    return { surface: q.surface, where: q.where, text: q.text, verdict: 'VERBATIM' };
  }

  // Said by the designer, but about a different room. Real words under the
  // wrong heading — a weaker failure than invention, still a failure.
  const elsewhere = answers.find(a => isVerbatimSpan(q.text, [a.answer]));
  if (elsewhere) {
    return {
      surface: q.surface,
      where: q.where,
      text: q.text,
      verdict: 'WRONG_ROOM',
      actualRoom: elsewhere.section,
    };
  }

  return {
    surface: q.surface,
    where: q.where,
    text: q.text,
    verdict: 'NOT_IN_INTERVIEW',
    nearest: nearestSaid(q.text, answers),
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
  const findings = quotes.map(q => verify(q, answers));

  if (asJson) {
    console.log(JSON.stringify({ projectId, slug: post.slug, answers: answers.length, findings }, null, 2));
    await prisma.$disconnect();
    return;
  }

  const isPullQuote = (f: Finding) => PULL_QUOTE_SURFACES.includes(f.surface);
  const pull = findings.filter(isPullQuote);
  const body = findings.filter(f => !isPullQuote(f));

  console.log(`\nArticle quote audit — project ${projectId}`);
  console.log(`post ${post.slug} (${post.status}), regenerated ${post.updatedAt.toISOString()}`);
  console.log(`${answers.length} interview answers across ${new Set(answers.map(a => a.section)).size} rooms`);

  const section = (label: string, group: Finding[]) => {
    const bad = group.filter(f => f.verdict !== 'VERBATIM');
    console.log(`\n${label}: ${group.length} quote(s), ${group.length - bad.length} verbatim, ${bad.length} unverified`);
    for (const f of group) {
      const mark = f.verdict === 'VERBATIM' ? 'OK  ' : f.verdict === 'WRONG_ROOM' ? 'ROOM' : 'FAIL';
      console.log(`  ${mark}  [${f.surface} @ ${f.where}]`);
      console.log(`        "${f.text}"`);
      if (f.verdict === 'WRONG_ROOM') {
        console.log(`        ^ verbatim, but the designer said it about: ${f.actualRoom}`);
      }
      if (f.verdict === 'NOT_IN_INTERVIEW') {
        if (f.nearest) {
          console.log(`        ^ NOT in any answer. Closest real line (${Math.round(f.nearest.overlap * 100)}% overlap, ${f.nearest.room}):`);
          console.log(`          "${f.nearest.text}"`);
        } else {
          console.log('        ^ NOT in any answer, and nothing in the interview resembles it.');
        }
      }
    }
  };

  section('PULL QUOTES (code-selected — any failure is a pipeline bug)', pull);
  section('IN-BODY ATTRIBUTED QUOTES (model-written — unverified by the pipeline)', body);

  const failed = findings.filter(f => f.verdict !== 'VERBATIM');
  console.log(
    failed.length === 0
      ? '\nEvery quote in this article is verbatim from the interview.\n'
      : `\n${failed.length} of ${findings.length} quote(s) are not verbatim from the interview.\n`,
  );

  await prisma.$disconnect();
  process.exit(failed.length === 0 ? 0 : 1);
}

// Only run when invoked directly, so the exports above stay importable.
if (process.argv[1] && /audit-article-quotes\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
