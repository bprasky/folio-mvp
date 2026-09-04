// ============================================================================
// Two read-only reports about pull quote ranking. Neither blocks anything.
//
//   default        Rooms with FEWER THAN ONE standalone candidate.
//   --ordering     Before/after candidate order for one room, so a change to
//                  the ranking can be seen rather than trusted.
//
// Why the first one exists: the founding-cohort measurement put the
// zero-standalone rate at 0.0% of 16 rooms, but that cohort is six projects the
// interview was tuned on, and every approximation in the scorer leans toward
// calling a span standalone — so 0.0% is a floor, not a forecast. A colder
// designer, interviewed less well, will produce rooms where nothing survives the
// collapse. That is a signal about interview capture, and it should arrive as a
// number here rather than as a designer staring at a picker full of quotes that
// do not read.
//
// Report only. It never edits an article and never blocks a publish.
// ============================================================================

import { loadProjectEnv } from './lib/loadEnv.mjs';
import { scoreStandalone } from '../src/lib/posting/quoteStandalone';
import { extractQuoteCandidates, type QuoteCandidate, type AnswerLike }
  from '../src/lib/posting/quoteCandidates';

/**
 * The ranking as it stood BEFORE self-sufficiency became an input, reproduced
 * here only so --ordering has something to diff against. It is not used by the
 * product and is not a second implementation of anything live: the current
 * ranking has exactly one home, in quoteCandidates.ts.
 */
function previousOrdering(candidates: QuoteCandidate[]): QuoteCandidate[] {
  const ideal = 18;
  return [...candidates].sort((x, y) => {
    if (x.isFollowUp !== y.isFollowUp) return x.isFollowUp ? -1 : 1;
    return Math.abs(x.wordCount - ideal) - Math.abs(y.wordCount - ideal);
  });
}

const VERDICT_MARK: Record<string, string> = {
  'standalone': 'OK ',
  'ambiguous': '?  ',
  'not-standalone': 'X  ',
};

function line(c: QuoteCandidate): string {
  const { verdict, reason } = scoreStandalone(c.text);
  const tag = c.isFollowUp ? 'follow-up' : 'primary  ';
  return `${VERDICT_MARK[verdict]}[${c.id}] ${tag} ${String(c.wordCount).padStart(2)}w  "${c.text}"\n         ${reason}`;
}

type Room = { projectId: string; slug: string; room: string; answers: AnswerLike[] };

/** Every room of every project that has a generated article. */
async function loadRooms(): Promise<Room[]> {
  const { prisma } = await import('../src/lib/prisma');
  const { Prisma } = await import('@prisma/client');
  const { loadInterviewAnswers } = await import('../src/lib/posting/loadInterviewAnswers');

  const posts = await prisma.projectPost.findMany({
    where: { expandedBlocks: { not: Prisma.DbNull } },
    select: { projectId: true, slug: true },
  });

  const rooms: Room[] = [];
  for (const post of posts) {
    const answers = (await loadInterviewAnswers(post.projectId)) as AnswerLike[];
    const seen = new Set<string>();
    for (const a of answers) {
      const room = a.section ?? '';
      if (!room || seen.has(room)) continue;
      seen.add(room);
      rooms.push({ projectId: post.projectId, slug: post.slug, room, answers });
    }
  }
  await prisma.$disconnect();
  return rooms;
}

/** Requirement: surface rooms with fewer than one standalone candidate. */
function reportGaps(rooms: Room[]): void {
  let scored = 0;
  const gaps: Array<{ r: Room; total: number; ambiguous: number }> = [];

  for (const r of rooms) {
    const candidates = extractQuoteCandidates(r.answers, r.room);
    if (candidates.length === 0) {
      // No pool at all. A different problem — the no-fallback rule, not
      // self-sufficiency — but it lands on the designer as the same empty
      // picker, so it is reported rather than skipped.
      gaps.push({ r, total: 0, ambiguous: 0 });
      continue;
    }
    scored++;
    const verdicts = candidates.map((c) => scoreStandalone(c.text).verdict);
    const standalone = verdicts.filter((v) => v === 'standalone').length;
    if (standalone < 1) {
      gaps.push({ r, total: candidates.length, ambiguous: verdicts.filter((v) => v === 'ambiguous').length });
    }
  }

  console.log(`rooms with candidates: ${scored}`);
  console.log(`rooms with fewer than one standalone candidate: ${gaps.length}\n`);

  if (gaps.length === 0) {
    console.log('No gaps. Every room with a candidate pool has at least one quote that reads on its own.');
    return;
  }

  for (const g of gaps) {
    const detail = g.total === 0
      ? 'no candidates at all — the interview produced nothing quotable for this room'
      : `${g.total} candidate(s), none standalone (${g.ambiguous} ambiguous)`;
    console.log(`  ${g.r.slug} / ${g.r.room}`);
    console.log(`    ${detail}`);
    console.log(`    project ${g.r.projectId}`);
  }
  console.log('\nReport only. Nothing was changed and nothing is blocked.');
}

