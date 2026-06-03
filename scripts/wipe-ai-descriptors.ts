/**
 * Wipe AI "descriptor" selections from a project.
 *
 * Background: the analyze-images route used to auto-create Selection records
 * (source = "ai_analysis") plus their backing ProductTag for every product the
 * vision model guessed. Boards now shows real, designer-tagged selections only,
 * so those AI guesses are dead data. This removes them for one project.
 *
 * It deletes ONLY selections with source = "ai_analysis" and the ProductTags
 * they created. Real selections (upload, auto_tag, presentation, etc.) and any
 * tags not created by the AI pass are left untouched. Products are shared and
 * are never deleted.
 *
 * Dry-run by default — prints what it WOULD delete. Pass --apply to execute.
 *
 * Usage:
 *   npx tsx scripts/wipe-ai-descriptors.ts                       # dry-run, La Gorce
 *   npx tsx scripts/wipe-ai-descriptors.ts --apply               # execute, La Gorce
 *   npx tsx scripts/wipe-ai-descriptors.ts --title="My Project"  # different title
 *   npx tsx scripts/wipe-ai-descriptors.ts --project=<id> --apply
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const AI_SOURCE = "ai_analysis";

function getArg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const projectId = getArg("project");
  const title = getArg("title") ?? "La Gorce";

  const projects = projectId
    ? await prisma.project.findMany({ where: { id: projectId }, select: { id: true, title: true } })
    : await prisma.project.findMany({
        where: { title: { contains: title, mode: "insensitive" } },
        select: { id: true, title: true },
      });

  if (projects.length === 0) {
    console.error(`No project found (${projectId ? `id=${projectId}` : `title~="${title}"`}).`);
    process.exit(1);
  }
  if (projects.length > 1 && !projectId) {
    console.error(`Ambiguous — ${projects.length} projects match title~="${title}":`);
    projects.forEach((p) => console.error(`  ${p.id}  ${p.title}`));
    console.error(`Re-run with --project=<id>.`);
    process.exit(1);
  }

  const project = projects[0];
  console.log(`Project: ${project.title} (${project.id})`);
  console.log(`Mode:    ${apply ? "APPLY (will delete)" : "DRY RUN (no writes)"}\n`);

  const aiSelections = await prisma.selection.findMany({
    where: { projectId: project.id, source: AI_SOURCE },
    select: { id: true, productTagId: true },
  });
  const tagIds = aiSelections.map((s) => s.productTagId).filter((id): id is string => Boolean(id));

  const totalSelections = await prisma.selection.count({ where: { projectId: project.id } });

  console.log(`AI descriptor selections (source="${AI_SOURCE}"): ${aiSelections.length}`);
  console.log(`Backing ProductTags to remove:                    ${tagIds.length}`);
  console.log(`Total selections on project (before):             ${totalSelections}`);
  console.log(`Total selections on project (after):              ${totalSelections - aiSelections.length}\n`);

  if (!apply) {
    console.log("Dry run complete. Re-run with --apply to delete.");
    return;
  }

  // Delete selections first (clears the FK reference), then the orphaned tags.
  const delSel = await prisma.selection.deleteMany({
    where: { projectId: project.id, source: AI_SOURCE },
  });
  const delTags = tagIds.length
    ? await prisma.productTag.deleteMany({ where: { id: { in: tagIds } } })
    : { count: 0 };

  console.log(`Deleted ${delSel.count} selection(s) and ${delTags.count} product tag(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
