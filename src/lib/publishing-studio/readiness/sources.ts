import 'server-only';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { resolvePublishingStudioContext } from '../data';
import { extractTextFromBlocks } from '@/lib/instagram-export/generation';
import type { CandidateSource, Evidence, SourceImage } from './types';

export const readinessEnabled = () => process.env.STUDIO_EDITORIAL_READINESS === 'true';
export const sourceVersion = (source: CandidateSource) => createHash('sha256').update(JSON.stringify(source)).digest('hex');
export const candidateId = (userId: string, organizationId: string | null, key: string) =>
  `candidate_${createHash('sha256').update(JSON.stringify([userId, organizationId, key])).digest('hex').slice(0, 40)}`;

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** The exact public corpus is re-read on every mutation, never accepted from a client. */
export async function loadCandidateSources(userId: string, db: Prisma.TransactionClient = prisma) {
  const workspace = await resolvePublishingStudioContext(userId, db);
  const projects = await db.project.findMany({
    where: { isPublic: true, post: { status: 'PUBLISHED' }, designerOrgId: workspace.id,
      ...(workspace.id ? {} : { OR: [{ ownerId: userId }, { designerId: userId }] }) },
    select: { id: true, title: true, designer: { select: { name: true } },
      post: { select: { expandedBlocks: true, credits: true } },
      rooms: { select: { id: true, name: true }, orderBy: { id: 'asc' } },
      images: { where: { inclusion: 'INCLUDED' }, select: { id: true, url: true, roomId: true, room: true, updatedAt: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] } },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 100,
  });
  const sources: CandidateSource[] = [];
  for (const project of projects) {
    const blocks = object(project.post?.expandedBlocks);
    const credits = object(project.post?.credits);
    const photographer = typeof credits.photographer === 'string' ? credits.photographer.trim() || null : null;
    const images: SourceImage[] = project.images.map(image => ({ id: image.id, url: image.url, projectId: project.id, revision: image.updatedAt?.toISOString(),
      roomId: image.roomId || project.rooms.find(room => room.id === image.room || room.name === image.room)?.id, approved: true }));
    const chapters = Array.isArray(blocks.galleryChapters) ? blocks.galleryChapters.map(object) : [];
    const evidence: Evidence[] = chapters.flatMap((chapter, index) => {
      const text = extractTextFromBlocks(chapter.body).trim();
      const roomId = typeof chapter.roomId === 'string' ? chapter.roomId : images.find(image => Array.isArray(chapter.imageIds) && chapter.imageIds.includes(image.id))?.roomId;
      return text ? [{ id: `published:${project.id}:chapter:${index}`, projectId: project.id, roomId, text, tier: 'direct' as const, source: 'published_prose' as const }] : [];
    });
    const lead = extractTextFromBlocks({ lead: blocks.lead, introduction: blocks.introduction }).trim();
    if (lead) evidence.unshift({ id: `published:${project.id}:lead`, projectId: project.id, text: lead, tier: 'direct', source: 'published_prose' });
    const base = { projectIds: [project.id], title: project.title, designerName: workspace.id ? workspace.name : project.designer?.name || workspace.name, photographer };
    // No keyword gate and no automatic overview: every source requires structured evaluation.
    sources.push({ ...base, key: `project:${project.id}`, origin: 'project', evidence, images: images.slice(0, 12) });
    for (const room of project.rooms) {
      const roomEvidence = evidence.filter(item => item.roomId === room.id);
      const roomImages = images.filter(image => image.roomId === room.id);
      if (!roomEvidence.length && !roomImages.length) continue;
      sources.push({ ...base, key: `room:${project.id}:${room.id}`, title: `${room.name} at ${project.title}`, roomId: room.id,
        origin: 'room', evidence: roomEvidence, images: roomImages.slice(0, 12) });
    }
  }
  const ideas = await db.editorialQueueItem.findMany({ where: { designerId: userId,
    angle: { organizationId: workspace.id }, status: { in: ['recommended', 'in_progress'] } },
    select: { id: true, angle: { select: { summary: true, evidence: true } } }, orderBy: { createdAt: 'desc' }, take: 50 });
  for (const idea of ideas) {
    const refs = object(idea.angle.evidence).projectIds;
    if (!Array.isArray(refs) || !refs.length || !refs.every(id => typeof id === 'string' && projects.some(project => project.id === id))) continue;
    const parent = sources.filter(source => source.origin === 'project' && refs.includes(source.projectIds[0]));
    sources.push({ key: `direction:${idea.id}`, origin: 'direction', title: idea.angle.summary, projectIds: refs as string[],
      evidence: parent.flatMap(source => source.evidence), images: parent.flatMap(source => source.images).slice(0, 12),
      designerName: workspace.name, photographer: null });
  }
  return { workspace, sources };
}
