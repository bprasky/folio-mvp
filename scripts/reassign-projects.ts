/**
 * Reassign all projects to BP Design org.
 *
 * Usage:
 *   npx tsx scripts/reassign-audit.ts          # Run audit first, get the org ID
 *   npx tsx scripts/reassign-projects.ts <ORG_ID>  # Then run this with the org ID
 *
 * What this does:
 *   1. Sets designerOrgId on all projects to the BP Design org
 *   2. Sets ownerId on all projects to bprasky@arcaww.com (required non-null field)
 *   3. Updates ProjectParticipant records for org-level ownership
 *   4. Unpublishes all projects (sets to DRAFT, clears publishedAt)
 *   5. Verifies the result
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BP_EMAIL = "bprasky@arcaww.com";
const DESIGNER_EMAIL = "designer@folio.com";

async function main() {
  const orgId = process.argv[2];
  if (!orgId) {
    console.error("Usage: npx tsx scripts/reassign-projects.ts <BP_DESIGN_ORG_ID>");
    console.error("\nRun scripts/reassign-audit.ts first to find the org ID.");
    process.exit(1);
  }

  // Validate org exists
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    console.error(`Organization not found: ${orgId}`);
    process.exit(1);
  }
  console.log(`\nTarget org: ${org.name} (${org.id})`);

  // Find BP user (will be the ownerId since schema requires it)
  const bpUser = await prisma.user.findFirst({ where: { email: BP_EMAIL } });
  if (!bpUser) {
    console.error(`User not found: ${BP_EMAIL}`);
    process.exit(1);
  }
  console.log(`BP user: ${bpUser.email} (${bpUser.id})`);

  // Find designer user (source of some projects)
  const designerUser = await prisma.user.findFirst({ where: { email: DESIGNER_EMAIL } });
  console.log(`Designer user: ${designerUser?.email || "not found"} (${designerUser?.id || "n/a"})`);

  // Get all projects
  const allProjects = await prisma.project.findMany({
    select: {
      id: true,
      title: true,
      ownerId: true,
      designerOrgId: true,
      designerId: true,
    },
  });

  console.log(`\nFound ${allProjects.length} projects to reassign.\n`);

  // === REASSIGN PROJECTS ===
  console.log("=== Step 1: Reassigning projects ===");
  for (const project of allProjects) {
    const before = {
      ownerId: project.ownerId,
      designerOrgId: project.designerOrgId,
      designerId: project.designerId,
    };

    await prisma.project.update({
      where: { id: project.id },
      data: {
        ownerId: bpUser.id,
        designerOrgId: orgId,
        designerId: bpUser.id,
      },
    });

    console.log(`  [OK] ${project.title?.substring(0, 40)}`);
    console.log(`        ownerId: ${before.ownerId} → ${bpUser.id}`);
    console.log(`        designerOrgId: ${before.designerOrgId || "null"} → ${orgId}`);
    console.log(`        designerId: ${before.designerId || "null"} → ${bpUser.id}`);
  }

  // === UPDATE PARTICIPANTS ===
  console.log("\n=== Step 2: Updating ProjectParticipant records ===");
  const projectIds = allProjects.map((p) => p.id);

  // Delete old participant records for the designer@folio.com user on these projects
  if (designerUser) {
    const deleted = await prisma.projectParticipant.deleteMany({
      where: {
        projectId: { in: projectIds },
        userId: designerUser.id,
      },
    });
    console.log(`  Removed ${deleted.count} participant records for ${DESIGNER_EMAIL}`);
  }

  // For each project, ensure there's a participant record with org-level ownership
  for (const project of allProjects) {
    // Check if bpUser already has a participant record
    const existing = await prisma.projectParticipant.findFirst({
      where: {
        projectId: project.id,
        userId: bpUser.id,
      },
    });

    if (existing) {
      // Update to include org and ensure OWNER role
      await prisma.projectParticipant.update({
        where: { id: existing.id },
        data: {
          orgId: orgId,
          role: "OWNER",
          side: "DESIGNER",
        },
      });
      console.log(`  [UPDATED] Participant for ${project.title?.substring(0, 40)} → org + OWNER`);
    } else {
      // Create new participant record
      await prisma.projectParticipant.create({
        data: {
          projectId: project.id,
          userId: bpUser.id,
          orgId: orgId,
          role: "OWNER",
          side: "DESIGNER",
        },
      });
      console.log(`  [CREATED] Participant for ${project.title?.substring(0, 40)} → org + OWNER`);
    }
  }

  // === UNPUBLISH ===
  console.log("\n=== Step 3: Unpublishing all projects ===");
  for (const project of allProjects) {
    // Unpublish project
    await prisma.project.update({
      where: { id: project.id },
      data: {
        isPublic: false,
        publishedAt: null,
        status: "draft",
      },
    });

    // Unpublish all posts for this project
    const updatedPosts = await prisma.projectPost.updateMany({
      where: { projectId: project.id },
      data: {
        status: "DRAFT",
        publishedAt: null,
      },
    });

    console.log(`  [OK] ${project.title?.substring(0, 40)} → draft (${updatedPosts.count} posts unpublished)`);
  }

  // === VERIFY ===
  console.log("\n=== Step 4: Verification ===");
  const verified = await prisma.project.findMany({
    select: {
      id: true,
      title: true,
      ownerId: true,
      designerOrgId: true,
      designerId: true,
      status: true,
      isPublic: true,
      owner: { select: { email: true } },
      designerOrg: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("\nTitle | Owner | Org | Status | Public");
  console.log("-".repeat(100));
  for (const p of verified) {
    console.log(
      `${p.title?.substring(0, 30)?.padEnd(30)} | ${p.owner.email.padEnd(25)} | ${(p.designerOrg?.name || "null").padEnd(15)} | ${String(p.status).padEnd(10)} | ${p.isPublic}`
    );
  }

  const allCorrect = verified.every(
    (p) =>
      p.ownerId === bpUser.id &&
      p.designerOrgId === orgId &&
      p.status === "draft" &&
      p.isPublic === false
  );

  if (allCorrect) {
    console.log("\n✓ All projects successfully reassigned to BP Design org and unpublished!");
  } else {
    console.log("\n✗ Some projects may not have been updated correctly. Review the table above.");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
