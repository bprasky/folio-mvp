/**
 * Revert ownership reassignment.
 *
 * The diagnose-fix-ownership.ts script changed ownerId + designerId on projects
 * that were originally owned by designer@folio.com (or other org users) to bprasky@arcaww.com.
 *
 * This script finds those projects and restores the original owner — which is the
 * designer@folio.com user that originally created them within the BP Design org context.
 *
 * Usage:
 *   npx tsx scripts/revert-ownership.ts --dry-run  # Preview changes only
 *   npx tsx scripts/revert-ownership.ts             # Actually revert
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BP_EMAIL = "bprasky@arcaww.com";
const DESIGNER_EMAIL = "designer@folio.com";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("*** DRY RUN — no changes will be made ***\n");

  // 1. Find both users
  const bpUser = await prisma.user.findFirst({ where: { email: BP_EMAIL } });
  const designerUser = await prisma.user.findFirst({ where: { email: DESIGNER_EMAIL } });

  if (!bpUser) {
    console.error(`User not found: ${BP_EMAIL}`);
    process.exit(1);
  }
  console.log(`BP user: ${bpUser.email} (${bpUser.id})`);

  if (!designerUser) {
    console.error(`User not found: ${DESIGNER_EMAIL}`);
    console.error("Cannot revert — original owner user doesn't exist.");
    process.exit(1);
  }
  console.log(`Designer user: ${designerUser.email} (${designerUser.id})`);

  // 2. Find the BP Design org
  const bpOrgMembership = await prisma.organizationUser.findMany({
    where: { userId: bpUser.id, isActive: true },
    include: { organization: { select: { id: true, name: true, type: true } } },
  });
  console.log(`\nBP org memberships:`);
  for (const m of bpOrgMembership) {
    console.log(`  ${m.organization.name} (${m.organization.id}) | ${m.role} | ${m.organization.type}`);
  }

  // 3. Show current state of ALL projects
  const allProjects = await prisma.project.findMany({
    select: {
      id: true,
      title: true,
      ownerId: true,
      designerId: true,
      designerOrgId: true,
      createdAt: true,
      owner: { select: { email: true } },
      designer: { select: { email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\n=== Current State: ${allProjects.length} projects ===`);
  for (const p of allProjects) {
    console.log(`  ${p.title?.substring(0, 40)?.padEnd(40)} | owner=${p.owner.email.padEnd(25)} | designer=${p.designer?.email || "null"}`);
  }

  // 4. Find projects that were likely reassigned
  // These are projects currently owned by bpUser that were probably created by designerUser
  // We can identify them because the diagnose-fix-ownership.ts script changed ALL non-bpUser
  // projects to bpUser. Projects that Brad legitimately created would have had bpUser as
  // owner from the start.
  //
  // Strategy: Check if designerUser has ProjectParticipant records or if projects have
  // designerOrgId pointing to an org both users share.

  // Check if designerUser is in the same org as bpUser
  const designerOrgMembership = await prisma.organizationUser.findMany({
    where: { userId: designerUser.id, isActive: true },
    include: { organization: { select: { id: true, name: true } } },
  });
  console.log(`\nDesigner org memberships:`);
  for (const m of designerOrgMembership) {
    console.log(`  ${m.organization.name} (${m.organization.id}) | ${m.role}`);
  }

  // Find shared orgs
  const bpOrgIds = new Set(bpOrgMembership.map(m => m.organizationId));
  const sharedOrgs = designerOrgMembership.filter(m => bpOrgIds.has(m.organizationId));

  if (sharedOrgs.length === 0) {
    console.log("\nWARNING: No shared org between BP and Designer users.");
    console.log("Cannot determine which projects to revert. Manual review needed.");
    await prisma.$disconnect();
    return;
  }

  const sharedOrgId = sharedOrgs[0].organizationId;
  console.log(`\nShared org: ${sharedOrgs[0].organization.name} (${sharedOrgId})`);

  // Projects that have designerOrgId = sharedOrg AND currently owned by bpUser
  // but the original intent was likely designerUser ownership
  // Since we can't know for sure, show all projects owned by bpUser and let the user decide
  const bpOwnedProjects = allProjects.filter(p => p.ownerId === bpUser.id);

  console.log(`\n=== Projects currently owned by ${BP_EMAIL}: ${bpOwnedProjects.length} ===`);
  console.log("\nTo revert: set ownerId and designerId back to designerUser for projects");
  console.log("that were originally created by the designer@folio.com account.\n");

  // For safety, only revert projects where designerOrgId matches the shared org
  // (these are the ones that were in the org context)
  const toRevert = bpOwnedProjects.filter(p => p.designerOrgId === sharedOrgId);

  if (toRevert.length === 0) {
    console.log("No projects found to revert (no projects with matching designerOrgId).");
    console.log("\nAll projects owned by BP:");
    for (const p of bpOwnedProjects) {
      console.log(`  ${p.id} | ${p.title?.substring(0, 40)} | designerOrgId=${p.designerOrgId || "null"}`);
    }
    await prisma.$disconnect();
    return;
  }

  console.log(`=== ${dryRun ? "Would revert" : "Reverting"} ${toRevert.length} projects ===`);
  for (const project of toRevert) {
    console.log(`\n  ${project.title?.substring(0, 50)}`);
    console.log(`    ID: ${project.id}`);
    console.log(`    ownerId:    ${project.ownerId} (${project.owner.email}) → ${designerUser.id} (${designerUser.email})`);
    console.log(`    designerId: ${project.designerId} (${project.designer?.email || "null"}) → ${designerUser.id} (${designerUser.email})`);

    if (!dryRun) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          ownerId: designerUser.id,
          designerId: designerUser.id,
        },
      });
      console.log(`    ✓ Reverted`);
    } else {
      console.log(`    (dry run — skipped)`);
    }
  }

  // Verify
  if (!dryRun) {
    console.log(`\n=== Verification ===`);
    const verified = await prisma.project.findMany({
      select: {
        id: true,
        title: true,
        ownerId: true,
        designerId: true,
        owner: { select: { email: true } },
        designer: { select: { email: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    for (const p of verified) {
      console.log(`  ${p.title?.substring(0, 40)?.padEnd(40)} | owner=${p.owner.email.padEnd(25)} | designer=${p.designer?.email || "null"}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
