/**
 * Backfill designerOrgId on projects that are missing it.
 *
 * Usage:
 *   npx tsx scripts/backfill-designer-org.ts --dry-run   # Preview changes
 *   npx tsx scripts/backfill-designer-org.ts              # Apply changes
 *
 * Logic:
 *   1. Find all projects where designerOrgId IS NULL and designerId IS NOT NULL
 *   2. For each project, look up the designer's DESIGN_FIRM org memberships
 *   3. If exactly 1 membership → assign that org
 *   4. If 0 memberships → skip (log warning)
 *   5. If 2+ memberships → skip (needs manual resolution)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n=== Backfill designerOrgId ${dryRun ? "(DRY RUN)" : "(LIVE)"} ===\n`);

  // Find orphan projects
  const orphanProjects = await prisma.project.findMany({
    where: {
      designerOrgId: null,
      designerId: { not: null },
    },
    select: {
      id: true,
      title: true,
      designerId: true,
    },
  });

  console.log(`Found ${orphanProjects.length} projects with null designerOrgId\n`);

  if (orphanProjects.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // Cache designer → org lookups to avoid repeated queries
  const designerOrgCache = new Map<string, { orgId: string; orgName: string }[] >();

  let updated = 0;
  let skippedNoOrg = 0;
  let skippedMultiOrg = 0;

  for (const project of orphanProjects) {
    const designerId = project.designerId!;

    if (!designerOrgCache.has(designerId)) {
      const memberships = await prisma.organizationUser.findMany({
        where: {
          userId: designerId,
          isActive: true,
          organization: { type: "DESIGN_FIRM" },
        },
        select: {
          organizationId: true,
          organization: { select: { name: true } },
        },
      });
      designerOrgCache.set(
        designerId,
        memberships.map((m) => ({ orgId: m.organizationId, orgName: m.organization.name }))
      );
    }

    const orgs = designerOrgCache.get(designerId)!;

    if (orgs.length === 0) {
      console.log(`  SKIP (no org): "${project.title}" [${project.id}] — designer ${designerId} has no DESIGN_FIRM membership`);
      skippedNoOrg++;
    } else if (orgs.length > 1) {
      console.log(`  SKIP (multi): "${project.title}" [${project.id}] — designer ${designerId} has ${orgs.length} orgs: ${orgs.map((o) => o.orgName).join(", ")}`);
      skippedMultiOrg++;
    } else {
      const { orgId, orgName } = orgs[0];
      console.log(`  ${dryRun ? "WOULD UPDATE" : "UPDATE"}: "${project.title}" [${project.id}] → ${orgName} [${orgId}]`);
      if (!dryRun) {
        await prisma.project.update({
          where: { id: project.id },
          data: { designerOrgId: orgId },
        });
      }
      updated++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  ${dryRun ? "Would update" : "Updated"}: ${updated}`);
  console.log(`  Skipped (no org):    ${skippedNoOrg}`);
  console.log(`  Skipped (multi org): ${skippedMultiOrg}`);
  console.log(`  Total processed:     ${orphanProjects.length}`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
