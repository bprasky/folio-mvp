import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { can, isOrgRole } from '@/lib/orgPermissions';
import { isDeletableStudioType, type StudioDeletionInput, type StudioDeletionReview } from '@/lib/studio-deletion';
import { requestIdentity } from '@/lib/persistence/requestIdentity';
import { assertNoScheduledHistory } from '@/lib/spotlight/deletion';
import { WORKSPACE_IMPORT_KIND } from '@/lib/workspace-import/types';

type Database = Prisma.TransactionClient;
type OptionalStudioTables = {
  orders: boolean;
  subscriptions: boolean;
  boosts: boolean;
  opportunities: boolean;
  photoBoosts: boolean;
  reelBoosts: boolean;
  developments: boolean;
  claims: boolean;
  collaborations: boolean;
  territories: boolean;
};
export class StudioDeletionError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

const importsFor = (orgId: string): Prisma.ImportSessionWhereInput => ({ AND: [
  { processingMeta: { path: ['kind'], equals: WORKSPACE_IMPORT_KIND } },
  { processingMeta: { path: ['orgId'], equals: orgId } },
] });

async function assertApprovedAccount(db: Database, userId: string) {
  const actor = await db.user.findUnique({ where: { id: userId }, select: { accountStatus: true } });
  if (actor?.accountStatus !== 'APPROVED') throw new StudioDeletionError('An active, approved account is required.', 403);
}

