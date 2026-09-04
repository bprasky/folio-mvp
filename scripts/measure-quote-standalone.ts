/**
 * How often does a pull quote candidate read on its own?
 *
 * READ-ONLY MEASUREMENT. It calls `extractQuoteCandidates` exactly as the
 * generator does and scores what comes out. It changes no ranking, writes no
 * article field, and touches neither quoteCandidates.ts nor selectPullQuotes.ts.
 *
 * WHY THE QUESTION EXISTS. In published mode the reader sees the room photo and
 * the quote; the body is behind a click. A quote whose referent lives in the
 * hidden body therefore does not read. From project dda4b29e, Dining Room:
 * "It remains agreeable, but still on theme for the rest of the house for sure"
 * — "it" has no antecedent once the body is collapsed.
 *
 * WHAT IT DECIDES. Whether quote mode can offer standalone-only candidates. That
 * is viable only if quote mode rarely comes up empty, so the headline number is
 * the share of rooms with ZERO standalone candidates.
 *
 * Run:  npx tsx scripts/measure-quote-standalone.ts
 *       npx tsx scripts/measure-quote-standalone.ts --self-test   (no database)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { loadProjectEnv } from './lib/loadEnv.mjs';

// ===========================================================================
// THE RULE
// ===========================================================================
//
// Stated in full, because a percentage is only as honest as the predicate under
// it. Three verdicts, and the middle one exists so a genuinely uncertain call is
// counted rather than forced.
//
// ── NOT STANDALONE (high confidence, purely positional) ────────────────────
//
//   F1  The span OPENS with a bare referential pronoun or demonstrative:
//       it / this / that / they / them / those / these / he / she / him / her.
//       "Bare" means not immediately followed by a noun-ish word — `this room`
//       and `that decision` carry their own referent and are NOT failures.
//       First person (I / we / my / our / us) is never a failure: the speaker is
//       resolved by the attribution line. Generic `you` likewise — "you walk in
//       and…" is idiomatic design speech, resolved by the photograph.
//
//   F2  The span OPENS with a continuation conjunction: but / and / so /
//       because / which / though / although / plus / also / then / yet.
//       Grammatically dependent on a sentence that is not there.
//
//   F3  The span OPENS with a comparative or additive that implies a prior term:
//       same / another / other / more / less / better / worse / too / either /
//       neither / likewise.
//
// ── AMBIGUOUS ──────────────────────────────────────────────────────────────
//
//   A1  A bare third-person pronoun or demonstrative appears AFTER position 0
//       and no plausible antecedent precedes it inside the span.
//
//       "Plausible antecedent" is approximated without a POS tagger, which is
//       exactly why this bucket is ambiguous rather than a failure. A token
//       counts as a possible noun when it is (a) preceded by a determiner
//       (the/a/an/this/that/these/those/my/our/his/her/their/its), or (b)
//       capitalised without being sentence-initial, or (c) a member of a small
//       interior-design noun lexicon. Any of those before the pronoun and the
//       span is treated as self-resolving.
//
// ── STANDALONE ─────────────────────────────────────────────────────────────
//
//   Everything else.
//
// Deliberately NOT tested: whether the sentence is interesting, whether it is a
// fragment, whether a comparative mid-span ("more timeless") lacks its second
// term. Fragments and mid-span comparatives need a parser to call correctly, and
// a wrong call in either direction would move the headline number.

export type Verdict = 'standalone' | 'ambiguous' | 'not-standalone';

const FIRST_PERSON = new Set(['i', 'we', 'my', 'our', 'us', 'me', 'mine', 'ours']);
const BARE_REFERENTIAL = new Set([
  'it', 'this', 'that', 'they', 'them', 'those', 'these', 'he', 'she', 'him', 'her',
]);
const CONTINUATION = new Set([
  'but', 'and', 'so', 'because', 'which', 'though', 'although', 'plus', 'also', 'then', 'yet',
]);
const COMPARATIVE = new Set([
  'same', 'another', 'other', 'more', 'less', 'better', 'worse', 'too', 'either', 'neither', 'likewise',
]);
/**
 * Auxiliaries and high-frequency verbs. Only used to tell `that ROOM` (determiner,
 * self-resolving) from `that WAS` (pronoun, referent elsewhere). Incomplete by
 * nature — a verb missing from this list makes the span look self-resolving, so
 * the bias is toward counting a span as standalone. Stated in the limits.
 */
