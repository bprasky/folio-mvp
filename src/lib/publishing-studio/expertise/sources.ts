import 'server-only';
import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canAccessDesignerTools } from '@/lib/permissions';
import { resolvePublishingStudioContext, StudioAccessError } from '../data';
import { extractTextFromBlocks } from '@/lib/instagram-export/generation';
import type { ExpertiseEvidence } from './types';
import { verifiedImageObservation } from './engine';

export const expertiseEnabled = () => process.env.STUDIO_MY_EXPERTISE === 'true';
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const object = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
export function requireExpertise() { if (!expertiseEnabled()) throw new StudioAccessError('My expertise is not enabled.', 404); }

export async function expertiseOwner(actor: string, db: Prisma.TransactionClient = prisma) {
  const user = await db.user.findUnique({ where: { id: actor }, select: { role: true, name: true, profileImage: true, brandProfile: { select: { logoImageUrl: true } } } });
  if (!user || !canAccessDesignerTools(user.role)) throw new StudioAccessError('Designer access required.', 403);
  const workspace = await resolvePublishingStudioContext(actor, db);
  if (workspace.id && !workspace.canWriteCampaigns) throw new StudioAccessError('Editing is not available in this workspace.', 403);
  return { workspace, identity: { name: user.name || 'The designer', profileUrl: `/profile/${actor}`, portraitUrl: user.profileImage || undefined, logoUrl: user.brandProfile?.logoImageUrl || undefined } };
}

/** Author corpus: private owned work remains usable in interviews, never implicitly publishable. */
export async function expertiseSources(actor: string, db: Prisma.TransactionClient = prisma) {
  const owner = await expertiseOwner(actor, db);
  return { ...owner, ...await portfolioEvidence(actor, owner.workspace.id, db) };
}

/** Caller supplies the persisted workspace for public reads, never the owner's current UI selection. */
export async function portfolioEvidence(actor: string, workspace: string | null, db: Prisma.TransactionClient = prisma) {
  const projects = await db.project.findMany({ where: { designerOrgId: workspace, OR: [{ ownerId: actor }, { designerId: actor }] },
    select: { id: true, title: true, isPublic: true, updatedAt: true,
      post: { select: { id: true, status: true, expandedBlocks: true, credits: true, updatedAt: true } },
      rooms: { select: { id: true, name: true } },
      images: { where: { inclusion: 'INCLUDED' }, select: { id: true, url: true, name: true, roomId: true, updatedAt: true, verifiedAttributes: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }], take: 60 },
      editorialInterviews: { select: { answers: { select: { id: true, answerText: true, questionText: true, roomId: true, linkedImageId: true }, take: 100, orderBy: { createdAt: 'desc' } } } },
    }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 100 });
  const evidence: ExpertiseEvidence[] = [];
  for (const p of projects) {
    const visibility = p.isPublic && p.post?.status === 'PUBLISHED' ? 'public' as const : 'private' as const;
    const credit = object(p.post?.credits).photographer;
    const photographer = typeof credit === 'string' ? credit : undefined;
    const base = { projectId: p.id, projectName: p.title, visibility, photographer };
    for (const image of p.images) {
      const room = p.rooms.find(r => r.id === image.roomId);
      const attributes = object(image.verifiedAttributes);
      const text = verifiedImageObservation(attributes) || (Object.keys(attributes).length ? `Designer-verified image attributes: ${JSON.stringify(attributes)}` : `Project photograph${room ? ` of ${room.name}` : ''}. The design decision has not been confirmed.`);
      evidence.push({ ...base, id: `image:${image.id}`, revision: digest([image.id, image.updatedAt.toISOString(), image.url, image.roomId, attributes, visibility]),
        kind: 'observation', text, assetId: image.id, imageUrl: image.url, roomId: room?.id, roomName: room?.name, alt: image.name || `${room?.name || 'Project photograph'} — ${p.title}` });
    }
    const blocks = object(p.post?.expandedBlocks);
    const chapters = Array.isArray(blocks.galleryChapters) ? blocks.galleryChapters.map(object) : [];
    const lead = extractTextFromBlocks({ lead: blocks.lead, introduction: blocks.introduction }).trim();
    if (lead) evidence.push({ ...base, id: `post:${p.post!.id}:lead`, revision: digest(lead), kind: 'published_prose', text: lead });
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i]; const text = extractTextFromBlocks(chapter.body).trim();
      if (!text) continue;
      const room = p.rooms.find(r => r.id === chapter.roomId);
      evidence.push({ ...base, id: `post:${p.post!.id}:chapter:${i}`, revision: digest([text, chapter.roomId]), kind: 'published_prose', text, roomId: room?.id, roomName: room?.name });
    }
    for (const interview of p.editorialInterviews) for (const answer of interview.answers) {
      if (!answer.answerText.trim()) continue;
      const room = p.rooms.find(r => r.id === answer.roomId);
      // Original interview wording is author-only; explicit reviewed article prose supplies publication consent.
      evidence.push({ ...base, id: `answer:${answer.id}`, revision: digest([answer.questionText, answer.answerText]), kind: 'designer_answer', text: answer.answerText,
        roomId: room?.id, roomName: room?.name });
    }
  }
  return { projects: projects.map(p => ({ id: p.id, title: p.title })), evidence,
    posts: projects.flatMap(p => p.post ? [{ projectId: p.id, projectPostId: p.post.id, sourceDigest: digest([p.id, p.post.updatedAt.toISOString(), p.post.expandedBlocks]) }] : []),
    signature: digest(evidence.map(e => [e.id, e.revision, e.visibility])) };
}

export function changedEvidence(saved: ExpertiseEvidence[], fresh: ExpertiseEvidence[]) {
  return saved.filter(e => !fresh.some(f => f.id === e.id && f.revision === e.revision && f.visibility === e.visibility)).map(e => e.id);
}