async function inspect(db: Database, userId: string, orgId: string) {
  await assertApprovedAccount(db, userId);
  const member = await db.organizationUser.findFirst({ where: { userId, organizationId: orgId, isActive: true }, select: { role: true } });
  if (!member || !isOrgRole(member.role) || !can(member.role, 'delete_studio'))
    throw new StudioDeletionError('Only an active owner or administrator of this studio can delete it.', 403);
  const org = await db.organization.findUnique({ where: { id: orgId }, select: {
    id: true, name: true, type: true, status: true, updatedAt: true,
    users: { select: { id: true, userId: true, role: true, isActive: true }, orderBy: { id: 'asc' } },
    _count: { select: { orgMedia: true, orgRecognition: true, orgCollaborations: true } },
  } });
  if (!org) throw new StudioDeletionError('This studio no longer exists.', 404);
  if (!isDeletableStudioType(org.type)) throw new StudioDeletionError('This deletion flow is for design studios, architecture firms and contractors.', 400);
  if (!['CLAIMED', 'PROFESSIONAL'].includes(org.status))
    throw new StudioDeletionError('Claim this studio before managing its deletion.', 403);

  // Primary designer organization defines ownership. Vendor credits and project
  // participation alone never place another studio's project in the delete set.
  const projects = await db.project.findMany({ where: { designerOrgId: orgId }, orderBy: { id: 'asc' },
    select: { id: true, updatedAt: true, isPublic: true, publishedAt: true, portfolioPublishedAt: true, post: { select: { slug: true } } } });
  const projectIds = projects.map(project => project.id);
  // These optional commerce/partner features are not provisioned everywhere.
  // Inspect the catalog first: catching P2021 after querying a missing table
  // leaves the PostgreSQL transaction aborted. Only absence means no records;
  // missing columns, permissions and failures in present tables still stop us.
  // Core studio, project, import, editorial and Spotlight tables remain required.
  const [tables] = await db.$queryRaw<OptionalStudioTables[]>`
    SELECT to_regclass('public.orders') IS NOT NULL AS orders,
      to_regclass('public.vendor_subscriptions') IS NOT NULL AS subscriptions,
      to_regclass('public.boosts') IS NOT NULL AS boosts,
      to_regclass('public.boost_opportunities') IS NOT NULL AS opportunities,
      to_regclass('public.in_context_boosts') IS NOT NULL AS "photoBoosts",
      to_regclass('public.homepage_reel_boosts') IS NOT NULL AS "reelBoosts",
      to_regclass('public.developments') IS NOT NULL AS developments,
      to_regclass('public.vendor_product_claims') IS NOT NULL AS claims,
      to_regclass('public.collaboration_stories') IS NOT NULL AS collaborations,
      to_regclass('public.org_territory_assignments') IS NOT NULL AS territories`;
  const [imports, scheduled, externalSpotlights, stories, orders, subscriptions, boosts, photoBoosts, reelBoosts, developments, claims, collaborations, live] = await Promise.all([
    db.importSession.findMany({ where: { OR: [importsFor(orgId), { projectId: { in: projectIds } }] }, select: { id: true, status: true, updatedAt: true }, orderBy: { id: 'asc' } }),
    db.spotlightQuestion.count({ where: { spotlight: { projectId: { in: projectIds } } } }),
    db.productSpotlight.count({ where: { publisherOrgId: orgId, projectId: { notIn: projectIds } } }),
    db.editorialStory.count({ where: { OR: [{ organizationId: orgId }, { revisions: { some: { sources: { some: { projectPost: { projectId: { in: projectIds } } } } } } }] } }),
    tables.orders ? db.order.count({ where: { OR: [{ vendorOrgId: orgId }, { projectId: { in: projectIds } }] } }) : 0,
    tables.subscriptions ? db.vendorSubscription.count({ where: { organizationId: orgId, stripeSubscriptionId: { not: null } } }) : 0,
    tables.boosts ? db.boost.count({ where: { OR: [{ vendorId: orgId }, { opportunity: { projectId: { in: projectIds } } }] } }) : 0,
    tables.photoBoosts ? db.inContextBoost.count({ where: { OR: [{ vendorId: orgId }, { productTag: { image: { projectId: { in: projectIds } } } }, { projectPost: { projectId: { in: projectIds } } }] } }) : 0,
    tables.reelBoosts ? db.homepageReelBoost.count({ where: { OR: [{ vendorId: orgId }, { projectPost: { projectId: { in: projectIds } } }] } }) : 0,
    tables.developments ? db.development.count({ where: { developerOrgId: orgId } }) : 0,
    tables.claims ? db.vendorProductClaim.count({ where: { organizationId: orgId } }) : 0,
    tables.collaborations ? db.collaborationStory.count({ where: { OR: [{ vendorOrgId: orgId }, { taggedProjectId: { in: projectIds } }] } }) : 0,
    db.liveInterviewSession.count({ where: { status: { not: 'ended' }, OR: [
      { sourceId: orgId }, { sourceType: { in: ['project', 'project_guide'] }, sourceId: { in: projectIds } },
    ] } }),
  ]);
  const blockers: string[] = [];
  if (live) blockers.push('An interview is still open or finishing. End it before deleting the studio.');
  if (scheduled || externalSpotlights) blockers.push('This studio has protected Spotlight records. Contact Folio to arrange their removal before deleting the studio.');
  if (stories) blockers.push('Publishing Studio stories use this studio or its projects. Contact Folio to review these stories before deletion.');
  if (orders || subscriptions || boosts || photoBoosts || reelBoosts) blockers.push('Billing, order or promotion records need to be resolved with Folio before this studio can be deleted.');
  if (developments || claims || collaborations) blockers.push('This studio has shared developments, product claims or collaboration stories. Contact Folio to resolve them before deletion.');
  const counts = { projects: projects.length, publishedProjects: projects.filter(p => p.isPublic || p.publishedAt || p.portfolioPublishedAt).length,
    members: org.users.length, profileItems: org._count.orgMedia + org._count.orgRecognition + org._count.orgCollaborations,
    activeImports: imports.filter(run => run.status === 'PROCESSING').length };
  // Confirmation covers the entire studio, including work arriving from imports.
  // Bind it to the studio/access and protected dependencies, not moving progress
  // or project counts. Deletion locks the studio and rechecks every blocker below.
  const version = createHash('sha256').update(JSON.stringify({ org, blockers, tables })).digest('hex');
  const review: StudioDeletionReview = { id: org.id, name: org.name, version, counts, blockers };
  return { review, projects, imports, tables };
}

