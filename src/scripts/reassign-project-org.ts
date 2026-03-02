/**
 * Reassign a project's designerOrgId to the correct org.
 *
 * Usage:
 *   npx tsx src/scripts/reassign-project-org.ts <slug>
 *
 * Example:
 *   npx tsx src/scripts/reassign-project-org.ts boca-raton-renovation-JEACJX
 *
 * This script:
 * 1. Finds the project by its post slug
 * 2. Looks up the designer's org memberships
 * 3. If the project has no designerOrgId but the designer belongs to a design firm,
 *    it assigns the designerOrgId to that org
 * 4. Dry-run by default — pass --apply to actually update
 */
import { prisma } from '@/lib/prisma';

async function main() {
  const slug = process.argv[2];
  const apply = process.argv.includes('--apply');

  if (!slug) {
    console.error('Usage: npx tsx src/scripts/reassign-project-org.ts <slug> [--apply]');
    process.exit(1);
  }

  console.log(`Searching for project with slug: ${slug}\n`);

  const post = await prisma.projectPost.findFirst({
    where: { slug: { contains: slug, mode: 'insensitive' } },
    select: {
      projectId: true,
      slug: true,
      status: true,
      project: {
        select: {
          id: true,
          title: true,
          ownerId: true,
          designerId: true,
          designerOrgId: true,
          owner: { select: { id: true, name: true, email: true, role: true } },
          designer: { select: { id: true, name: true, email: true, role: true } },
          designerOrg: { select: { id: true, name: true, type: true, status: true } },
        },
      },
    },
  });

  if (!post) {
    console.error('Project not found with that slug');
    process.exit(1);
  }

  const { project } = post;

  console.log('=== Project Details ===');
  console.log(`  Title:          ${project.title}`);
  console.log(`  Project ID:     ${project.id}`);
  console.log(`  Post Slug:      ${post.slug}`);
  console.log(`  Post Status:    ${post.status}`);
  console.log(`  Owner ID:       ${project.ownerId}`);
  console.log(`  Owner:          ${project.owner.name} (${project.owner.email}) [role: ${project.owner.role}]`);
  console.log(`  Designer ID:    ${project.designerId || 'null'}`);
  if (project.designer) {
    console.log(`  Designer:       ${project.designer.name} (${project.designer.email}) [role: ${project.designer.role}]`);
  }
  console.log(`  Designer Org:   ${project.designerOrg ? `${project.designerOrg.name} (${project.designerOrg.id}) [${project.designerOrg.type}, ${project.designerOrg.status}]` : 'null (NOT SET)'}`);

  // Look up the designer/owner's org memberships
  const userId = project.designerId || project.ownerId;
  const memberships = await prisma.organizationUser.findMany({
    where: { userId, isActive: true },
    include: {
      organization: {
        select: { id: true, name: true, type: true, status: true },
      },
    },
  });

  console.log(`\n=== Org Memberships for ${project.designer?.name || project.owner.name} ===`);
  if (memberships.length === 0) {
    console.log('  No org memberships found');
  } else {
    for (const m of memberships) {
      console.log(`  ${m.organization.name} (${m.organization.id})`);
      console.log(`    Type: ${m.organization.type}, Status: ${m.organization.status}, Role: ${m.role}`);
    }
  }

  // Find design firm membership
  const designFirm = memberships.find(m => m.organization.type === 'DESIGN_FIRM');

  if (!designFirm) {
    console.log('\nNo design firm membership found. Cannot reassign.');
    process.exit(0);
  }

  if (project.designerOrgId === designFirm.organizationId) {
    console.log(`\nProject already assigned to ${designFirm.organization.name}. No change needed.`);
    process.exit(0);
  }

  console.log(`\n=== Proposed Change ===`);
  console.log(`  Set designerOrgId: ${project.designerOrgId || 'null'} -> ${designFirm.organizationId}`);
  console.log(`  Org: ${designFirm.organization.name}`);

  if (!apply) {
    console.log('\nDRY RUN — no changes made. Pass --apply to update the database.');
    process.exit(0);
  }

  // Apply the change
  await prisma.project.update({
    where: { id: project.id },
    data: { designerOrgId: designFirm.organizationId },
  });

  console.log('\nDone! Project designerOrgId updated successfully.');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
