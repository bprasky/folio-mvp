import 'server-only';
import { prisma } from '@/lib/prisma';
import type { StudioData } from './types';
import { buildStudioFeed } from './feed';

export class StudioAccessError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

/** Resolve fresh workspace identity; a stale operating-as selection fails closed. */
export async function resolvePublishingStudioContext(userId: string): Promise<StudioData['workspace'] & { canWriteCampaigns: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId }, select: { operatingAsOrgId: true },
  });
  if (!user) throw new StudioAccessError('Unauthorized', 401);
  const orgId = user.operatingAsOrgId;
  if (orgId) {
    const membership = await prisma.organizationUser.findFirst({
      where: { userId, organizationId: orgId, isActive: true },
      select: { role: true, organization: { select: { name: true } } },
    });
    if (!membership) throw new StudioAccessError('Workspace access is no longer available', 403);
    return { id: orgId, name: membership.organization.name, canWriteCampaigns: ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'].includes(membership.role) };
  }
  return { id: null, name: 'Your studio', canWriteCampaigns: false };
}

/** Author workspace: drafts are deliberately visible; no public visibility filters. */
export async function getStudioData(userId: string, projectId?: string): Promise<StudioData> {
  const workspace = await resolvePublishingStudioContext(userId);
  const orgId = workspace.id;

  // Keep the full authorized project set for validating cross-project evidence,
  // even when the UI has selected one project.
  const rows = await prisma.project.findMany({
    where: orgId ? { designerOrgId: orgId } : {
      designerOrgId: null, OR: [{ ownerId: userId }, { designerId: userId }],
    },
    select: {
      id: true, title: true, ownerId: true, designerId: true, isPublic: true,
      designer: { select: { name: true } },
      post: { select: { id: true, status: true, slug: true, variant: true, updatedAt: true, excerpt: true, heroAssetId: true, expandedBlocks: true } },
      rooms: { select: { id: true, name: true }, orderBy: { id: 'asc' }, take: 30 },
      images: { select: { id: true, url: true, room: true, roomId: true, inclusion: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }], take: 100 },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 501,
  });
  const authorized = rows.slice(0, 500);
  const authorizedIds = new Set(authorized.map(p => p.id));
  if (projectId && !authorizedIds.has(projectId)) {
    throw new StudioAccessError('Project is not available in this workspace', 404);
  }
  const scoped = authorized.filter(p => !projectId || p.id === projectId);
  const ids = scoped.map(p => p.id);
  const titles = new Map(authorized.map(p => [p.id, p.title || 'Untitled project']));
  const [ideaRows, campaignRows, exportRows] = await Promise.all([
    prisma.editorialQueueItem.findMany({
      where: { designerId: userId, angle: { designerId: userId, organizationId: orgId },
        status: { in: ['recommended', 'in_progress', 'dismissed', 'completed', 'scheduled', 'published'] } },
      select: { id: true, format: true, status: true, createdAt: true, prompts: true,
        angle: { select: { summary: true, evidence: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 101,
    }),
    prisma.instagramCampaign.findMany({
      where: { projectId: { in: ids } },
      select: { id: true, projectId: true, preset: true, totalPosts: true, createdAt: true,
        _count: { select: { posts: true } },
        posts: { select: { id: true, title: true, caption: true, sequenceNum: true, createdAt: true, imageIds: true },
          orderBy: [{ sequenceNum: 'asc' }, { id: 'asc' }], take: 100 } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 101,
    }),
    prisma.instagramExport.findMany({
      where: { projectId: { in: ids }, designerId: userId },
      select: { id: true, projectId: true, headline: true, caption: true, status: true, updatedAt: true, config: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 501,
    }),
  ]);

  const ideas: StudioData['ideas'] = [];
  for (const item of ideaRows.slice(0, 100)) {
    const evidence = object(item.angle.evidence);
    // Malformed or stale source references fail closed, never silently disappear.
    if (evidence.projectIds !== undefined && !Array.isArray(evidence.projectIds)) continue;
    const projectIds = evidence.projectIds === undefined ? [] : evidence.projectIds as unknown[];
    if (!projectIds.every((id): id is string => typeof id === 'string' && authorizedIds.has(id))) continue;
    if (orgId && projectIds.length === 0) continue;
    if (projectId && !projectIds.includes(projectId)) continue;
    const structure = object(item.prompts);
    const prompts: StudioData['ideas'][number]['prompts'] = [];
    if (Array.isArray(structure.items)) for (const value of structure.items) {
      const prompt = object(value);
      if (typeof prompt.id !== 'string' || typeof prompt.prompt !== 'string') continue;
      prompts.push({ id: prompt.id, prompt: prompt.prompt,
        ...(typeof prompt.hint === 'string' ? { hint: prompt.hint } : {}) });
    }
    ideas.push({ id: item.id, title: item.angle.summary, format: item.format, status: item.status,
      createdAt: item.createdAt.toISOString(), projectIds, prompts,
      reason: typeof structure.intro === 'string' ? structure.intro : item.angle.summary });
  }
  const campaigns = campaignRows.slice(0, 100).map(c => ({
    id: c.id, projectId: c.projectId, title: `${titles.get(c.projectId)} campaign`, preset: c.preset,
    createdAt: c.createdAt.toISOString(), totalPosts: c.totalPosts, postCount: c._count.posts,
    posts: c.posts.map(p => ({ id: p.id, title: p.title || `Post ${p.sequenceNum}`, caption: p.caption, sequenceNum: p.sequenceNum })),
  }));
  const allPosts: StudioData['posts'] = [
    ...exportRows.slice(0, 500).map(p => ({ id: p.id, projectId: p.projectId,
      title: p.headline || `${titles.get(p.projectId)} carousel`, caption: p.caption || '',
      status: p.status, updatedAt: p.updatedAt.toISOString(), kind: 'carousel' as const })),
    ...campaignRows.slice(0, 100).flatMap(c => c.posts.map(p => ({
      id: p.id, projectId: c.projectId, title: p.title || `Post ${p.sequenceNum}`, caption: p.caption,
      status: 'generated', updatedAt: p.createdAt.toISOString(), kind: 'campaign_post' as const, campaignId: c.id,
    }))),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    feed: buildStudioFeed(authorized, exportRows.slice(0, 500), campaignRows.slice(0, 100), ideas, userId, workspace.canWriteCampaigns)
      .filter(card => !projectId || card.projectIds.includes(projectId)),
    workspace,
    projects: scoped.map(p => ({ id: p.id, title: p.title || 'Untitled project',
      thumbnail: p.images[0]?.url ?? null, published: p.post?.status === 'PUBLISHED',
      canCreateCampaign: p.post?.status === 'PUBLISHED' && (workspace.canWriteCampaigns || p.ownerId === userId || p.designerId === userId),
      canCreate: p.post?.status === 'PUBLISHED' && (p.ownerId === userId || p.designerId === userId) })),
    editorials: scoped.flatMap(p => p.post ? [{ id: p.post.id, projectId: p.id, title: p.title || 'Untitled project',
      slug: p.post.slug, status: p.post.status.toLowerCase(), format: p.post.variant,
      updatedAt: p.post.updatedAt.toISOString() }] : []),
    ideas, campaigns, posts: allPosts.slice(0, 500),
    truncated: rows.length > 500 || ideaRows.length > 100 || campaignRows.length > 100 ||
      exportRows.length > 500 || allPosts.length > 500 || campaignRows.some(c => c._count.posts > c.posts.length),
  };
}