const VERBISH = new Set([
  'is', 'was', 'are', 'were', 'be', 'been', 'being', 'am',
  'has', 'have', 'had', 'does', 'did', 'do', 'will', 'would', 'can', 'could',
  'should', 'shall', 'may', 'might', 'must',
  'means', 'meant', 'seems', 'seemed', 'feels', 'felt', 'looks', 'looked',
  'gives', 'gave', 'makes', 'made', 'takes', 'took', 'comes', 'came', 'goes',
  'went', 'became', 'becomes', 'stays', 'stayed', 'remains', 'remained',
  'works', 'worked', 'reads', 'read', 'sits', 'sat', 'lets', 'let', 'keeps', 'kept',
]);

/**
 * Function words, for the antecedent proxy in A1. Anything NOT here and not a
 * pronoun counts as a possible noun. Crude, and deliberately generous: a real
 * POS tagger would fire A1 more often, so this under-reports ambiguity and
 * over-reports standalone. Direction of bias is stated in the limits.
 */
const FUNCTION_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'so', 'because', 'if', 'when', 'while',
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'about', 'into',
  'over', 'under', 'through', 'between', 'against', 'up', 'down', 'out', 'off',
  'as', 'than', 'that', 'this', 'these', 'those', 'it', 'its', 'they', 'them',
  'their', 'he', 'she', 'him', 'her', 'his', 'we', 'us', 'our', 'i', 'my', 'me',
  'you', 'your', 'not', 'no', 'very', 'just', 'still', 'also', 'too', 'really',
  'nothing', 'something', 'anything', 'everything', 'nobody', 'somebody',
  'anybody', 'everybody', 'someone', 'anyone', 'everyone', 'one', 'ones',
  'there', 'here', 'what', 'which', 'who', 'whom', 'whose', 'how', 'why',
  'all', 'any', 'some', 'both', 'each', 'more', 'most', 'other', 'such',
]);

const DETERMINERS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'our', 'his', 'her', 'their', 'its',
]);
/** Small, deliberately incomplete. Its only job is to reduce false ambiguity. */
const DESIGN_NOUNS = new Set([
  'room', 'rooms', 'house', 'home', 'kitchen', 'bath', 'bathroom', 'bedroom', 'entry', 'hall',
  'space', 'spaces', 'table', 'chair', 'chairs', 'sofa', 'light', 'lights', 'lighting', 'pendant',
  'pendants', 'cabinet', 'cabinets', 'cabinetry', 'counter', 'countertop', 'island', 'floor',
  'floors', 'wall', 'walls', 'ceiling', 'window', 'windows', 'door', 'doors', 'tile', 'stone',
  'marble', 'brass', 'oak', 'walnut', 'plaster', 'paint', 'colour', 'color', 'palette', 'finish',
  'finishes', 'material', 'materials', 'hardware', 'millwork', 'paneling', 'panelling', 'rug',
  'client', 'clients', 'project', 'design', 'plan', 'layout', 'view', 'scale', 'proportion',
]);

const words = (s: string): string[] =>
  s.trim().split(/\s+/).map((w) => w.replace(/^[^\w']+|[^\w']+$/g, ''));

