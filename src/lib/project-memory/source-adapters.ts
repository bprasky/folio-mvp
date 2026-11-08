import 'server-only';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';
import { buildPrivateDigest, type ProjectEvidence, type PrivateProjectDigest } from './digest';

const LIMIT = 30;
const clean = (value: string | null | undefined, max = 1000) => (value || '').trim().slice(0, max);

/**
 * Private, read-only, bounded project digest. Never return media URLs, client
 * details, private image bytes or raw source objects. Permission is checked on
 * every call, including for unpublished projects.
 */
export async function loadPrivateProjectDigest(actorId: string, projectId: string): Promise<PrivateProjectDigest> {
  if (!actorId || !projectId) throw new Error('Forbidden');
  await assertProjectWrite(actorId, projectId);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true, title: true,
      files: { select: { id: true, fileName: true, fileType: true, dateUploaded: true }, orderBy: { dateUploaded: 'desc' }, take: LIMIT },
      images: { select: { id: true, name: true, roomId: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: LIMIT },
      editorialInterviews: {
        select: { answers: { select: { questionId: true, isFollowUp: true, answerText: true, roomId: true, createdAt: true },
          orderBy: { createdAt: 'desc' }, take: LIMIT } },
        take: 1,
      },
      designerDecisions: { select: { id: true, decisionType: true, reasoning: true, outcomeNotes: true, createdAt: true },
        orderBy: { createdAt: 'desc' }, take: LIMIT },
      selectionHistory: { select: { id: true, action: true, reasonCategory: true, reasonNotes: true, roomId: true, changedAt: true },
        orderBy: { changedAt: 'desc' }, take: LIMIT },
    },
  });
  if (!project) throw new Error('NotFound');
  const evidence: ProjectEvidence[] = [];
  for (const answer of project.editorialInterviews?.answers || []) {
    const text = clean(answer.answerText);
    if (!text) continue;
    const id = `interview:${projectId}:${answer.questionId}:${answer.isFollowUp ? 'followup' : 'base'}`;
    evidence.push({ id, sourceId: id, kind: 'interview', recordedAt: answer.createdAt.toISOString(),
      occurredAtBasis: 'recorded', roomId: answer.roomId || undefined, text, attribution: 'direct' });
  }
  for (const decision of project.designerDecisions) {
    const text = clean([decision.decisionType, decision.reasoning, decision.outcomeNotes].filter(Boolean).join(' — '));
    if (!text) continue;
    evidence.push({ id: `decision:${decision.id}`, sourceId: decision.id, kind: 'decision',
      recordedAt: decision.createdAt.toISOString(), occurredAtBasis: 'recorded', text, attribution: 'direct' });
  }
  for (const change of project.selectionHistory) {
    const text = clean([change.action, change.reasonCategory, change.reasonNotes].filter(Boolean).join(' — '));
    evidence.push({ id: `selection_change:${change.id}`, sourceId: change.id, kind: 'selection_change',
      recordedAt: change.changedAt.toISOString(), occurredAtBasis: 'recorded',
      roomId: change.roomId || undefined, text, attribution: change.reasonNotes ? 'direct' : 'structured' });
  }
  for (const file of project.files) {
    evidence.push({ id: `file:${file.id}`, sourceId: file.id, kind: 'file',
      recordedAt: file.dateUploaded.toISOString(), occurredAtBasis: 'recorded',
      text: clean(`Uploaded ${file.fileType} file: ${file.fileName}`, 250), attribution: 'metadata' });
  }
  for (const image of project.images) {
    evidence.push({ id: `image:${image.id}`, sourceId: image.id, kind: 'image',
      recordedAt: image.createdAt.toISOString(), occurredAtBasis: 'recorded',
      roomId: image.roomId || undefined,
      text: clean(image.name ? `Uploaded photo: ${image.name}` : 'Uploaded project photo', 250), attribution: 'metadata' });
  }
  return buildPrivateDigest({
    projectId, title: project.title, evidence,
    limitations: [
      'Dates are record/upload timestamps, not verified dates of project events.',
      'File and image entries contain metadata only; their contents have not been interpreted.',
      'This is a bounded source sample, not a complete project history.',
      'No source has been approved for public publication by this digest.',
    ],
  });
}
