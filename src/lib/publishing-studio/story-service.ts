import 'server-only';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canAccessDesignerTools, canPublishFromOrg } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rateLimit';
import { extractTextFromBlocks, publishedRoomSource } from '@/lib/instagram-export/generation';
import { resolvePublishingStudioContext } from './data';
import { generateActivity } from './generate-activity';
import { activityProgress, createActivity, prepareActivityDraft, editActivityDraft, type ActivityAnswer, type ActivityBrief, type ActivityContext, type ActivityDefinition, type ActivityDraft } from './activities';

export class StoryError extends Error { constructor(message: string, public status = 400) { super(message); } }
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const json = (value: unknown) => value as Prisma.InputJsonValue;
const includeRevision = { answers: true, sources: true } as const;
type Revision = Prisma.EditorialStoryRevisionGetPayload<{ include: typeof includeRevision }>;

/** Server-only context. Every private read and mutation resolves the current workspace afresh. */
export async function storyContext(userId: string, db: Prisma.TransactionClient = prisma) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, bio: true, role: true, profileImage: true, brandProfile: { select: { logoImageUrl: true } } } });
  if (!user || !canAccessDesignerTools(user.role)) throw new StoryError('Designer access required.', 403);
  const workspace = await resolvePublishingStudioContext(userId, db);
  if (workspace.id && !workspace.canWriteCampaigns) throw new StoryError('Editing is not available in this workspace.', 403);
  const projects = await db.project.findMany({ where: { designerOrgId: workspace.id, isPublic: true, post: { status: 'PUBLISHED' },
    ...(workspace.id ? {} : { OR: [{ ownerId: userId }, { designerId: userId }] }) },
    select: { id: true, title: true, rooms: { select: { id: true, name: true } }, images: { select: { id: true, roomId: true, url: true, inclusion: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] }, post: { select: { id: true, expandedBlocks: true, updatedAt: true } } },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 100 });
  const context: ActivityContext = { designerName: user.name || 'The designer', firmName: workspace.name,
    identity: { name: user.name || 'The designer', portraitUrl: user.profileImage, logoUrl: user.brandProfile?.logoImageUrl },
    profile: { hasBio: !!user.bio?.trim(), hasPointOfView: false }, projects: projects.map(p => ({ id: p.id, title: p.title,
      imageUrl: p.images.find(image => image.inclusion === 'INCLUDED')?.url || null,
      rooms: p.rooms.map(room => ({ ...room, imageUrl: p.images.find(image => image.inclusion === 'INCLUDED' && image.roomId === room.id)?.url || null })) })),
    references: [ ...(user.bio?.trim() ? [{ id: `bio:${userId}`, kind: 'bio' as const, text: user.bio }] : []),
      ...projects.flatMap(p => {
        const text = extractTextFromBlocks(p.post?.expandedBlocks).trim();
        return [...(text ? [{ id: p.post!.id, kind: 'project' as const, projectId: p.id, text }] : []),
          ...p.rooms.flatMap(room => { const roomText = extractTextFromBlocks(publishedRoomSource(p.post?.expandedBlocks, room.id, p.images.filter(image => image.roomId === room.id).map(image => image.id))).trim();
            return roomText ? [{ id: `${p.post!.id}:room:${room.id}`, kind: 'project' as const, projectId: p.id, roomId: room.id, text: roomText }] : []; })];
      }) ] };
  return { workspace, context, sources: projects.map(p => ({ projectPostId: p.post!.id, projectId: p.id,
    sourceDigest: hash([p.id, p.post!.updatedAt.toISOString(), p.post!.expandedBlocks]) })) };
}
function projectCover(brief: ActivityBrief | undefined, context: ActivityContext) {
  if (brief?.subject !== 'project') return undefined;
  const project = context.projects.find(project => project.id === brief.projectId);
  return (brief.roomId ? project?.rooms.find(room => room.id === brief.roomId)?.imageUrl : project?.imageUrl) || null;
}
function snapshot(story: { id: string; slug: string; status: string; publishedRevisionNumber: number | null; ownerId?: string }, revision: Revision, context: ActivityContext) {
  return { id: story.id, revision: revision.editVersion, definition: revision.interview as unknown as ActivityDefinition,
    projectImageUrl: projectCover((revision.interview as unknown as ActivityDefinition | null)?.brief, context),
    answers: revision.answers.map(a => ({ questionId: a.promptId, text: a.answerText })), reviewed: !!revision.answersReviewedAt,
    draft: Object.keys(revision.blocks as object).length ? revision.blocks as unknown as ActivityDraft : null,
    status: story.status === 'withdrawn' ? 'withdrawn' : story.publishedRevisionNumber === revision.number ? story.status : 'draft',
    publishedUrl: story.publishedRevisionNumber === revision.number ? `/stories/${story.slug}` : null,
    profileUrl: story.ownerId ? `/profile/${story.ownerId}?tab=about` : null,
    previousPublishedUrl: story.publishedRevisionNumber && story.publishedRevisionNumber !== revision.number ? `/stories/${story.slug}` : null };
}
async function owned(userId: string, id: string, db: Prisma.TransactionClient) {
  const data = await storyContext(userId, db);
  const story = await db.editorialStory.findFirst({ where: { id, ownerId: userId, organizationId: data.workspace.id, format: { not: 'expertise' } },
    include: { revisions: { orderBy: { number: 'desc' }, take: 1, include: includeRevision } } });
  if (!story || story.status === 'withdrawn' || !story.revisions[0]) throw new StoryError('Story not found in this workspace.', 404);
  return { data, story, revision: story.revisions[0] };
}
export async function listStories(userId: string) {
  const data = await storyContext(userId);
  const stories = await prisma.editorialStory.findMany({ where: { ownerId: userId, organizationId: data.workspace.id, format: { not: 'expertise' }, status: { not: 'withdrawn' },
    revisions: { some: { OR: [{ editVersion: { gt: 1 } }, { answers: { some: {} } }] } } },
    orderBy: { updatedAt: 'desc' }, take: 100, include: { revisions: { orderBy: { number: 'desc' }, take: 1, include: includeRevision } } });
  // Dedicated bounded lookups keep completion detection independent of the latest 100 activities.
  const personal = { ownerId: userId, organizationId: data.workspace.id, format: 'twenty_questions' };
  const personalRevision = { interview: { path: ['brief', 'subject'], equals: 'designer' } };
  const personalSelect = { id: true, slug: true, publishedRevisionNumber: true, revisions: { orderBy: { number: 'desc' as const }, take: 1, select: { number: true, title: true, blocks: true } } };
  const completed = await prisma.editorialStory.findFirst({ where: { ...personal, status: 'published', publishedRevisionNumber: { not: null },
    revisions: { some: personalRevision } }, orderBy: { updatedAt: 'desc' }, select: personalSelect });
  const inProgress = completed ? null : await prisma.editorialStory.findFirst({ where: { ...personal, status: { not: 'withdrawn' },
    revisions: { some: { ...personalRevision, OR: [{ editVersion: { gt: 1 } }, { answers: { some: {} } }] } } },
    orderBy: { updatedAt: 'desc' }, select: personalSelect });
  const introduction = completed || inProgress;
  const needsReview = completed ? !(await publicStory(completed.slug)) : false;
  const latest = introduction?.revisions?.[0];
  const currentPublished = Boolean(completed && latest?.number === completed.publishedRevisionNumber);
  const personalIntroduction = introduction ? { status: currentPublished ? 'published' as const : 'draft' as const, id: introduction.id,
    title: latest?.title, stage: currentPublished ? 'published' : latest?.blocks && Object.keys(latest.blocks as object).length ? 'article' : 'interview',
    href: `/designer/studio/activity?id=${encodeURIComponent(introduction.id)}`,
    needsReview, publishedUrl: completed && !needsReview ? `/stories/${completed.slug}` : null } : { status: 'available' as const };
  return { context: data.context, personalIntroduction, stories: stories.filter(s => s.status !== 'withdrawn' && s.revisions[0] &&
    (s.revisions[0].editVersion > 1 || s.revisions[0].answers.length > 0)).map(s => snapshot(s, s.revisions[0], data.context)) };
}
export async function readStory(userId: string, id: string) {
  const { data, story, revision } = await owned(userId, id, prisma);
  const saved = snapshot(story, revision, data.context);
  if (story.publishedRevisionNumber !== null && !(await publicStory(story.slug))) {
    return { ...saved, publishedUrl: null, previousPublishedUrl: null, publicationNeedsReview: true };
  }
  return saved;
}

