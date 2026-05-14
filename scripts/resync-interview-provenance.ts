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
  const provenance = (post?.provenance as any) || {};
  const interview = provenance.interview || {};
  const payload = interview.payload || {};
  const provenanceAnswers: any[] = payload.answers || interview.answers || [];
  const selectedQuestionIds: any[] = payload.selectedQuestionIds || interview.selectedQuestionIds || [];

  console.log(`\n=== Project ${projectId} ===`);
  console.log(`  EditorialInterviewAnswer rows: ${ei?.answers.length ?? 0}`);
  console.log(`  provenance.payload.answers   : ${provenanceAnswers.length}`);
  console.log(`  selectedQuestionIds (count)  : ${selectedQuestionIds.length}`);
  if (selectedQuestionIds.length) {
    console.log(`  selectedQuestionIds (first 6): ${selectedQuestionIds.slice(0, 6).join(", ")}`);
  }

  const missingPromptInProvenance = provenanceAnswers.filter((a) => !a.prompt && !a.question && !a.q).length;
  const missingTextInEditorial = (ei?.answers ?? []).filter((a) => !a.questionText).length;
  console.log(`  provenance entries missing prompt: ${missingPromptInProvenance}`);
  console.log(`  editorial entries missing questionText: ${missingTextInEditorial}`);

  if (provenanceAnswers.length) {
    console.log(`\n  Field availability across provenance answers:`);
    const has = (k: string) => provenanceAnswers.filter((a) => a && a[k] !== undefined && a[k] !== "").length;
    for (const k of ["questionId", "id", "prompt", "question", "q", "section", "isFollowUp", "answer", "a", "linkedImageId", "questionSource"]) {
      console.log(`    ${k.padEnd(16)}: ${has(k)}/${provenanceAnswers.length} have it`);
    }

    console.log(`\n  First 3 provenance entries (raw):`);
    for (const [idx, a] of provenanceAnswers.slice(0, 3).entries()) {
      const trimmed: any = {};
      for (const [k, v] of Object.entries(a)) {
        if (typeof v === "string" && v.length > 80) trimmed[k] = v.slice(0, 80) + "…";
        else trimmed[k] = v;
      }
      console.log(`    [${idx}]`, JSON.stringify(trimmed));
    }
  }

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
