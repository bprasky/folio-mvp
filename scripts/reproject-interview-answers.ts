/**
 * Re-project every project's stored interview answers into
 * EditorialInterviewAnswer — the queryable table cross-project insight reads.
 *
 * Usage:
 *   npx tsx scripts/reproject-interview-answers.ts --dry-run   # Preview
 *   npx tsx scripts/reproject-interview-answers.ts             # Apply
 *   npx tsx scripts/reproject-interview-answers.ts --project <id>
 *
 * Why this exists:
 *   The projection was written by two different code paths with two different
 *   row shapes, and the richer one only ran when an incoming answer happened to
 *   carry certain fields. So the table is under-populated in two ways: whole
 *   interviews can be missing, and rows that exist can be missing their room,
 *   source and question text. Provenance (ProjectPost.provenance.interview) is
 *   canonical and was never affected, so it can be replayed.
 *
 * What it CAN'T recover:
 *   Question text, product/image linkage and classified attributes for answers
 *   saved before those were persisted at all — they aren't in provenance either.
 *   Those rows come back with what provenance has (answer, room, source) and
 *   nulls elsewhere. Everything saved from now on carries the full record.
 *
 * Safe to re-run: the rebuild is idempotent and preserves each answer's original
 * createdAt.
 */
import { PrismaClient } from "@prisma/client";
import { syncAnswersToEditorialInterview } from "../src/lib/editorial/syncInterviewAnswers";

const prisma = new PrismaClient();

const dryRun = process.argv.includes("--dry-run");
const projectArgIndex = process.argv.indexOf("--project");
const onlyProjectId = projectArgIndex >= 0 ? process.argv[projectArgIndex + 1] : null;

function answerCountIn(provenance: unknown): number {
  const payload = (provenance as any)?.interview?.payload;
  const answers = Array.isArray(payload?.answers) ? payload.answers.length : 0;
  const followups = Array.isArray(payload?.followups) ? payload.followups.length : 0;
  return answers + followups;
}

async function main() {
  console.log(`\n=== Re-project interview answers ${dryRun ? "(DRY RUN)" : "(LIVE)"} ===\n`);

  const posts = await prisma.projectPost.findMany({
    where: onlyProjectId ? { projectId: onlyProjectId } : {},
    select: { projectId: true, provenance: true },
  });

  let scanned = 0;
  let repaired = 0;
  let unchanged = 0;
  let totalRows = 0;

  for (const post of posts) {
    const stored = answerCountIn(post.provenance);
    if (stored === 0) continue;
    scanned++;

    const projected = await prisma.editorialInterviewAnswer.count({
      where: { interview: { projectId: post.projectId } },
    });
    const missingText = await prisma.editorialInterviewAnswer.count({
      where: { interview: { projectId: post.projectId }, questionText: null },
    });

    const needsWork = projected !== stored || missingText > 0;
    if (!needsWork) {
      unchanged++;
      totalRows += projected;
      continue;
    }

    console.log(
      `${post.projectId}: provenance=${stored} projected=${projected} missingQuestionText=${missingText}`,
    );

    if (dryRun) {
      repaired++;
      continue;
    }

    const result = await syncAnswersToEditorialInterview(post.projectId);
    console.log(`  → rebuilt ${result.answersCreated} rows`);
    repaired++;
    totalRows += result.answersCreated;
  }

  console.log(
    `\nProjects with answers: ${scanned} · ${dryRun ? "would rebuild" : "rebuilt"}: ${repaired} · already consistent: ${unchanged}`,
  );
  console.log(`Answer rows in projection: ${totalRows}\n`);
}

main()
  .catch((err) => {
    console.error("[reproject-interview-answers] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