export async function startStory(userId: string, brief: ActivityBrief, key: string) {
  if (typeof key !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(key)) throw new StoryError('A creation key is required.');
  const data = await storyContext(userId);
  let validated: ActivityBrief;
  try { validated = createActivity(brief, data.context).brief; } catch (error) { throw new StoryError(error instanceof Error ? error.message : 'Choose a valid activity.'); }
  const id = `story_${hash([userId, data.workspace.id, key]).slice(0, 40)}`;
  const existing = await prisma.editorialStory.findUnique({ where: { id } });
  if (existing) { const saved = await readStory(userId, id); if (hash(saved.definition.brief) !== hash(validated)) throw new StoryError('This creation key belongs to another interview.', 409); return saved; }
  const limit = await checkRateLimit(`studio-story:${userId}`, { max: 6, windowMs: 60 * 60 * 1000 });
  if (!limit.success) throw new StoryError('Please wait before preparing another interview.', 429);
  let definition: ActivityDefinition;
  const generationContext = validated.roomId ? { ...data.context, references: data.context.references?.filter(r => r.projectId === validated.projectId && r.roomId === validated.roomId) } : data.context;
  try { definition = await generateActivity(validated, generationContext); }
  catch (error) { throw new StoryError(error instanceof Error ? error.message : 'Could not prepare your interview. Try again.', 422); }
  const used = new Set(definition.questions.flatMap(q => [...(q.sourceIds || []), ...(q.evidence?.map(e => e.sourceId) || [])]));
  const usedProjects = new Set(data.context.references?.filter(r => used.has(r.id)).map(r => r.projectId));
  const sources = data.sources.filter(s => usedProjects.has(s.projectId));
  try {
    return await prisma.$transaction(async db => {
      const fresh = await storyContext(userId, db);
      if (fresh.workspace.id !== data.workspace.id || hash(fresh.context) !== hash(data.context) || sources.some(s => !fresh.sources.some(f => f.projectPostId === s.projectPostId && f.sourceDigest === s.sourceDigest))) throw new StoryError('Your source context changed. Prepare the interview again.', 409);
      const story = await db.editorialStory.create({ data: { id, ownerId: userId, organizationId: data.workspace.id, slug: id, format: validated.format,
        revisions: { create: { number: 1, title: definition.title, blocks: {}, interview: json(definition),
          sources: { create: sources.map(({ projectPostId, sourceDigest }) => ({ projectPostId, sourceDigest })) } } } },
        include: { revisions: { include: includeRevision } } });
      return snapshot(story, story.revisions[0], fresh.context);
    }, { isolationLevel: 'Serializable' });
  } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const saved = await readStory(userId, id);
    if (hash(saved.definition.brief) !== hash(validated)) throw new StoryError('This creation key belongs to another interview.', 409);
    return saved;
  } throw error; }
}

