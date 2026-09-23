import 'server-only';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canAccessDesignerTools } from '@/lib/permissions';
import { resolvePublishingStudioContext, StudioAccessError } from './data';
import { buildStudioFeed, configObject, savedPublicationPreview } from './feed';
import type { StudioFeedCard } from './types';
import { validateReleaseItems, type ReleaseOption, type ReleasePlanResponse, type ReleasePlanItem, type ReleaseDiscovery, type ReleaseOpportunity } from './release-plan';

const namespace = 'studio_release_plan_v1';
const planId = (actor: string, workspace: string | null, projectId: string) => `release_${createHash('sha256').update(JSON.stringify([actor, workspace, projectId])).digest('hex').slice(0, 40)}`;
/** Conservative overlap rejection; this never supplies missing editorial evidence. */
function distinctCards(cards: StudioFeedCard[], excerpt: string | null | undefined) {
  const seen: Set<string>[] = [];
  return cards.filter(card => {
    if (!card.canPolish || !card.revision || !card.caption.trim()) return false;
    if (!card.roomId && (!excerpt || excerpt.trim().split(/\s+/).length < 12)) return false;
    const words = new Set(card.caption.toLowerCase().match(new RegExp('[\\p{L}\\p{N}]+', 'gu')) || []);
    if (seen.some(previous => Array.from(words).filter(word => previous.has(word)).length / Math.max(1, Math.min(words.size, previous.size)) >= 0.85)) return false;
    seen.push(words); return true;
  });
}
const projectSelect = {
  id: true, title: true, ownerId: true, designerId: true, isPublic: true,
  designer: { select: { name: true } },
  post: { select: { status: true, updatedAt: true, excerpt: true, heroAssetId: true, expandedBlocks: true } },
  rooms: { select: { id: true, name: true }, orderBy: { id: 'asc' }, take: 30 },
  images: { select: { id: true, url: true, room: true, roomId: true, inclusion: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }], take: 100 },
} satisfies Prisma.ProjectSelect;

export async function listReleasePlans(actor: string): Promise<ReleaseDiscovery> {
  const user = await prisma.user.findUnique({ where: { id: actor }, select: { role: true } });
  if (!user || !canAccessDesignerTools(user.role)) throw new StudioAccessError('Designer access required.', 403);
  const workspace = await resolvePublishingStudioContext(actor);
  if (workspace.id && !workspace.canWriteCampaigns) return { opportunities: [], plans: [] };
  const projects = await prisma.project.findMany({ where: { designerOrgId: workspace.id,
    ...(workspace.id ? {} : { OR: [{ ownerId: actor }, { designerId: actor }] }) }, select: projectSelect,
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 100 });
  const saved = await prisma.editorialDraft.findMany({ where: { id: { in: projects.map(project => planId(actor, workspace.id, project.id)) }, status: 'release_plan' }, select: { projectId: true, rawState: true } });
  const exports = await prisma.instagramExport.findMany({ where: { projectId: { in: projects.map(project => project.id) }, designerId: actor }, select: { projectId: true, headline: true, config: true }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 500 });
  const output: ReleaseDiscovery = { opportunities: [], plans: [] };
  for (const project of projects) {
    const cards = process.env.STUDIO_EDITORIAL_READINESS === 'true' ? [] : distinctCards(buildStudioFeed([project], [], [], [], actor, workspace.canWriteCampaigns), project.post?.excerpt);
    const introduction = cards.find(card => !card.roomId);
    const rooms = cards.filter(card => card.roomId);
    const raw = configObject(saved.find(row => row.projectId === project.id)?.rawState);
    const hasPlan = raw.kind === namespace && raw.actor === actor && raw.workspace === workspace.id && raw.projectId === project.id;
    const available = Boolean(introduction && rooms.length);
    const needsReview = !available || !Array.isArray(raw.items) || raw.items.some(item => {
      const value = configObject(item); return !cards.some(card => card.id === value.sourceId && card.revision === value.revision);
    });
    const openingDraft = exports.find(row => row.projectId === project.id && configObject(row.config).studioCardId === introduction?.id);
    const opening = openingDraft ? savedPublicationPreview(configObject(openingDraft.config), project.images, project.designer?.name || 'Designer') : introduction;
    const item: ReleaseOpportunity = { projectId: project.id, projectTitle: project.title, imageUrl: opening?.imageUrl ?? null, title: openingDraft?.headline ?? introduction?.title ?? project.title, preview: opening?.preview,
      purpose: `Give ${project.title} a fuller introduction.`, reason: 'A prepared project introduction and distinct, supported room stories can form a considered sequence.',
      roomCount: rooms.length, hasPlan, sourceIds: [introduction, ...rooms].flatMap(card => card ? [card.id] : []), ...(hasPlan ? { needsReview } : {}) };
    if (hasPlan) output.plans.push(item);
    else if (available) output.opportunities.push(item);
  }
  return output;
}