const norm = (w: string): string => w.toLowerCase().replace(/[^a-z']/g, '');

export function scoreStandalone(text: string): { verdict: Verdict; reason: string } {
  const raw = words(text).filter(Boolean);
  if (raw.length === 0) return { verdict: 'not-standalone', reason: 'empty span' };

  const w = raw.map(norm);
  const first = w[0];
  const second = w[1] ?? '';

  // ── F1 ── bare referential opener
  if (BARE_REFERENTIAL.has(first) && !FIRST_PERSON.has(first)) {
    // `this room`, `that decision`, `these elements` carry their own referent.
    const determinerLike = ['this', 'that', 'these', 'those'].includes(first);
    // `that was`, `this means` — the demonstrative is a PRONOUN there, and its
    // referent is outside the span. `that decision`, `this room` are determiners.
    const followedByNoun =
      determinerLike &&
      second.length > 0 &&
      !BARE_REFERENTIAL.has(second) &&
      !CONTINUATION.has(second) &&
      !VERBISH.has(second);
    if (!followedByNoun) {
      return { verdict: 'not-standalone', reason: `F1 opens with bare "${raw[0]}"` };
    }
  }

  // ── F2 ── continuation conjunction opener
  if (CONTINUATION.has(first)) {
    return { verdict: 'not-standalone', reason: `F2 opens with continuation "${raw[0]}"` };
  }

  // ── F3 ── comparative / additive opener
  if (COMPARATIVE.has(first) || (first === 'the' && COMPARATIVE.has(second))) {
    return { verdict: 'not-standalone', reason: `F3 opens with comparative "${raw.slice(0, 2).join(' ')}"` };
  }

  // ── A1 ── unresolved pronoun after position 0
  for (let i = 1; i < w.length; i++) {
    const tok = w[i];
    if (!BARE_REFERENTIAL.has(tok) || FIRST_PERSON.has(tok)) continue;
    // `this room` etc. resolve themselves here too.
    if (['this', 'that', 'these', 'those'].includes(tok)) {
      const next = w[i + 1] ?? '';
      if (next && !BARE_REFERENTIAL.has(next) && !CONTINUATION.has(next)) continue;
    }
    // Is there a plausible antecedent noun before it, inside the span?
    // Proxy: any CONTENT word — not a function word, not an auxiliary. That
    // catches "Matto chose glass so it…" ("glass") without a POS tagger, at the
    // cost of also passing "The reason it worked…" ("reason"). Under-fires
    // rather than over-fires, which keeps the standalone count optimistic.
    let antecedent = false;
    for (let j = 0; j < i; j++) {
      const prevTok = w[j];
      if (!prevTok || prevTok.length < 2) continue;
      if (DESIGN_NOUNS.has(prevTok)) { antecedent = true; break; }
      if (!FUNCTION_WORDS.has(prevTok) && !VERBISH.has(prevTok)) { antecedent = true; break; }
      if (j > 0 && DETERMINERS.has(w[j - 1])) { antecedent = true; break; }
    }
    if (!antecedent) {
      return { verdict: 'ambiguous', reason: `A1 "${raw[i]}" at word ${i + 1} with no antecedent in span` };
    }
  }

  return { verdict: 'standalone', reason: 'no unresolved opener or pronoun' };
}

/** The sentence immediately before this span inside its source answer, if any. */
export function precedingSentence(answer: string, span: string): string | null {
  const at = answer.indexOf(span);
  if (at <= 0) return null;
  const before = answer.slice(0, at).trim();
  if (!before) return null;
  const parts = before.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

// ===========================================================================
// SELF TEST — proves the rule without a database
// ===========================================================================

function selfTest(): void {
  const cases: Array<[string, Verdict, string]> = [
    ['It remains agreeable, but still on theme for the rest of the house for sure', 'not-standalone', 'the live example from dda4b29e'],
    ['They wanted somewhere to put their coats and nothing else', 'not-standalone', 'bare "they"'],
    ['That was the decision that made the rest of it easy', 'not-standalone', 'bare "that" + pronoun'],
    ['But the brass was always going to darken', 'not-standalone', 'continuation opener'],
    ['Same with the powder room downstairs', 'not-standalone', 'comparative opener'],
    ['This room is a cross section of the entire project', 'standalone', 'demonstrative + noun resolves itself'],
    ['We always use glass when we need to make up space', 'standalone', 'first person is always resolved'],
    ['The mauve went in first and everything else had to answer to it', 'standalone', '"it" has "mauve" before it'],
    ['You walk in and the ceiling does the work', 'standalone', 'generic you'],
    ['Matto chose glass so it would not eat the floor', 'standalone', 'capitalised antecedent'],
    ['Nothing about it was accidental', 'ambiguous', 'pronoun, no antecedent in span'],
    ['We definitely didn’t want a monochromatic interior like the ones that are so popular these days', 'standalone', 'first person, no bare pronoun'],
  ];

  let failures = 0;
  console.log('\nself-test — the rule, against fabricated spans\n');
  for (const [text, expected, why] of cases) {
    const got = scoreStandalone(text);
    const ok = got.verdict === expected;
    if (!ok) failures++;
    console.log(
      `  ${ok ? 'PASS' : 'FAIL'}  ${expected.padEnd(14)} ${ok ? '' : `(got ${got.verdict}) `}${why}` +
      `\n        "${text.slice(0, 76)}${text.length > 76 ? '…' : ''}"` +
      `\n        → ${got.reason}`,
    );
  }

  const p = precedingSentence(
    'The table was the first thing we settled. It remains agreeable, but still on theme.',
    'It remains agreeable, but still on theme.',
  );
  const okPrev = p === 'The table was the first thing we settled.';
  if (!okPrev) failures++;
  console.log(`\n  ${okPrev ? 'PASS' : 'FAIL'}  preceding sentence recovered\n        ${JSON.stringify(p)}`);

  console.log(failures === 0 ? '\nAll self-test cases passed.\n' : `\n${failures} self-test case(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

// ===========================================================================
// MEASUREMENT
// ===========================================================================

type RoomRow = {
  projectId: string;
  slug: string;
  room: string;
  total: number;
  standalone: number;
  ambiguous: number;
  notStandalone: number;
};

type Miss = {
  projectId: string;
  room: string;
  reason: string;
  span: string;
  preceding: string | null;
};

type LoadedProject = {
  projectId: string;
  slug: string;
  chapters: Array<{ title?: string; kind?: string }>;
  answers: Array<{ section: string; answer: string; isFollowUp: boolean }>;
};

type Collected = {
  rows: RoomRow[];
  misses: Miss[];
  limits: { projectsNoAnswers: string[]; chaptersWithoutAnswers: number; chaptersTotal: number; generalOnlyProjects: string[] };
};

/**
 * The measurement itself. Takes already-loaded projects so the database read and
 * the fixture run exercise exactly the same scoring, bucketing and reporting —
 * a fixture that goes through a different code path proves nothing about the
 * real one.
 */
async function collect(projects: LoadedProject[]): Promise<Collected> {
  const { extractQuoteCandidates } = await import('../src/lib/posting/quoteCandidates');
  const { formatRoomName } = await import('../src/lib/utils/formatRoomName');

  const rows: RoomRow[] = [];
  const misses: Miss[] = [];
  const limits: Collected['limits'] = {
    projectsNoAnswers: [], chaptersWithoutAnswers: 0, chaptersTotal: 0, generalOnlyProjects: [],
  };

  for (const project of projects) {
    const { answers } = project;
    if (answers.length === 0) { limits.projectsNoAnswers.push(project.projectId); continue; }

    const roomKeys = Array.from(new Set(answers.map((a) => a.section).filter(Boolean)));
    if (roomKeys.length === 1 && roomKeys[0] === 'General') limits.generalOnlyProjects.push(project.projectId);

    // Chapters with no answers behind them can never offer a quote in either
    // mode; counted as a limit rather than folded into the percentage.
    const roomLabels = new Set(roomKeys.map((r) => formatRoomName(r)));
    for (const ch of project.chapters) {
      if (ch?.kind === 'gallery') continue;
      limits.chaptersTotal++;
      if (typeof ch?.title === 'string' && !roomLabels.has(ch.title)) limits.chaptersWithoutAnswers++;
    }

    for (const room of roomKeys) {
      const candidates = extractQuoteCandidates(answers, room);
      if (candidates.length === 0) continue; // no pool at all — not a scoring question

      let standalone = 0, ambiguous = 0, notStandalone = 0;
      for (const c of candidates) {
        const { verdict, reason } = scoreStandalone(c.text);
        if (verdict === 'standalone') standalone++;
        else if (verdict === 'ambiguous') ambiguous++;
        else {
          notStandalone++;
          misses.push({
            projectId: project.projectId,
            room: formatRoomName(room),
            reason,
            span: c.text,
            preceding: precedingSentence(answers[c.answerIndex]?.answer ?? '', c.text),
          });
        }
      }
      rows.push({ projectId: project.projectId, slug: project.slug, room: formatRoomName(room), total: candidates.length, standalone, ambiguous, notStandalone });
    }
  }
  return { rows, misses, limits };
}

async function main(): Promise<void> {
  const envFiles = loadProjectEnv();
  console.log(
    envFiles.length > 0
      ? `env loaded from ${envFiles.join(', ')}`
      : 'no .env.local or .env found; using the ambient environment only',
  );

  const { prisma } = await import('../src/lib/prisma');
  // Prisma requires DbNull (not a bare null) to filter a nullable Json column;
  // a bare null is rejected at runtime for Json fields.
  const { Prisma } = await import('@prisma/client');
  const { loadInterviewAnswers } = await import('../src/lib/posting/loadInterviewAnswers');
  // Every project with a generated article — that is the population the toggle
  // will actually be shown on.
  const posts = await prisma.projectPost.findMany({
    where: { expandedBlocks: { not: Prisma.DbNull } },
    select: { projectId: true, slug: true, expandedBlocks: true },
  });
  console.log(`projects with a generated article: ${posts.length}\n`);

  const projects: LoadedProject[] = [];
  for (const post of posts) {
    projects.push({
      projectId: post.projectId,
      slug: post.slug,
      chapters: (((post.expandedBlocks as Record<string, unknown> | null)?.galleryChapters ??
        []) as LoadedProject['chapters']),
      answers: (await loadInterviewAnswers(post.projectId)) as LoadedProject['answers'],
    });
  }

  const { rows, misses, limits } = await collect(projects);

  await prisma.$disconnect();
  writeReport(rows, misses, limits, posts.length);
}

function writeReport(
  rows: RoomRow[],
  misses: Miss[],
  limits: { projectsNoAnswers: string[]; chaptersWithoutAnswers: number; chaptersTotal: number; generalOnlyProjects: string[] },
  projectCount: number,
  mode: 'REAL' | 'FIXTURE' = 'REAL',
): void {
  const L: string[] = [];
  const pct = (n: number, d: number) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`);

  const bucket = (n: number) => (n === 0 ? '0' : n === 1 ? '1' : n === 2 ? '2' : '3+');
  const dist = { '0': 0, '1': 0, '2': 0, '3+': 0 } as Record<string, number>;
  for (const r of rows) dist[bucket(r.standalone)]++;

  const zeroRooms = rows.filter((r) => r.standalone === 0);
  const totalCandidates = rows.reduce((n, r) => n + r.total, 0);
  const totalStandalone = rows.reduce((n, r) => n + r.standalone, 0);
  const totalAmbiguous = rows.reduce((n, r) => n + r.ambiguous, 0);
  const totalNot = rows.reduce((n, r) => n + r.notStandalone, 0);

  L.push('# Quote Standalone Distribution');
  L.push('');
  if (mode === 'FIXTURE') {
    L.push('> **FIXTURE RUN — THESE NUMBERS ARE FABRICATED.** Proof that the pipeline');
    L.push('> executes end to end without a database. Not a measurement of anything.');
    L.push('');
  }
  L.push(`**Generated:** ${new Date().toISOString()}`);
  L.push(`**Command:** \`npx tsx scripts/measure-quote-standalone.ts\``);
  L.push('**Read-only.** No ranking changed, no article field written.');
  L.push('');
  L.push('## The headline number');
  L.push('');
  L.push(`**${pct(zeroRooms.length, rows.length)} of rooms have ZERO standalone candidates** ` +
    `(${zeroRooms.length} of ${rows.length} rooms with a candidate pool).`);
  L.push('');
  L.push('That is the rate at which quote mode comes up empty under a standalone-only rule.');
  L.push('');
  L.push('## Distribution, per room');
  L.push('');
  L.push('| standalone candidates | rooms | share |');
  L.push('|---|---:|---:|');
  for (const k of ['0', '1', '2', '3+']) L.push(`| ${k} | ${dist[k]} | ${pct(dist[k], rows.length)} |`);
  L.push('');
  L.push('| verdict | candidates | share |');
  L.push('|---|---:|---:|');
  L.push(`| standalone | ${totalStandalone} | ${pct(totalStandalone, totalCandidates)} |`);
  L.push(`| ambiguous | ${totalAmbiguous} | ${pct(totalAmbiguous, totalCandidates)} |`);
  L.push(`| not standalone | ${totalNot} | ${pct(totalNot, totalCandidates)} |`);
  L.push(`| **total** | **${totalCandidates}** | |`);
  L.push('');

  // ── per project ──
  const byProject = new Map<string, RoomRow[]>();
  for (const r of rows) {
    if (!byProject.has(r.projectId)) byProject.set(r.projectId, []);
    byProject.get(r.projectId)!.push(r);
  }

  L.push('## Article-level variance');
  L.push('');
  L.push('A project split evenly reads inconsistent on the page; a project uniformly one way reads as house style.');
  L.push('');
  L.push('| project | slug | rooms | rooms with ≥1 standalone | rooms with 0 | shape |');
  L.push('|---|---|---:|---:|---:|---|');
  let uniformClear = 0;
  let uniformEmpty = 0;
  let mixed = 0;
  for (const [projectId, rs] of Array.from(byProject.entries())) {
    const clear = rs.filter((r) => r.standalone > 0).length;
    const empty = rs.length - clear;
    const shape = empty === 0 ? 'uniform — all clear' : clear === 0 ? 'uniform — all empty' : 'mixed';
    if (empty === 0) uniformClear++;
    else if (clear === 0) uniformEmpty++;
    else mixed++;
    L.push(`| \`${projectId}\` | ${rs[0].slug} | ${rs.length} | ${clear} | ${empty} | ${shape} |`);
  }
  L.push('');
  L.push(`**Spread:** ${uniformClear} projects uniformly clear, ${uniformEmpty} uniformly empty, ${mixed} mixed.`);
  L.push('');

  L.push('## Per room');
  L.push('');
  L.push('| project | room | candidates | standalone | ambiguous | not standalone |');
  L.push('|---|---|---:|---:|---:|---:|');
  for (const r of rows) {
    L.push(`| \`${r.projectId.slice(0, 8)}\` | ${r.room} | ${r.total} | ${r.standalone} | ${r.ambiguous} | ${r.notStandalone} |`);
  }
  L.push('');

  // ── the 20 clearest misses ──
  // "Clearest" = the positional failures (F1/F2/F3), which need no judgement.
  const clearest = misses.filter((m) => /^F[123]/.test(m.reason)).slice(0, 20);
  L.push('## The 20 clearest non-standalone candidates');
  L.push('');
  L.push('Positional failures only (F1/F2/F3) — no judgement call in the selection.');
  L.push('Each span with the sentence that precedes it in the source answer, so you can see');
  L.push('whether the referent is recoverable there or lives further back.');
  L.push('');
  clearest.forEach((m, i) => {
    L.push(`### ${i + 1}. ${m.room} — \`${m.projectId.slice(0, 8)}\``);
    L.push('');
    L.push(`- **Rule:** ${m.reason}`);
    L.push(`- **Span:** "${m.span}"`);
    L.push(`- **Preceding sentence:** ${m.preceding ? `"${m.preceding}"` : '_none — the span opens its answer, so the referent is not in this answer at all_'}`);
    L.push('');
  });
  if (clearest.length === 0) L.push('_No positional failures found._');
  L.push('');

  L.push('## Limits');
  L.push('');
  L.push(`- **Projects measured:** ${projectCount} with a generated article; ${byProject.size} contributed at least one scored room.`);
  L.push(`- **Projects with no interview answers at all:** ${limits.projectsNoAnswers.length}. Excluded — they have no pool in either mode, so counting them would deflate the empty rate.`);
  L.push(`- **Projects whose answers are all unroomed ("General"):** ${limits.generalOnlyProjects.length}. Their answers never reach a room chapter, so their rooms do not appear above.`);
  L.push(`- **Chapters with no room-labelled answers behind them:** ${limits.chaptersWithoutAnswers} of ${limits.chaptersTotal}. These can never offer a quote in either mode; they are a floor on quote-mode coverage that is independent of the standalone rule.`);
  L.push('- **Rooms with an empty candidate pool are excluded** from the room count. The headline number is "of rooms that could offer a quote at all, how many can offer a standalone one" — the wider question of pool coverage is the bullet above.');
  L.push('- **Ambiguous is a real bucket, not a rounding error.** A1 approximates "is there a noun before this pronoun" without a POS tagger. Treating ambiguous as standalone raises the clear rate; treating it as a failure lowers it. Both bounds are in the verdict table.');
  L.push('- **Articles generated before the current extractor** are scored on candidates re-derived from their answers today, not on whatever shipped at the time. This measures what the toggle would offer now.');
  L.push('');

  // A fixture run writes to the OS temp directory, never into docs/ — fabricated
  // numbers under the real filename is exactly the confusion this measurement
  // exists to avoid.
  const out = mode === 'FIXTURE'
    ? path.join(tmpdir(), 'fixture-QUOTE_STANDALONE_DISTRIBUTION.md')
    : path.join('docs', 'audits', 'QUOTE_STANDALONE_DISTRIBUTION.md');
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, L.join('\n'));
  console.log(`\nwrote ${out}`);
  console.log(`headline: ${pct(zeroRooms.length, rows.length)} of ${rows.length} rooms have zero standalone candidates\n`);
}

/**
 * The whole pipeline against fabricated projects — same collect(), same
 * writeReport(), no database. Writes to a scratch path so it can never be
 * mistaken for a real measurement.
 */
async function fixtureRun(): Promise<void> {
  const A = (section: string, answer: string, isFollowUp = false) => ({ section, answer, isFollowUp });
  const projects: LoadedProject[] = [
    {
      projectId: 'fixture-0001-mixed', slug: 'fixture-mixed',
      chapters: [{ title: 'Dining Room' }, { title: 'Kitchen' }, { title: 'Entry' }, { title: 'Orphan Room' }],
      answers: [
        A('Dining Room', 'The table was the first thing we settled. It remains agreeable, but still on theme for the rest of the house for sure.'),
        A('Dining Room', 'We always use glass when we need to make up space. Had we used a solid table we would have crowded it badly.'),
        A('Kitchen', 'With the windows up top, we wanted it to be a bright space, and that helps with the transition between rooms.'),
        A('Kitchen', 'We did not want a monochromatic interior like the ones that are popular. But the brass was always going to darken over time.', true),
        A('Entry', 'They wanted somewhere to put their coats and nothing else. Same with the powder room downstairs honestly.'),
      ],
    },
    {
      projectId: 'fixture-0002-clear', slug: 'fixture-clear',
      chapters: [{ title: 'Living Room' }],
      answers: [
        A('Living Room', 'This room is a cross section of the entire project and always was. Matto chose glass so it would not eat the floor area.'),
        A('Living Room', 'The mauve went in first and everything else had to answer to it. You walk in and the ceiling does all of the work.', true),
      ],
    },
    { projectId: 'fixture-0003-empty', slug: 'fixture-no-answers', chapters: [], answers: [] },
  ];

  const { rows, misses, limits } = await collect(projects);
  writeReport(rows, misses, limits, projects.length, 'FIXTURE');
  console.log('\nFixture run complete. Numbers above are fabricated — proof the pipeline runs, not a measurement.\n');
}

if (process.argv.includes('--self-test')) selfTest();
else if (process.argv.includes('--fixture')) fixtureRun().catch((e) => { console.error(e); process.exit(1); });
else main().catch((e) => { console.error('\nmeasure-quote-standalone failed:', e instanceof Error ? e.message : e); process.exit(1); });