export async function changeStory(userId: string, id: string, input: { action?: unknown; revision?: unknown; answers?: unknown; reviewed?: unknown; draft?: unknown; articleReviewed?: unknown }) {
  if (!Number.isInteger(input.revision) || !['save', 'review', 'prepare', 'edit_article', 'publish', 'discard'].includes(String(input.action))) throw new StoryError('Choose a valid story action and revision.');
  return prisma.$transaction(async db => {
    // All answer, approval and publication writers serialize on the parent, including clone creation.
    await db.$queryRaw`SELECT id FROM editorial_stories WHERE id = ${id} FOR UPDATE`;
    const { data, story, revision: current } = await owned(userId, id, db);
    if (current.editVersion !== input.revision) throw new StoryError('This interview changed in another tab. Reload before saving.', 409);
    if (input.action === 'discard') {
      if (story.publishedRevisionNumber !== null || current.approvedAt) throw new StoryError('A published article cannot be removed as an interview draft.', 409);
      const saved = await db.editorialStoryRevision.update({ where: { id: current.id }, data: { editVersion: { increment: 1 } }, include: includeRevision });
      const archived = await db.editorialStory.update({ where: { id }, data: { status: 'withdrawn', updatedAt: new Date() } });
      return snapshot(archived, saved, data.context);
    }
    if (current.sources.some(s => !data.sources.some(f => f.projectPostId === s.projectPostId && f.sourceDigest === s.sourceDigest))) throw new StoryError('A source changed or is no longer published. Start a fresh interview from the current work.', 409);
    const definition = current.interview as unknown as ActivityDefinition;
    let answers: ActivityAnswer[] = current.answers.map(a => ({ questionId: a.promptId, text: a.answerText }));
    if (input.action === 'save') {
      if (!Array.isArray(input.answers) || input.answers.length > 20 || input.answers.some(a => !a || typeof a.questionId !== 'string' || typeof a.text !== 'string')) throw new StoryError('Invalid answers.');
      answers = input.answers;
      try { activityProgress(definition, answers); } catch { throw new StoryError('Invalid interview answers.'); }
    }
    if (current.approvedAt && input.action !== 'save') throw new StoryError('This revision is already published.', 409);
    let revision = current;
    if (current.approvedAt) {
      revision = await db.editorialStoryRevision.create({ data: { storyId: id, number: current.number + 1, editVersion: current.editVersion,
        title: current.title, interview: json(current.interview), blocks: {}, sources: { create: current.sources.map(s => ({ projectPostId: s.projectPostId, sourceDigest: s.sourceDigest })) },
        answers: { create: current.answers.map(a => ({ promptId: a.promptId, questionText: a.questionText, answerText: a.answerText, answeredById: a.answeredById, answeredAt: a.answeredAt })) } }, include: includeRevision });
    }
    let changes: Prisma.EditorialStoryRevisionUpdateInput = { editVersion: { increment: 1 } };
    if (input.action === 'save') {
      // Clients may revoke review; granting review still requires the explicit server-validated action.
      if (input.reviewed === false) changes = { ...changes, answersReviewedAt: null };
      const before = new Map(revision.answers.map(a => [a.promptId, a.answerText]));
      const changed = definition.questions.some(q => (before.get(q.id) || '') !== (answers.find(a => a.questionId === q.id)?.text || ''));
      if (changed) {
        changes = { ...changes, blocks: {}, answersReviewedAt: null };
        for (const q of definition.questions) { const text = answers.find(a => a.questionId === q.id)?.text || '';
          if ((before.get(q.id) || '') === text) continue;
          await db.editorialStoryAnswer.upsert({ where: { revisionId_promptId: { revisionId: revision.id, promptId: q.id } },
            create: { revisionId: revision.id, promptId: q.id, questionText: q.prompt, answerText: text, answeredById: userId },
            update: { answerText: text, answeredById: userId, answeredAt: new Date() } });
        }
      }
    } else {
      if (!activityProgress(definition, answers).ready) throw new StoryError('Finish every answer before reviewing or publishing.');
      if (input.action === 'review') changes.answersReviewedAt = new Date();
      else {
        if (!revision.answersReviewedAt) throw new StoryError('Review your answers first.');
        if (input.action === 'prepare') {
          // Repeated saves/review must preserve already edited article copy.
          if (!Object.keys(revision.blocks as object).length) changes.blocks = json(prepareActivityDraft(definition, answers, true));
        } else if (input.action === 'edit_article') {
          if (!Object.keys(revision.blocks as object).length) throw new StoryError('Prepare the article before editing it.');
          let draft: ActivityDraft;
          try { draft = editActivityDraft(definition, input.draft); } catch (error) { throw new StoryError(error instanceof Error ? error.message : 'Invalid article.'); }
          changes = { ...changes, blocks: json(draft), title: draft.title };
        }
        else {
          if (!data.workspace.id || !(await canPublishFromOrg(userId, data.workspace.id, db)).ok) {
            throw new StoryError('Join or create a firm with posting access before publishing.', 403);
          }
          if (input.articleReviewed !== true) throw new StoryError('Review the finished article before publishing.');
          try { editActivityDraft(definition, revision.blocks); } catch { throw new StoryError('Prepare and review the article before publishing.'); }
          changes = { ...changes, approvedBy: { connect: { id: userId } }, approvedAt: new Date(), publishedAt: new Date(), consentScope: 'feed_only' };
          await db.editorialStory.update({ where: { id }, data: { status: 'published', publishedRevisionNumber: revision.number } });
        }
      }
    }
    const saved = await db.editorialStoryRevision.update({ where: { id: revision.id }, data: changes, include: includeRevision });
    const final = await db.editorialStory.update({ where: { id }, data: { updatedAt: new Date() } });
    return snapshot(final, saved, data.context);
  }, { isolationLevel: 'Serializable' });
}