/** Author context, but outputs deliberately reuse only the established public source corpus. */
async function context(actor: string, projectId: string, db: Prisma.TransactionClient) {
  if (typeof projectId !== 'string' || !projectId || projectId.length > 200) throw new StudioAccessError('Choose a project.', 400);
  const user = await db.user.findUnique({ where: { id: actor }, select: { role: true } });
  if (!user || !canAccessDesignerTools(user.role)) throw new StudioAccessError('Designer access required.', 403);
  const workspace = await resolvePublishingStudioContext(actor, db);
  if (workspace.id && !workspace.canWriteCampaigns) throw new StudioAccessError('Editing is not available in this workspace.', 403);
  const project = await db.project.findFirst({ where: { id: projectId, designerOrgId: workspace.id,
    ...(workspace.id ? {} : { OR: [{ ownerId: actor }, { designerId: actor }] }) }, select: projectSelect });
  if (!project) throw new StudioAccessError('Project is not available in this workspace.', 404);
  const exports = await db.instagramExport.findMany({ where: { projectId, designerId: actor }, select: {
    id: true, headline: true, caption: true, status: true, config: true,
  }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 500 });
  const options: ReleaseOption[] = (process.env.STUDIO_EDITORIAL_READINESS === 'true' ? [] : distinctCards(buildStudioFeed([project], [], [], [], actor, workspace.canWriteCampaigns), project.post?.excerpt)).map(card => {
      const saved = exports.find(row => configObject(row.config).studioCardId === card.id);
      const preview = saved ? savedPublicationPreview(configObject(saved.config), project.images, project.designer?.name || 'Designer') : card;
      const query = saved ? new URLSearchParams({ export: saved.id }) : new URLSearchParams({ proposal: card.id, revision: card.revision! });
      query.set('release', projectId);
      return { sourceId: card.id, revision: card.revision!, kind: card.roomId ? 'room' : 'introduction',
        title: saved?.headline ?? card.title, caption: saved?.caption ?? card.caption, imageUrl: preview.imageUrl, preview: preview.preview,
        ...(card.roomId ? { roomId: card.roomId } : {}), editorHref: `/designer/projects/${encodeURIComponent(projectId)}/instagram?${query}`,
        // Legacy 'generated' is recorded before the browser download succeeds.
        status: saved ? 'draft_saved' : 'prepared' };
    });
  const id = planId(actor, workspace.id, projectId);
  const saved = await db.editorialDraft.findUnique({ where: { id }, select: { version: true, status: true, rawState: true } });
  const raw = configObject(saved?.rawState);
  if (saved && (saved.status !== 'release_plan' || raw.kind !== namespace || raw.actor !== actor || raw.workspace !== workspace.id || raw.projectId !== projectId)) throw new StudioAccessError('This plan is not available.', 403);
  const items = Array.isArray(raw.items) ? raw.items as ReleasePlanItem[] : [];
  const result: ReleasePlanResponse = { project: { id: project.id, title: project.title }, purpose: `Give ${project.title} a fuller introduction.`, options,
    plan: saved ? { version: saved.version, items, needsReview: !validateReleaseItems(items, options) } : null };
  return { id, workspace, result };
}

export async function readReleasePlan(actor: string, projectId: string) {
  return (await context(actor, projectId, prisma)).result;
}

export async function saveReleasePlan(actor: string, body: unknown) {
  const input = configObject(body);
  if (typeof input.projectId !== 'string' || !Number.isInteger(input.expectedVersion) || Number(input.expectedVersion) < 0) throw new StudioAccessError('Reload the release plan before saving.', 400);
  try {
    return await prisma.$transaction(async db => {
      const { id, workspace, result } = await context(actor, input.projectId as string, db);
      if ((result.plan?.version ?? 0) !== input.expectedVersion) throw new StudioAccessError('This plan changed. Reload before saving.', 409);
      const items = validateReleaseItems(input.items, result.options);
      if (!items) throw new StudioAccessError('Choose the current introduction and at least one distinct eligible room. Refresh changed sources before saving.', 409);
      const rawState = { kind: namespace, actor, workspace: workspace.id, projectId: input.projectId, items } as Prisma.InputJsonValue;
      const version = Number(input.expectedVersion) + 1;
      if (!result.plan) await db.editorialDraft.create({ data: { id, projectId: input.projectId as string, status: 'release_plan', version, rawState } });
      else {
        const changed = await db.editorialDraft.updateMany({ where: { id, version: Number(input.expectedVersion), status: 'release_plan' }, data: { version, rawState, updatedAt: new Date() } });
        if (changed.count !== 1) throw new StudioAccessError('This plan changed. Reload before saving.', 409);
      }
      return { ...result, plan: { version, items, needsReview: false } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) throw new StudioAccessError('This plan changed. Reload before saving.', 409);
    throw error;
  }
}
