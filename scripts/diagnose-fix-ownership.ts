/**
 * Diagnose and fix project ownership fields.
 *
 * Usage:
 *   npx tsx scripts/diagnose-fix-ownership.ts           # Fix mismatched projects
 *   npx tsx scripts/diagnose-fix-ownership.ts --dry-run  # Preview changes only
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BP_EMAIL = "bprasky@arcaww.com";
const BOCA_RATON_ID = "be3e09b9-ae2e-4842-9847-3a0b55b2e0f6";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("*** DRY RUN — no changes will be made ***\n");

  // Step 1: Find BP Design user
  const bpUser = await prisma.user.findFirst({ where: { email: BP_EMAIL } });
  if (!bpUser) {
    console.error(`User not found: ${BP_EMAIL}`);
    process.exit(1);
  }
  console.log(`=== BP Design User ===`);
  console.log(`  ID:    ${bpUser.id}`);
  console.log(`  Email: ${bpUser.email}`);
  console.log(`  Name:  ${bpUser.name}`);

  // Step 2: Query the specific Boca Raton project
  const bocaProject = await prisma.project.findUnique({
    where: { id: BOCA_RATON_ID },
    select: {
      id: true,
      title: true,
      ownerId: true,
      designerId: true,
      designerOrgId: true,
      owner: { select: { email: true } },
      designer: { select: { email: true } },
    },
  });

  console.log(`\n=== Boca Raton Project ===`);
  if (bocaProject) {
    console.log(`  Title:      ${bocaProject.title}`);
    console.log(`  ownerId:    ${bocaProject.ownerId} (${bocaProject.owner.email})`);
    console.log(`  designerId: ${bocaProject.designerId} (${bocaProject.designer?.email || "null"})`);
    console.log(`  designerOrgId: ${bocaProject.designerOrgId}`);
    const ownerMatch = bocaProject.ownerId === bpUser.id;
    const designerMatch = bocaProject.designerId === bpUser.id;
    console.log(`  ownerId matches BP?    ${ownerMatch ? "YES" : "NO ← MISMATCH"}`);
    console.log(`  designerId matches BP? ${designerMatch ? "YES" : "NO ← MISMATCH"}`);
  } else {
    console.log(`  Project not found!`);
  }

  // Step 3: Find ALL mismatched projects
  const allProjects = await prisma.project.findMany({
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

  const mismatched = allProjects.filter(
    (p) => p.ownerId !== bpUser.id || p.designerId !== bpUser.id
  );

  console.log(`\n=== All Projects: ${allProjects.length} total, ${mismatched.length} mismatched ===`);

  if (mismatched.length === 0) {
    console.log("  All projects already have correct ownership. Nothing to fix.");
    await prisma.$disconnect();
    return;
  }

  // Step 4: Fix mismatched projects
  console.log(`\n=== ${dryRun ? "Would update" : "Updating"} ${mismatched.length} projects ===`);
  for (const project of mismatched) {
    const ownerMismatch = project.ownerId !== bpUser.id;
    const designerMismatch = project.designerId !== bpUser.id;

    console.log(`\n  ${project.title?.substring(0, 50)}`);
    console.log(`    ID: ${project.id}`);
    if (ownerMismatch) {
      console.log(`    ownerId:    ${project.ownerId} (${project.owner.email}) → ${bpUser.id} (${bpUser.email})`);
    }
    if (designerMismatch) {
      console.log(`    designerId: ${project.designerId || "null"} (${project.designer?.email || "null"}) → ${bpUser.id} (${bpUser.email})`);
    }

    if (!dryRun) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          ownerId: bpUser.id,
          designerId: bpUser.id,
        },
      });
      console.log(`    ✓ Updated`);
    } else {
      console.log(`    (dry run — skipped)`);
    }
  }

  // Step 5: Verify
  if (!dryRun) {
    console.log(`\n=== Verification ===`);
    const verified = await prisma.project.findMany({
      select: {
        id: true,
        title: true,
        ownerId: true,
        designerId: true,
        owner: { select: { email: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const stillMismatched = verified.filter(
      (p) => p.ownerId !== bpUser.id || p.designerId !== bpUser.id
    );

    for (const p of verified) {
      const ok = p.ownerId === bpUser.id && p.designerId === bpUser.id;
      console.log(`  ${ok ? "✓" : "✗"} ${p.title?.substring(0, 40)?.padEnd(40)} owner=${p.owner.email}`);
    }

    if (stillMismatched.length === 0) {
      console.log(`\n✓ All ${verified.length} projects now have correct ownership.`);
    } else {
      console.log(`\n✗ ${stillMismatched.length} projects still mismatched!`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