/** Public reads use only the approved published pointer and currently public source projects. */
export async function publicStory(slug: string) {
  const story = await prisma.editorialStory.findFirst({ where: { slug, status: 'published', format: { not: 'expertise' } }, include: { owner: { select: { id: true, name: true, profileImage: true, brandProfile: { select: { logoImageUrl: true } } } },
    publishedRevision: { include: { sources: { include: { projectPost: { select: { status: true, updatedAt: true, expandedBlocks: true, project: { select: { id: true, isPublic: true } } } } } } } } } });
  const revision = story?.publishedRevision;
  if (!story || !revision?.approvedAt || !revision.publishedAt || revision.sources.some(s => s.projectPost.status !== 'PUBLISHED' || !s.projectPost.project.isPublic ||
    s.sourceDigest !== hash([s.projectPost.project.id, s.projectPost.updatedAt.toISOString(), s.projectPost.expandedBlocks]))) return null;
  const brief = (revision.interview as unknown as ActivityDefinition | null)?.brief;
  let projectImageUrl: string | null | undefined = brief?.subject === 'project' ? null : undefined;
  if (brief?.subject === 'project' && typeof brief.projectId === 'string' &&
    (brief.roomId === undefined || typeof brief.roomId === 'string') &&
    revision.sources.some(source => source.projectPost.project.id === brief.projectId)) {
    const project = await prisma.project.findFirst({ where: { id: brief.projectId, isPublic: true, post: { status: 'PUBLISHED' } },
      select: { images: { where: { inclusion: 'INCLUDED', ...(brief.roomId ? { roomId: brief.roomId } : {}) },
        select: { url: true }, orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }], take: 1 } } });
    projectImageUrl = project?.images[0]?.url || null;
  }
  return { title: revision.title, draft: revision.blocks as unknown as ActivityDraft, owner: story.owner, slug: story.slug, projectImageUrl };
}
