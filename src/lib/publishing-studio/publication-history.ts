import 'server-only';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canAccessDesignerTools } from '@/lib/permissions';
import { buildStudioFeed, configObject } from './feed';
import { PUBLICATION_HISTORY_NAMESPACE, parseHistoryEntries, type ProjectPublicationHistory, type PublicationHistoryEntry } from './history';

const historyId = (actor: string, workspace: string | null, projectId: string) =>
  `publication_history_${createHash('sha256').update(JSON.stringify([actor, workspace, projectId])).digest('hex').slice(0, 40)}`;

async function actorContext(actor: string, db: Prisma.TransactionClient) {
  // Lazy import keeps the read projection usable by data.ts without a module cycle.
  const { resolvePublishingStudioContext, StudioAccessError } = await import('./data');
  const user = await db.user.findUnique({ where: { id: actor }, select: { role: true } });
  if (!user || !canAccessDesignerTools(user.role)) throw new StudioAccessError('Designer access required.', 403);
  return { workspace: await resolvePublishingStudioContext(actor, db), StudioAccessError };
}

/** Actor-owned correction history; the supplied project IDs are reauthorized, not trusted. */
export async function readPublicationHistory(actor: string, workspaceId: string | null, projectIds: string[], db: Prisma.TransactionClient = prisma): Promise<ProjectPublicationHistory[]> {
  const { workspace, StudioAccessError } = await actorContext(actor, db);
  if (workspace.id !== workspaceId) throw new StudioAccessError('Your workspace changed. Reload your Studio.', 409);
  const projects = await db.project.findMany({ where: { id: { in: projectIds }, designerOrgId: workspace.id,
    OR: [{ ownerId: actor }, { designerId: actor }, ...(workspace.id ? [{ isPublic: true, post: { status: 'PUBLISHED' as const } }] : [])] }, select: { id: true } });
  const ids = projects.map(project => historyId(actor, workspace.id, project.id));
  const rows = await db.editorialDraft.findMany({ where: { id: { in: ids }, status: 'publication_history' }, select: { projectId: true, version: true, rawState: true } });
  return rows.flatMap(row => {
    const raw = configObject(row.rawState);
    return projects.some(project => project.id === row.projectId) && raw.kind === PUBLICATION_HISTORY_NAMESPACE && raw.actor === actor && raw.workspace === workspace.id && raw.projectId === row.projectId
      ? [{ projectId: row.projectId, version: row.version, entries: parseHistoryEntries(raw.entries) }] : [];
  });
}

export async function savePublicationHistory(actor: string, body: unknown): Promise<ProjectPublicationHistory> {
  const input = configObject(body);
  const { StudioAccessError } = await import('./data');
  if (typeof input.projectId !== 'string' || input.projectId.length > 200 || typeof input.sourceId !== 'string' || input.sourceId.length > 250
    || !Number.isInteger(input.expectedVersion) || Number(input.expectedVersion) < 0 || !['published','dismissed','restored'].includes(String(input.kind))
    || (input.kind === 'published' && !['instagram','other'].includes(String(input.destination)))) throw new StudioAccessError('Choose the story and confirm where it was shared.', 400);
  try {
    return await prisma.$transaction(async db => {
      const { workspace } = await actorContext(actor, db);
      if (workspace.id && !workspace.canWriteCampaigns) throw new StudioAccessError('Editing is not available in this workspace.', 403);
      const project = await db.project.findFirst({ where: { id: input.projectId as string, designerOrgId: workspace.id,
        OR: [{ ownerId: actor }, { designerId: actor }, ...(workspace.id ? [{ isPublic: true, post: { status: 'PUBLISHED' as const } }] : [])] }, select: {
        id: true, title: true, ownerId: true, designerId: true, isPublic: true,
        designer: { select: { name: true } }, post: { select: { status: true, updatedAt: true, excerpt: true, heroAssetId: true, expandedBlocks: true } },
        rooms: { select: { id: true, name: true }, orderBy: { id: 'asc' }, take: 30 },
        images: { select: { id: true, url: true, room: true, roomId: true, inclusion: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }], take: 100 },
      } });
      if (!project) throw new StudioAccessError('Project is not available in this workspace.', 404);
      const id = historyId(actor, workspace.id, project.id);
      const saved = await db.editorialDraft.findUnique({ where: { id }, select: { version: true, status: true, rawState: true } });
      const raw = configObject(saved?.rawState);
      if (saved && (saved.status !== 'publication_history' || raw.kind !== PUBLICATION_HISTORY_NAMESPACE || raw.actor !== actor || raw.workspace !== workspace.id || raw.projectId !== project.id)) throw new StudioAccessError('History is not available.', 403);
      if ((saved?.version ?? 0) !== input.expectedVersion) throw new StudioAccessError('History changed. Reload before saving.', 409);
      let entries = parseHistoryEntries(raw.entries);
      if (input.kind === 'restored') {
        if (!entries.some(entry => entry.sourceId === input.sourceId)) throw new StudioAccessError('That correction is no longer available.', 404);
        entries = entries.filter(entry => entry.sourceId !== input.sourceId);
      } else {
        const exports = await db.instagramExport.findMany({ where: { projectId: project.id, designerId: actor }, select: {
          id: true, projectId: true, headline: true, caption: true, status: true, config: true, updatedAt: true,
        }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 500 });
        const cards = [...buildStudioFeed([project], [], [], [], actor, workspace.canWriteCampaigns),
          ...buildStudioFeed([project], exports, [], [], actor, workspace.canWriteCampaigns)];
        const card = cards.find(card => card.id === input.sourceId && card.canPolish && ['suggestion','carousel'].includes(card.kind));
        if (!card || (card.revision || card.updatedAt) !== input.revision) throw new StudioAccessError('Story changed. Reload before confirming its history.', 409);
        const original = card.exportId ? configObject(exports.find(row => row.id === card.exportId)?.config).studioCardId : undefined;
        const sourceId = typeof original === 'string' ? original : card.id;
        const entry: PublicationHistoryEntry = { sourceId, ...(card.roomId ? { roomId: card.roomId } : {}), revision: card.revision || card.updatedAt,
          kind: input.kind as 'published' | 'dismissed', destination: input.kind === 'published' ? input.destination as 'instagram' | 'other' : null,
          headline: card.title.slice(0, 500), caption: card.caption.slice(0, 5000), angle: (card.pitch || card.caption).slice(0, 5000),
          evidence: (card.beats || [card.caption]).slice(0, 8).map(text => text.slice(0, 1000)), recordedAt: new Date().toISOString() };
        entries = [...entries.filter(item => item.sourceId !== sourceId), entry];
        if (entries.length > 100) throw new StudioAccessError('This project has reached its saved history limit.', 409);
      }
      const version = Number(input.expectedVersion) + 1;
      const rawState = { kind: PUBLICATION_HISTORY_NAMESPACE, actor, workspace: workspace.id, projectId: project.id, entries } as unknown as Prisma.InputJsonValue;
      if (!saved) await db.editorialDraft.create({ data: { id, projectId: project.id, status: 'publication_history', version, rawState } });
      else if ((await db.editorialDraft.updateMany({ where: { id, status: 'publication_history', version: Number(input.expectedVersion) }, data: { version, rawState, updatedAt: new Date() } })).count !== 1) throw new StudioAccessError('History changed. Reload before saving.', 409);
      return { projectId: project.id, version, entries };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034'].includes(error.code)) throw new StudioAccessError('History changed. Reload before saving.', 409);
    throw error;
  }
}
