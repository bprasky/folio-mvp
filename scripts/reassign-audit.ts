import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Find orgs for bprasky@arcaww.com
  const bpUser = await prisma.user.findFirst({
    where: { email: "bprasky@arcaww.com" },
    select: { id: true, email: true, name: true },
  });
  console.log("\n=== BP User ===");
  console.log(bpUser);

  const orgMemberships = await prisma.organizationUser.findMany({
    where: { userId: bpUser!.id },
    include: { organization: { select: { id: true, name: true, type: true } } },
  });
  console.log("\n=== BP Org Memberships ===");
  for (const m of orgMemberships) {
    console.log(`  Org: ${m.organization.name} (${m.organization.id}) | Role: ${m.role} | Type: ${m.organization.type}`);
  }

  // 2. Find designer@folio.com user
  const designerUser = await prisma.user.findFirst({
    where: { email: "designer@folio.com" },
    select: { id: true, email: true, name: true },
  });
  console.log("\n=== Designer User ===");
  console.log(designerUser);

  if (designerUser) {
    const designerOrgMemberships = await prisma.organizationUser.findMany({
      where: { userId: designerUser.id },
      include: { organization: { select: { id: true, name: true, type: true } } },
    });
    console.log("\n=== Designer Org Memberships ===");
    for (const m of designerOrgMemberships) {
      console.log(`  Org: ${m.organization.name} (${m.organization.id}) | Role: ${m.role} | Type: ${m.organization.type}`);
    }
  }

  // 3. All projects with ownership info
  const allProjects = await prisma.project.findMany({
    select: {
      id: true,
      title: true,
      ownerId: true,
      designerId: true,
      designerOrgId: true,
      status: true,
      isPublic: true,
      publishedAt: true,
      owner: { select: { email: true } },
      designerOrg: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("\n=== All Projects ===");
  console.log("ID | Title | Owner Email | DesignerOrgId | DesignerOrg | Status | Public");
  console.log("-".repeat(120));
  for (const p of allProjects) {
    console.log(
      `${p.id} | ${p.title?.substring(0, 30)?.padEnd(30)} | ${p.owner.email.padEnd(25)} | ${(p.designerOrgId || "null").padEnd(38)} | ${(p.designerOrg?.name || "null").padEnd(15)} | ${String(p.status).padEnd(10)} | ${p.isPublic}`
    );
  }

  // 4. ProjectParticipant records
  const participants = await prisma.projectParticipant.findMany({
    where: {
      projectId: { in: allProjects.map((p) => p.id) },
    },
    select: {
      id: true,
      projectId: true,
      userId: true,
      orgId: true,
      role: true,
      side: true,
      user: { select: { email: true } },
    },
  });

  console.log("\n=== Project Participants ===");
  console.log("ParticipantID | ProjectID | UserEmail | OrgId | Role | Side");
  console.log("-".repeat(120));
  for (const pp of participants) {
    console.log(
      `${pp.id} | ${pp.projectId} | ${(pp.user?.email || "null").padEnd(25)} | ${(pp.orgId || "null").padEnd(38)} | ${pp.role.padEnd(8)} | ${pp.side}`
    );
  }

  // 5. ProjectPost statuses
  const posts = await prisma.projectPost.findMany({
    where: {
      projectId: { in: allProjects.map((p) => p.id) },
    },
    select: {
      id: true,
      projectId: true,
      status: true,
      publishedAt: true,
    },
  });

  console.log("\n=== Project Posts ===");
  console.log("PostID | ProjectID | Status | PublishedAt");
  console.log("-".repeat(100));
  for (const post of posts) {
    console.log(`${post.id} | ${post.projectId} | ${post.status} | ${post.publishedAt}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