export async function reviewStudioDeletion(userId: string, orgId: string) {
  return prisma.$transaction(async tx => (await inspect(tx, userId, orgId)).review,
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
}

export async function deleteStudio(userId: string, orgId: string, input: StudioDeletionInput) {
  const receiptId = requestIdentity('studio-deleted', [userId, orgId, input.version]);
  return prisma.$transaction(async tx => {
    await assertApprovedAccount(tx, userId);
    // A committed receipt makes retry after a lost response safe, including after
    // the membership itself has been removed. It is scoped to this actor/review.
    const prior = await tx.notification.findFirst({ where: { id: receiptId, userId, type: 'STUDIO_DELETED' }, select: { metadata: true } });
    if (prior) return { deleted: true as const, orgId, replayed: true, paths: [] as string[] };

    // Lock the studio before inspecting its dependent records. New FK-backed
    // records and workspace-import starts wait here; READ COMMITTED then sees
    // work that committed while this request was waiting for the lock.
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM organization_users WHERE "organizationId" = ${orgId} AND "userId" = ${userId} FOR UPDATE`;
    // The personal account survives. Block status changes while allowing
    // existing collaborators to finish inserting records that reference it.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR NO KEY UPDATE`;
    if (await tx.notification.findFirst({ where: { id: receiptId, userId, type: 'STUDIO_DELETED' }, select: { id: true } }))
      return { deleted: true as const, orgId, replayed: true, paths: [] as string[] };
    const before = await inspect(tx, userId, orgId);
    if (input.acknowledged !== true || input.confirmation !== before.review.name)
      throw new StudioDeletionError('Type the studio name exactly and confirm that you understand what will be removed.', 400);
    if (input.version !== before.review.version) throw new StudioDeletionError('The studio changed since you reviewed it. Review deletion again before confirming.');
    if (before.review.blockers.length) throw new StudioDeletionError(before.review.blockers.join(' '));

    // Keep the same project lock order as Spotlight's scheduler/deletion guard.
    for (const project of before.projects) await assertNoScheduledHistory(tx, project.id);
    const projectIds = before.projects.map(project => project.id);
    if (projectIds.length) {
      // Promotions attach below the project FK and cascade through these
      // parents. Lock them before the final review to protect concurrent bids.
      await tx.$queryRaw(Prisma.sql`SELECT id FROM project_posts WHERE "projectId" IN (${Prisma.join(projectIds)}) ORDER BY id FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM project_images WHERE "projectId" IN (${Prisma.join(projectIds)}) ORDER BY id FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT tag.id FROM product_tags AS tag JOIN project_images AS image ON image.id = tag."imageId" WHERE image."projectId" IN (${Prisma.join(projectIds)}) ORDER BY tag.id FOR UPDATE OF tag`);
      if (before.tables.opportunities)
        await tx.$queryRaw(Prisma.sql`SELECT id FROM boost_opportunities WHERE "projectId" IN (${Prisma.join(projectIds)}) ORDER BY id FOR UPDATE`);
    }
    if (before.tables.opportunities)
      await tx.$queryRaw`SELECT id FROM boost_opportunities WHERE "vendorId" = ${orgId} ORDER BY id FOR UPDATE`;
    const current = await inspect(tx, userId, orgId);
    if (current.review.version !== input.version || current.review.blockers.length)
      throw new StudioDeletionError('The studio changed while deletion was being confirmed. Review it again.');
    const ids = current.projects.map(project => project.id);

    // Removing the durable run cancels queued/leased imports: worker checkpoints
    // use update/CAS, never upsert. A worker already fetching cannot recreate the
    // studio/projects after commit (membership checks and parent FKs reject it).
    // Keep cancellation in this transaction so any deletion failure restores it.
    const importIds = current.imports.map(run => run.id);
    await tx.importSession.deleteMany({ where: { id: { in: importIds } } });
    if (importIds.length) await tx.notification.deleteMany({ where: {
      type: 'WORKSPACE_IMPORT_READY', OR: importIds.map(id => ({ metadata: { path: ['importId'], equals: id } })),
    } });
    // Other studios' imports, personal bios, users and projects are never selected.
    await tx.studioCandidate.deleteMany({ where: { organizationId: orgId } });
    await tx.profileFieldSource.deleteMany({ where: { organizationId: orgId } });
    if (current.tables.territories)
      await tx.orgTerritoryAssignment.deleteMany({ where: { OR: [{ vendorOrgId: orgId }, { designerOrgId: orgId }] } });
    if (current.tables.opportunities)
      await tx.boostOpportunity.deleteMany({ where: { vendorId: orgId } });
    await tx.user.updateMany({ where: { operatingAsOrgId: orgId }, data: { operatingAsOrgId: null } });
    await tx.project.deleteMany({ where: { id: { in: ids }, designerOrgId: orgId } });
    // Database cascades remove studio membership, invitations, profile content
    // and interview details; optional external credits are detached by their FKs.
    // Any unknown restrictive relationship rolls this entire transaction back.
    await tx.organization.delete({ where: { id: orgId } });
    await tx.notification.create({ data: { id: receiptId, userId, type: 'STUDIO_DELETED', title: 'Studio deleted',
      body: `${current.review.name} and its ${ids.length} studio projects were deleted. Your personal account remains active.`,
      actionUrl: '/settings', metadata: { organizationId: orgId, organizationName: current.review.name,
        actorId: userId, version: input.version, counts: current.review.counts, deletedAt: new Date().toISOString() } } });
    const paths = current.projects.flatMap(project => [`/project/${project.id}`, `/projects/${project.id}`,
      ...(project.post?.slug ? [`/p/${project.post.slug}`, `/p/${project.post.slug}/feature`] : [])]);
    return { deleted: true as const, orgId, replayed: false, paths };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 30000 });
}
