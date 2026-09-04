/**
 * Did the question category survive to the loader?
 *
 * Read-only. No writes, no backfill — it answers two questions and changes
 * nothing:
 *
 *   1. THE RECOVERABILITY SPLIT. Per project, the distinct `section` values in
 *      provenance.interview.payload.answers. A project whose answers are
 *      uniformly 'how' went through the old reverse sync, which re-derived the
 *      category with a 'how' fallback and overwrote the canonical value — its
 *      category is not recoverable. A spread across the twelve SECTION_ENUM
 *      values is provenance-native and intact.
 *
 *   2. THE CONFIRMATION. For one provenance-native project, run the real
 *      loader and print what each answer arrives with. `questionCategory`
 *      populated here is the whole point of the migration: the value was never
 *      missing, only discarded, so reading it needs no backfill.
 *
 * Run: npx tsx scripts/report-question-category.ts [projectId]
 *      (with no argument it picks the most provenance-native project it finds)
 */

import { loadProjectEnv } from './lib/loadEnv.mjs';

const envFiles = loadProjectEnv();
console.log(
  envFiles.length > 0
    ? `env loaded from ${envFiles.join(', ')}\n`
    : 'no .env.local or .env found; using the ambient environment only\n',
);

const SECTIONS = [
  'designIntent', 'materialsMethod', 'collaboration', 'emotionalCore',
  'insightsReflection', 'lightningRound', 'why', 'who', 'what', 'where', 'when', 'how',
];

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const { loadInterviewAnswers } = await import('../src/lib/posting/loadInterviewAnswers');

  const posts = await prisma.projectPost.findMany({
    where: { provenance: { not: null as any } },
    select: { projectId: true, slug: true, provenance: true },
  });

  type Row = { projectId: string; slug: string; answers: number; sections: string[] };
  const rows: Row[] = [];
  for (const p of posts) {
    const payload = (p.provenance as any)?.interview?.payload;
    const all = [
      ...(Array.isArray(payload?.answers) ? payload.answers : []),
      ...(Array.isArray(payload?.followups) ? payload.followups : []),
    ];
    if (all.length === 0) continue;
    const sections = Array.from(
      new Set(all.map((a: any) => a?.section).filter((s: any) => typeof s === 'string')),
    ).sort() as string[];
    rows.push({ projectId: p.projectId, slug: p.slug, answers: all.length, sections });
  }

  // ── 1. The split ───────────────────────────────────────────────────────────
  const derived = rows.filter((r) => r.sections.length === 1 && r.sections[0] === 'how');
  const native = rows.filter((r) => !(r.sections.length === 1 && r.sections[0] === 'how'));

  console.log('═══ RECOVERABILITY SPLIT ═══\n');
  console.log(`projects with provenance answers : ${rows.length}`);
  console.log(`  uniformly 'how' (reverse-synced, category NOT recoverable) : ${derived.length}`);
  console.log(`  a spread of categories (provenance-native, INTACT)         : ${native.length}\n`);

  for (const r of rows.slice(0, 25)) {
    const tag = derived.includes(r) ? 'derived ' : 'native  ';
    console.log(`  ${tag} ${r.projectId}  ${String(r.answers).padStart(3)} answers  [${r.sections.join(', ')}]`);
  }
  if (rows.length > 25) console.log(`  … and ${rows.length - 25} more`);

  // ── 2. The confirmation ────────────────────────────────────────────────────
  const wanted = process.argv[2];
  const target = wanted
    ? rows.find((r) => r.projectId === wanted)
    // Most distinct categories wins — the clearest demonstration available.
    : [...native].sort((a, b) => b.sections.length - a.sections.length)[0];

  if (!target) {
    console.log(
      wanted
        ? `\nNo provenance answers found for ${wanted}.`
        : '\nNo provenance-native project found to confirm against.',
    );
    await prisma.$disconnect();
    return;
  }

  console.log(`\n═══ LOADER OUTPUT — ${target.projectId} (${target.slug}) ═══\n`);
  const loaded = await loadInterviewAnswers(target.projectId);

  const width = Math.max(...loaded.map((a) => (a.section ?? '').length), 6);
  console.log(`  ${'room'.padEnd(width)}  ${'scope'.padEnd(18)}  questionCategory   answer`);
  console.log(`  ${'-'.repeat(width)}  ${'-'.repeat(18)}  ----------------   ------`);
  for (const a of loaded.slice(0, 30)) {
    console.log(
      `  ${(a.section ?? '').padEnd(width)}  ${String(a.category ?? '—').padEnd(18)}  ` +
      `${String((a as any).questionCategory ?? 'null').padEnd(17)}  ${a.answer.slice(0, 46).replace(/\s+/g, ' ')}…`,
    );
  }
  if (loaded.length > 30) console.log(`  … and ${loaded.length - 30} more`);

  const populated = loaded.filter((a) => (a as any).questionCategory != null);
  const byCat = new Map<string, number>();
  for (const a of populated) {
    const k = String((a as any).questionCategory);
    byCat.set(k, (byCat.get(k) ?? 0) + 1);
  }

  console.log(`\n  questionCategory populated : ${populated.length} / ${loaded.length}`);
  console.log(`  distribution               : ${
    [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join('  ') || '(none)'
  }`);
  const unknown = [...byCat.keys()].filter((k) => !SECTIONS.includes(k));
  console.log(`  values outside SECTION_ENUM: ${unknown.length === 0 ? 'none' : unknown.join(', ')}`);
  console.log(
    populated.length > 0
      ? '\n  ✓ populated with no backfill — the value was in provenance all along.\n'
      : '\n  ✗ nothing populated. Either this project is reverse-synced, or the loader is not reading it.\n',
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('\nreport-question-category failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