/** Requirement: show what the self-sufficiency input actually moved. */
function reportOrdering(rooms: Room[], projectPrefix: string, roomQuery: string): void {
  const matches = rooms.filter(
    (r) =>
      (r.projectId.startsWith(projectPrefix) || r.slug.includes(projectPrefix)) &&
      r.room.toLowerCase() === roomQuery.toLowerCase(),
  );

  if (matches.length === 0) {
    console.log(`No room matched project "${projectPrefix}" / room "${roomQuery}".`);
    const near = rooms.filter((r) => r.projectId.startsWith(projectPrefix) || r.slug.includes(projectPrefix));
    if (near.length > 0) {
      console.log(`\nRooms on that project: ${[...new Set(near.map((r) => r.room))].join(', ')}`);
    }
    process.exitCode = 1;
    return;
  }

  for (const r of matches) {
    const after = extractQuoteCandidates(r.answers, r.room);
    const before = previousOrdering(after);

    console.log(`\n${'='.repeat(78)}\n${r.slug} / ${r.room}  (project ${r.projectId})\n${'='.repeat(78)}`);
    console.log(`\nBEFORE — follow-up tier, then length:\n`);
    before.forEach((c, i) => console.log(`  ${String(i + 1).padStart(2)}. ${line(c)}`));
    console.log(`\nAFTER — self-sufficiency, then follow-up tier, then length:\n`);
    after.forEach((c, i) => console.log(`  ${String(i + 1).padStart(2)}. ${line(c)}`));

    const beforeIds = before.map((c) => c.id).join(',');
    const afterIds = after.map((c) => c.id).join(',');
    console.log(`\n  before: ${beforeIds}`);
    console.log(`  after:  ${afterIds}`);
    if (beforeIds === afterIds) {
      console.log('\n  Unchanged — this room ranked the same either way.');
    } else if (before[0]?.id !== after[0]?.id) {
      console.log(`\n  Top of list changed:\n    was  "${before[0]?.text}"\n    now  "${after[0]?.text}"`);
    } else {
      // The common case on a healthy room: the best quote was already standalone,
      // and the change shows up further down as the broken ones sink.
      const demoted = before
        .map((c, i) => ({ c, from: i, to: after.findIndex((a) => a.id === c.id) }))
        .filter((m) => m.to > m.from);
      console.log('\n  Top unchanged. Demoted:');
      for (const m of demoted) {
        console.log(`    ${m.c.id}: ${m.from + 1} -> ${m.to + 1}  (${scoreStandalone(m.c.text).reason})`);
      }
    }
  }
}

/**
 * Fabricated rooms, so both reports can be proven to run without a database.
 * The Dining Room answers mirror the real dda4b29e material quoted in
 * docs/audits/QUOTE_STANDALONE_DISTRIBUTION.md; "Cold Room" is the case the gap
 * report exists for — a room whose every candidate depends on the hidden body.
 */
function fixtureRooms(): Room[] {
  const A = (section: string, answer: string, isFollowUp = false): AnswerLike =>
    ({ section, answer, isFollowUp });
  return [
    {
      projectId: 'fixture-0001', slug: 'fixture-mixed', room: 'Dining Room',
      answers: [
        A('Dining Room', 'The table was the first thing we settled. It remains agreeable, but still on theme for the rest of the house for sure.'),
        A('Dining Room', 'We always use glass when we need to make up space. Had we used a solid table we would have crowded it badly.', true),
      ],
    },
    {
      projectId: 'fixture-0001', slug: 'fixture-mixed', room: 'Cold Room',
      answers: [
        A('Cold Room', 'It was the one room the budget never really reached in the end. But we did what we could with the light in there.'),
      ],
    },
  ];
}

async function main(): Promise<void> {
  const envFiles = loadProjectEnv();
  console.log(envFiles.length > 0
    ? `env loaded from ${envFiles.join(', ')}\n`
    : 'no .env.local or .env found; using the ambient environment only\n');

  const argv = process.argv.slice(2);
  const orderingAt = argv.indexOf('--ordering');
  const isFixture = argv.includes('--fixture');
  const rooms = isFixture ? fixtureRooms() : await loadRooms();
  if (isFixture) console.log('FIXTURE MODE — fabricated rooms. Proof the reports run, not a measurement.\n');

  if (orderingAt !== -1) {
    const projectPrefix = argv[orderingAt + 1];
    const roomQuery = argv.slice(orderingAt + 2).filter((a) => a !== '--fixture').join(' ');
    if (!projectPrefix || !roomQuery) {
      console.error('usage: --ordering <projectIdPrefix|slugFragment> <Room Name>');
      process.exit(1);
    }
    reportOrdering(rooms, projectPrefix, roomQuery);
    return;
  }

  reportGaps(rooms);
}

main().catch((e) => {
  console.error('\nreport-quote-ranking failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
