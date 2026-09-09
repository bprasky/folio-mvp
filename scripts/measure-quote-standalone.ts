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

// The scorer itself now lives in src/lib/posting/quoteStandalone.ts, because
// extractQuoteCandidates ranks on it too. A second copy here would let the
// measurement and the ranking drift apart silently, which would make this
// document a description of a rule the product no longer uses. The rule is
// documented in full at the top of that module.
import { scoreStandalone, precedingSentence } from '../src/lib/posting/quoteStandalone';
import type { Verdict } from '../src/lib/posting/quoteStandalone';

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
