/**
 * Re-sync interview answers from EditorialInterviewAnswer to ProjectPost.provenance.
 *
 * When provenance.payload.answers loses question text (e.g. an old Save path
 * posted empty `question` fields), this script rebuilds provenance from the
 * source-of-truth EditorialInterviewAnswer rows.
 *
 * Usage:
 *   npx tsx scripts/resync-interview-provenance.ts <projectId>          # one project
 *   npx tsx scripts/resync-interview-provenance.ts --all                # every project with an EditorialInterview row
 *   npx tsx scripts/resync-interview-provenance.ts <projectId> --dry-run
 */
import { PrismaClient } from "@prisma/client";
import { syncEditorialAnswersToProvenance } from "../src/lib/editorial/syncEditorialAnswersToProvenance";

const prisma = new PrismaClient();

async function inspect(projectId: string) {
  const ei = await prisma.editorialInterview.findUnique({
    where: { projectId },
    include: { answers: { orderBy: { createdAt: "asc" } } },
  });
  const post = await prisma.projectPost.findUnique({
    where: { projectId },
    select: { provenance: true },
  });
  const payload = ((post?.provenance as any)?.interview?.payload) || {};
  const provenanceAnswers: any[] = payload.answers || [];

  console.log(`\n=== Project ${projectId} ===`);
  console.log(`  EditorialInterviewAnswer rows: ${ei?.answers.length ?? 0}`);
  console.log(`  provenance.payload.answers   : ${provenanceAnswers.length}`);

  const missingPromptInProvenance = provenanceAnswers.filter((a) => !a.prompt).length;
  const missingTextInEditorial = (ei?.answers ?? []).filter((a) => !a.questionText).length;
  console.log(`  provenance entries missing prompt: ${missingPromptInProvenance}`);
  console.log(`  editorial entries missing questionText: ${missingTextInEditorial}`);

  return { ei, missingPromptInProvenance };
}

async function resyncOne(projectId: string, dryRun: boolean) {
  const { ei, missingPromptInProvenance } = await inspect(projectId);
  if (!ei || ei.answers.length === 0) {
    console.log("  skip — no EditorialInterviewAnswer rows to sync from");
    return;
  }
  if (dryRun) {
    console.log("  DRY-RUN — would call syncEditorialAnswersToProvenance");
    return;
  }
  console.log(`  re-syncing… (will repair ${missingPromptInProvenance} provenance entries)`);
  const result = await syncEditorialAnswersToProvenance(projectId);
  console.log(`  done — baseAnswers=${result.answers.length}, followups=${result.followups.length}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const all = args.includes("--all");
  const projectId = args.find((a) => !a.startsWith("--"));

  if (!all && !projectId) {
    console.error("Usage: tsx scripts/resync-interview-provenance.ts <projectId> [--dry-run]");
    console.error("       tsx scripts/resync-interview-provenance.ts --all [--dry-run]");
    process.exit(1);
  }

  if (all) {
    const interviews = await prisma.editorialInterview.findMany({
      select: { projectId: true },
    });
    console.log(`Found ${interviews.length} projects with EditorialInterview rows`);
    for (const { projectId: pid } of interviews) {
      await resyncOne(pid, dryRun);
    }
  } else {
    await resyncOne(projectId!, dryRun);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
