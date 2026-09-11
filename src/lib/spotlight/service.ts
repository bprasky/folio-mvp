import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { can, isOrgRole } from '@/lib/orgPermissions';
import { spotlightEnabled, SpotlightConflict } from './gate';
import { SPOTLIGHT_POLICY, spotlightWording } from '@/lib/interview/prompts/spotlight';
import { rebuildAnswerProjection, type ProjectionAnswer } from '@/lib/editorial/syncInterviewAnswers';

type Tx = Prisma.TransactionClient;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (code: string, message: string, status = 409): never => { throw new SpotlightConflict(code, message, status); };
// Legacy provenance is heterogeneous JSON. Read and merge it only under the
// project mutex; durable definitions/text never derive from this projection.
type JsonRecord = Record<string, any>;
const record = (v: unknown): JsonRecord => v && typeof v === 'object' && !Array.isArray(v) ? v as JsonRecord : {};

async function authority(tx: Tx, projectId: string, actorId: string) {
  if (!spotlightEnabled(projectId, actorId)) fail('SPOTLIGHT_UNAVAILABLE', 'Private spotlight interviews are not enabled for this account and project.', 403);
  await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`;
  const p = await tx.project.findUnique({ where: { id: projectId }, select: { id: true, ownerId: true, designerId: true, designerOrgId: true, status: true } });
  if (!p || p.status === 'archived') fail('PROJECT_UNAVAILABLE', 'Project is unavailable.', 404);
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${actorId} FOR SHARE`;
  const actor = await tx.user.findUnique({ where: { id: actorId }, select: { accountStatus: true } });
  if (!actor || actor.accountStatus !== 'APPROVED') fail('FORBIDDEN', 'Publisher access is required.', 403);
  if (p.designerOrgId) {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${p.designerOrgId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM organization_users WHERE "userId" = ${actorId} AND "organizationId" = ${p.designerOrgId} FOR SHARE`;
    const m = await tx.organizationUser.findUnique({ where: { userId_organizationId: { userId: actorId, organizationId: p.designerOrgId } }, select: { isActive: true, role: true } });
    if (!m?.isActive || !isOrgRole(m.role) || !can(m.role, 'create_and_edit_projects')) fail('FORBIDDEN', 'Current studio editing permission is required.', 403);
  } else if ((p.designerId || p.ownerId) !== actorId) fail('FORBIDDEN', 'Current publishing designer access is required.', 403);
  return { publisherUserId: p.designerOrgId ? null : p.designerId || p.ownerId, publisherOrgId: p.designerOrgId };
}

export type SpotlightCommand =
  | { action: 'resume' | 'schedule' | 'rebuild' }
  | { action: 'select'; tagId: string; selected: boolean; expectedSelectionVersion?: number }
  | { action: 'followup'; questionId: string }
  | { action: 'accept'; questionId: string; questionVersion: number; currentAnswerNumber: number | null; text: string; requestKey: string; stateVersion: number; selectionVersion: number; inputModality: 'TEXT' | 'VOICE' | 'MIXED'; reuseRevisionId?: string; confirmReuse?: boolean }
  | { action: 'ordinary'; questionId: string; text: string; expectedVersion: number; requestKey: string };

async function sources(tx: Tx, projectId: string) {
  // Source mutations/deletions must serialize with the validity check and save.
  await tx.$queryRaw`SELECT t.id FROM product_tags t JOIN project_images i ON i.id = t."imageId" WHERE i."projectId" = ${projectId} ORDER BY t.id FOR SHARE OF t, i`;
  await tx.$queryRaw`SELECT id FROM rooms WHERE "projectId" = ${projectId} ORDER BY id FOR SHARE`;
  return tx.productTag.findMany({ where: { image: { projectId } }, select: {
    id: true, productId: true, finishRaw: true, finishConfirmed: true,
    image: { select: { roomId: true, inclusion: true } },
    product: { select: { name: true } },
  } });
}

export async function runSpotlight(projectId: string, actorId: string, command: SpotlightCommand) {
  for (let attempt = 0; ; attempt++) {
    try { return await spotlightTransaction(projectId, actorId, command); }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * 40));
    }
  }
}

async function spotlightTransaction(projectId: string, actorId: string, command: SpotlightCommand) {
  return prisma.$transaction(async tx => {
    const publisher = await authority(tx, projectId, actorId);
    const tags = await sources(tx, projectId);
    const rooms = await tx.room.findMany({ where: { projectId }, select: { id: true, name: true } });
    await tx.$queryRaw`SELECT id FROM product_spotlights WHERE project_id = ${projectId} ORDER BY id FOR UPDATE`;
    if (command.action === 'select') {
      const tag = tags.find(t => t.id === command.tagId);
      if (!tag) fail('SOURCE_NOT_FOUND', 'That photo tag is no longer available.', 404);
      const finish = tag.finishConfirmed ? (tag.finishRaw || '').trim().normalize('NFC') : '';
      if (finish.length > 160) fail('FINISH_TOO_LONG', 'Confirm a finish of at most 160 characters.', 400);
      const link = await tx.productSpotlightTag.findUnique({ where: { tagId: tag.id }, include: { spotlight: true } });
      const scope = { projectId, productId: tag.productId, roomId: tag.image.roomId, ...publisher, variant: '', finish };
      let s = tag.image.roomId ? await tx.productSpotlight.findFirst({ where: scope }) : link?.spotlight;
      if (s && (s.projectId !== projectId || s.productId !== tag.productId || s.publisherUserId !== publisher.publisherUserId || s.publisherOrgId !== publisher.publisherOrgId || s.roomId !== tag.image.roomId)) s = null;
      if (!s && !command.selected) fail('STALE_SELECTION', 'Reload the shared selection before changing it.');
      if (s && command.expectedSelectionVersion !== undefined && command.expectedSelectionVersion !== s.selectionVersion) fail('STALE_SELECTION', 'Selection changed in another session. Reload before changing it.');
      if (!s) s = await tx.productSpotlight.create({ data: { ...scope, selectedById: actorId, isSelected: true } });
      else if (s.isSelected !== command.selected) s = await tx.productSpotlight.update({ where: { id: s.id }, data: { isSelected: command.selected, selectionVersion: { increment: 1 }, selectedById: actorId, selectedAt: new Date() } });
      // Link every confirmed duplicate source. Unresolved photos are independent
      // until explicit selection after room confirmation reconciles their link.
      const matching = tag.image.roomId ? tags.filter(t => t.productId === tag.productId && t.image.roomId === tag.image.roomId && (t.finishConfirmed ? (t.finishRaw || '').trim().normalize('NFC') : '') === finish) : [tag];
      for (const source of matching) await tx.productSpotlightTag.upsert({ where: { tagId: source.id }, create: { tagId: source.id, spotlightId: s.id }, update: { spotlightId: s.id } });
    }
    const spotlights = await tx.productSpotlight.findMany({ where: { projectId }, include: { sourceTags: true } });
    const eligible = new Set(spotlights.filter(s => s.isSelected && s.publisherUserId === publisher.publisherUserId && s.publisherOrgId === publisher.publisherOrgId && s.roomId && rooms.some(r => r.id === s.roomId) && s.sourceTags.some(link => tags.some(t => t.id === link.tagId && t.productId === s.productId && t.image.roomId === s.roomId && t.image.inclusion === 'INCLUDED' && (t.finishConfirmed ? (t.finishRaw || '').trim().normalize('NFC') : '') === s.finish))).map(s => s.id));
    await tx.$queryRaw`SELECT q.id FROM spotlight_questions q JOIN product_spotlights s ON s.id = q.spotlight_id WHERE s.project_id = ${projectId} ORDER BY q.id FOR UPDATE OF q`;
    let allQuestions = await tx.spotlightQuestion.findMany({ where: { spotlight: { projectId } }, orderBy: { questionVersion: 'asc' } });
    for (const q of allQuestions) {
      const s = spotlights.find(s => s.id === q.spotlightId)!;
      if (!eligible.has(s.id) && !q.retiredAt) await tx.spotlightQuestion.update({ where: { id: q.id }, data: { retiredAt: new Date(), retiredReason: s.isSelected ? 'NO_VALID_SOURCE' : 'DESELECTED', stateVersion: { increment: 1 } } });
      if (eligible.has(s.id) && q.retiredAt && ['NO_VALID_SOURCE', 'DESELECTED'].includes(q.retiredReason || '')) {
        const base = allQuestions.find(base => base.spotlightId === s.id && base.kind === 'BASE');
        const parent = q.parentAnswerRevisionId ? await tx.spotlightAnswerRevision.findUnique({ where: { id: q.parentAnswerRevisionId }, select: { questionId: true, revisionNumber: true } }) : null;
        const sameMeaning = q.kind === 'BASE' ? q.meaningKey === hash([SPOTLIGHT_POLICY, s.id, s.productId, s.roomId, s.publisherUserId, s.publisherOrgId, s.variant, s.finish]) : parent?.questionId === base?.id && parent?.revisionNumber === base?.currentAnswerNumber;
        if (sameMeaning) await tx.spotlightQuestion.update({ where: { id: q.id }, data: { retiredAt: null, retiredReason: null, stateVersion: { increment: 1 } } });
      }
    }
    allQuestions = await tx.spotlightQuestion.findMany({ where: { spotlight: { projectId } }, orderBy: { questionVersion: 'asc' } });
    if (command.action === 'schedule') {
      for (const s of spotlights.filter(s => eligible.has(s.id))) {
        const meaningKey = hash([SPOTLIGHT_POLICY, s.id, s.productId, s.roomId, s.publisherUserId, s.publisherOrgId, s.variant, s.finish]);
        const existing = allQuestions.find(q => q.spotlightId === s.id && q.kind === 'BASE' && q.meaningKey === meaningKey);
        if (existing) continue;
        for (const q of allQuestions.filter(q => q.spotlightId === s.id && !q.retiredAt)) await tx.spotlightQuestion.update({ where: { id: q.id }, data: { retiredAt: new Date(), retiredReason: 'SCOPE_CHANGED', stateVersion: { increment: 1 } } });
        const product = tags.find(t => t.productId === s.productId)!;
        await tx.spotlightQuestion.create({ data: { spotlightId: s.id, kind: 'BASE', questionVersion: Math.max(0, ...allQuestions.filter(q => q.spotlightId === s.id && q.kind === 'BASE').map(q => q.questionVersion)) + 1, meaningKey, contextSnapshot: { productId: s.productId, roomId: s.roomId, variant: s.variant, finish: s.finish, ...publisher }, wording: spotlightWording(product.product.name, rooms.find(r => r.id === s.roomId)!.name), promptVersion: SPOTLIGHT_POLICY, policyVersion: SPOTLIGHT_POLICY } });
      }
    }
    if (command.action === 'followup') {
      const parent = allQuestions.find(q => q.id === command.questionId && q.kind === 'BASE' && !q.retiredAt);
      if (!parent || !eligible.has(parent.spotlightId) || !parent.currentAnswerNumber) fail('INELIGIBLE', 'Save an answer to a selected piece before requesting a follow-up.');
      const answer = await tx.spotlightAnswerRevision.findUniqueOrThrow({ where: { questionId_revisionNumber: { questionId: parent.id, revisionNumber: parent.currentAnswerNumber } } });
      const previous = allQuestions.filter(q => q.spotlightId === parent.spotlightId && q.kind === 'FOLLOW_UP');
      if (!previous.some(q => q.parentAnswerRevisionId === answer.id)) {
        for (const q of previous.filter(q => !q.retiredAt)) await tx.spotlightQuestion.update({ where: { id: q.id }, data: { retiredAt: new Date(), retiredReason: 'PARENT_REANSWERED', stateVersion: { increment: 1 } } });
        const s = spotlights.find(s => s.id === parent.spotlightId)!;
        await tx.spotlightQuestion.create({ data: { spotlightId: s.id, kind: 'FOLLOW_UP', questionVersion: Math.max(0, ...previous.map(q => q.questionVersion)) + 1, meaningKey: hash([parent.meaningKey, answer.id]), contextSnapshot: parent.contextSnapshot as Prisma.InputJsonValue, wording: spotlightWording(tags.find(t => t.productId === s.productId)!.product.name, rooms.find(r => r.id === s.roomId)!.name, true), promptVersion: SPOTLIGHT_POLICY, policyVersion: SPOTLIGHT_POLICY, parentAnswerRevisionId: answer.id } });
      }
    }
    let receipt: unknown = null;
    if (command.action === 'accept') {
      const q = allQuestions.find(q => q.id === command.questionId);
      if (!q) fail('NOT_FOUND', 'Question is unavailable.', 404);
      const s = spotlights.find(s => s.id === q.spotlightId)!;
      if (s.publisherUserId !== publisher.publisherUserId || s.publisherOrgId !== publisher.publisherOrgId) fail('FORBIDDEN', 'Publishing identity changed.', 403);
      const requestHash = hash([command.questionId, command.questionVersion, command.currentAnswerNumber, command.text, command.stateVersion, command.selectionVersion, command.inputModality, command.reuseRevisionId || null, command.confirmReuse === true]);
      const prior = await tx.spotlightAnswerRevision.findUnique({ where: { questionId_answeringUserId_requestKey: { questionId: q.id, answeringUserId: actorId, requestKey: command.requestKey } } });
      if (prior) {
        if (prior.requestHash !== requestHash) fail('RETRY_CONFLICT', 'This retry key was already used with different content.');
        receipt = prior;
      } else {
        if (!eligible.has(s.id) || q.retiredAt) fail('INELIGIBLE', 'This piece needs selection and a valid photo in its confirmed room. Your unsaved text is retained.');
        if (q.questionVersion !== command.questionVersion || q.currentAnswerNumber !== command.currentAnswerNumber || q.stateVersion !== command.stateVersion || s.selectionVersion !== command.selectionVersion) fail('STALE_ANSWER', 'The answer or selection changed. Reload the saved version; your draft is retained.');
        if (!command.text.trim() || command.text.includes('\0') || Array.from(command.text).length > 50000 || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(command.text)) fail('INVALID_TEXT', 'Enter valid answer text, up to 50,000 characters.', 400);
        let reuse: Awaited<ReturnType<typeof tx.spotlightAnswerRevision.findUnique>> = null;
        if (command.reuseRevisionId) {
          if (!command.confirmReuse) fail('CONFIRM_REUSE', 'Review and explicitly confirm the answer to reuse.', 400);
          reuse = await tx.spotlightAnswerRevision.findFirst({ where: { id: command.reuseRevisionId, question: { spotlight: { projectId, ...publisher } } } });
          if (!reuse || reuse.acceptedText !== command.text) fail('STALE_REUSE', 'The confirmed reuse text does not match the source.');
        }
        const revisionNumber = (q.currentAnswerNumber || 0) + 1;
        receipt = await tx.spotlightAnswerRevision.create({ data: { questionId: q.id, questionVersion: q.questionVersion, revisionNumber, answeringUserId: actorId, acceptedText: command.text, acceptanceSnapshot: { wording: q.wording, context: q.contextSnapshot, sourceTagIds: s.sourceTags.map(t => t.tagId), ...publisher }, inputModality: command.inputModality, acceptanceMode: reuse ? 'CONFIRMED_REUSE' : 'AUTHORED', reusedFromRevisionId: reuse?.id, reuseSnapshot: reuse ? { revisionId: reuse.id, textHash: hash(reuse.acceptedText) } : undefined, requestKey: command.requestKey, requestHash, acceptedStateVersion: q.stateVersion + 1, acceptedSelectionVersion: s.selectionVersion } });
        await tx.spotlightQuestion.update({ where: { id: q.id }, data: { currentAnswerNumber: revisionNumber, stateVersion: { increment: 1 } } });
        for (const child of allQuestions.filter(c => c.spotlightId === s.id && c.kind === 'FOLLOW_UP' && !c.retiredAt && q.kind === 'BASE')) await tx.spotlightQuestion.update({ where: { id: child.id }, data: { retiredAt: new Date(), retiredReason: 'PARENT_REANSWERED', stateVersion: { increment: 1 } } });
      }
    }
    const questions = await tx.spotlightQuestion.findMany({ where: { spotlight: { projectId, ...publisher } }, include: { currentAnswer: true, answers: { orderBy: { revisionNumber: 'asc' } } }, orderBy: { createdAt: 'asc' } });
    const post = await tx.projectPost.findUnique({ where: { projectId }, select: { id: true, provenance: true } });
    const provenance = record(post?.provenance), interview = record(provenance.interview), privateDrafts = record(interview.spotlightDrafts);
    const ordinaryDefinitions = [{ id: 'private-project-intent-v1', wording: 'What did you want this project to make possible?', roomId: null }, ...rooms.map(r => ({ id: `private-room-intent-v1:${r.id}`, wording: `What did you want ${r.name} to feel like?`, roomId: r.id }))];
    const ordinary = record(privateDrafts.ordinary);
    if (command.action === 'ordinary') {
      if (!ordinaryDefinitions.some(q => q.id === command.questionId)) fail('INVALID_QUESTION', 'Choose a current room or project question.', 400);
      if (!command.text.trim() || command.text.includes('\0') || Array.from(command.text).length > 50000) fail('INVALID_TEXT', 'Enter answer text up to 50,000 characters.', 400);
      const previous = record(ordinary[command.questionId]);
      const receipts = record(previous.receipts), key = `${actorId}:${command.requestKey}`, digest = hash([command.text, command.expectedVersion]);
      if (receipts[key] && receipts[key].hash !== digest) fail('RETRY_CONFLICT', 'This retry key was already used with different content.');
      if (!receipts[key]) {
        if ((previous.version || 0) !== command.expectedVersion) fail('STALE_ANSWER', 'This answer changed. Your unsaved text is retained.');
        ordinary[command.questionId] = { text: command.text, version: command.expectedVersion + 1, receipts: { ...receipts, [key]: { hash: digest, version: command.expectedVersion + 1 } } };
      }
      receipt = ordinary[command.questionId];
    }
    if (['accept', 'ordinary', 'rebuild'].includes(command.action)) {
      const existingPayload = record(interview.payload);
      const ordinaryIds = new Set(ordinaryDefinitions.map(q => q.id));
      const ordinaryAnswers = ordinaryDefinitions.filter(q => ordinary[q.id]?.text).map(q => ({ questionId: q.id, prompt: q.wording, answer: ordinary[q.id].text, roomId: q.roomId, questionSource: 'base_question' }));
      const answers = [...(Array.isArray(existingPayload.answers) ? existingPayload.answers.filter((a: JsonRecord) => !ordinaryIds.has(a.questionId || a.id)) : []), ...ordinaryAnswers];
      const fresh = { ...provenance, interview: { ...interview, payload: { ...existingPayload, answers }, spotlightDrafts: { ...privateDrafts, ordinary, heads: questions.map(q => ({ questionId: q.id, revisionNumber: q.currentAnswerNumber })) } } };
      if (post) await tx.projectPost.update({ where: { id: post.id }, data: { provenance: fresh } });
      else await tx.projectPost.create({ data: { projectId, slug: `private-${projectId}`, provenance: fresh } });
      const projection = await tx.editorialInterview.upsert({ where: { projectId }, create: { projectId, selectedQuestionIds: [] }, update: {}, select: { id: true } });
      // Canonical private answers stay in the durable tables. Ordinary projection
      // rebuilds cannot rewrite their IDs, wording, text, or head pointers.
      const privateIds = new Set(questions.map(q => q.id));
      const projectionAnswers = [...answers, ...(Array.isArray(existingPayload.followups) ? existingPayload.followups : [])].filter((a: JsonRecord) => !privateIds.has(a.questionId || a.id));
      await rebuildAnswerProjection(projection.id, projectionAnswers as ProjectionAnswer[], record(interview.audio), tx);
    }
    return { receipt, tags: tags.map(t => ({ id: t.id, productName: t.product.name, roomId: t.image.roomId, spotlightId: spotlights.find(s => s.sourceTags.some(l => l.tagId === t.id))?.id || null })), spotlights: spotlights.map(s => ({ id: s.id, isSelected: s.isSelected, selectionVersion: s.selectionVersion, eligible: eligible.has(s.id), sourceCount: s.sourceTags.length, roomId: s.roomId, needsResolution: s.isSelected && !eligible.has(s.id) })), questions: questions.map(q => ({ ...q, eligible: eligible.has(q.spotlightId) && !q.retiredAt, selectionVersion: spotlights.find(s => s.id === q.spotlightId)!.selectionVersion })), ordinary: ordinaryDefinitions.map(q => ({ ...q, ...record(ordinary[q.id]) })) };
  }, { timeout: 20000 });
}

