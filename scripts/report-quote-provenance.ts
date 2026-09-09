// ============================================================================
// Re-verify every stored pull quote against the answer it points at.
//
// REPORT ONLY. It never edits a quote, never blocks a render, never fails a
// build. It exists so the verifier's output can be read on real data BEFORE
// anything is allowed to act on it.
//
// Not wired into render. The article render path reads expandedBlocks and does
// not load interview answers, so re-verifying at render would add a multi-query
// read to every article view for a check that currently only reports. Once these
// numbers are known and the mismatch count is understood, that is the moment to
// decide where it belongs.
// ============================================================================

import { loadProjectEnv } from './lib/loadEnv.mjs';
import { verifyPullQuoteProvenance, type ProvenanceVerdict }
  from '../src/lib/posting/verifyQuoteProvenance';
import { isPullQuoteSelection } from '../src/lib/posting/schemas';

const ORDER: ProvenanceVerdict[] = ['verified', 'unverifiable', 'ambiguous', 'answer-missing', 'mismatch'];

async function main(): Promise<void> {
  const envFiles = loadProjectEnv();
  console.log(envFiles.length > 0
    ? `env loaded from ${envFiles.join(', ')}\n`
    : 'no .env.local or .env found; using the ambient environment only\n');

  const { prisma } = await import('../src/lib/prisma');
  const { Prisma } = await import('@prisma/client');
  const { loadInterviewAnswers } = await import('../src/lib/posting/loadInterviewAnswers');

  const posts = await prisma.projectPost.findMany({
    where: { expandedBlocks: { not: Prisma.DbNull } },
    select: { projectId: true, slug: true, expandedBlocks: true },
  });
  console.log(`projects with a generated article: ${posts.length}\n`);

  const totals: Record<string, number> = {};
  const alarms: string[] = [];

  for (const post of posts) {
    const answers = await loadInterviewAnswers(post.projectId);
    const chapters = ((post.expandedBlocks as Record<string, unknown> | null)
      ?.galleryChapters ?? []) as Array<{ title?: string; pullQuote?: unknown }>;

    for (const ch of chapters) {
      if (!isPullQuoteSelection(ch?.pullQuote)) continue;
      for (const c of verifyPullQuoteProvenance(ch.pullQuote, answers)) {
        totals[c.verdict] = (totals[c.verdict] ?? 0) + 1;
        // Only these two mean something is actually wrong. `unverifiable` is a
        // pre-provenance row and `verified` is the happy path.
        if (c.verdict === 'mismatch' || c.verdict === 'answer-missing' || c.verdict === 'ambiguous') {
          alarms.push(
            `  ${post.slug} / ${ch.title ?? '(untitled)'} / ${c.slot}\n` +
            `    ${c.verdict}: ${c.detail}\n` +
            `    "${c.text}"`,
          );
        }
      }
    }
  }
  await prisma.$disconnect();

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  console.log(`quotes checked (selections + alternatives): ${total}\n`);
  for (const v of ORDER) {
    const n = totals[v] ?? 0;
    const pct = total > 0 ? ((n / total) * 100).toFixed(1) : '0.0';
    console.log(`  ${v.padEnd(15)} ${String(n).padStart(5)}  ${pct}%`);
  }

  console.log(
    total === 0
      ? '\nNothing to check yet.'
      : (totals['unverifiable'] ?? 0) === total
        ? '\nEvery quote predates the provenance pointer. Expected until an article is regenerated —\nnothing is backfilled, so pointers appear only on quotes selected from now on.'
        : '',
  );

  if (alarms.length > 0) {
    console.log(`\n${alarms.length} quote(s) need a look:\n`);
    console.log(alarms.join('\n\n'));
  } else if (total > 0) {
    console.log('\nNo mismatches, missing answers, or ambiguous pointers.');
  }
  console.log('\nReport only. Nothing was changed and nothing is blocked.');
}

main().catch((e) => {
  console.error('\nreport-quote-provenance failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
