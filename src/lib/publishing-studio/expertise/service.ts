import 'server-only';
import { expertiseEnabled } from './flag';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canPublishFromOrg } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rateLimit';
import { StudioAccessError } from '../data';
import { answerSession, createSession, readyToDraft, validateArticle } from './engine';
import { composeExpertiseArticle, discoverExpertise, nextExpertiseQuestion } from './generation';
import { changedEvidence, digest, expertiseSources, object, portfolioEvidence, requireExpertise } from './sources';
import { articleOf, candidateId, discoveryState, saveDiscoveryState, EXPERTISE_KIND, includeRevision, interviewOf, json, ownedExpertise, saveOpportunity, storedOpportunities, storyId, type ExpertiseInterview } from './store';
import type { ExpertiseArticle, ExpertiseOpportunity } from './types';

const publicUrl = (slug: string) => `/expertise/${slug}`;
const fail = (message: string, status = 400): never => { throw new StudioAccessError(message, status); };
const modelError = () => 'Your answer is saved. Folio could not prepare the next question. Try Continue again.';
function sanitizedOpportunity(opportunity: ExpertiseOpportunity, fresh: Awaited<ReturnType<typeof expertiseSources>>) {
  return { ...opportunity, evidence: opportunity.evidence.map(e => fresh.evidence.some(f => f.id === e.id && f.imageUrl === e.imageUrl && f.revision === e.revision) ? e : { ...e, imageUrl: undefined }) };
}
async function snapshot(actor: string, id: string, context?: { fresh: Awaited<ReturnType<typeof expertiseSources>>; owned: Awaited<ReturnType<typeof ownedExpertise>>; events: { candidateId: string; kind: string; payload: Prisma.JsonValue }[] }) {
  const [owned, fresh] = context ? [context.owned, context.fresh] : await Promise.all([ownedExpertise(actor, id), expertiseSources(actor)]);
  const { story, revision, identity } = owned; const interview = interviewOf(revision); const article = articleOf(revision);
  const changes = changedEvidence(interview.opportunity.evidence, fresh.evidence);
  const featured = context ? context.events.find(e => e.candidateId === interview.opportunity.id && e.kind === 'expertise_feature') : await prisma.studioCandidateEvent.findFirst({ where: { candidateId: interview.opportunity.id, kind: 'expertise_feature' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const safeArticle = article ? { ...article, featured: featured ? object(featured.payload).featured === true : article.featured, media: article.media.filter(m => fresh.evidence.some(e => e.assetId === m.assetId && e.imageUrl === m.url)) } : null;
  const published = story.publishedRevisionNumber === revision.number;
  const exportEvents = context ? context.events.filter(e => e.candidateId === interview.opportunity.id && e.kind === 'expertise_export').slice(0,30) : await prisma.studioCandidateEvent.findMany({ where: { candidateId: interview.opportunity.id, kind: 'expertise_export' }, orderBy: { createdAt: 'desc' }, take: 30 });
  return { id, version: revision.editVersion, revisionNumber: revision.number, opportunity: sanitizedOpportunity(interview.opportunity, fresh), session: interview.session,
    article: safeArticle, status: story.status === 'withdrawn' ? 'archived' as const : published ? 'published' as const : article ? 'review' as const : 'interview' as const,
    publishedUrl: story.publishedRevisionNumber !== null && await publicExpertise(story.slug) ? publicUrl(story.slug) : null,
    sourceChanges: changes, identity, availableEvidence: fresh.evidence.filter(e => interview.opportunity.projectIds.includes(e.projectId)), exports: changes.length ? [] : exportEvents.map(e => object(e.payload).derivative).filter(d => d && Array.isArray(d.images) && d.images.every((image: ExpertiseArticle['media'][number]) => fresh.evidence.some(e => e.assetId === image.assetId && e.imageUrl === image.url && e.visibility === 'public'))) };
}
export type ExpertiseSnapshot = Awaited<ReturnType<typeof snapshot>>;

export async function listExpertise(actor: string) {
  requireExpertise();
  const fresh = await expertiseSources(actor); const stored = await storedOpportunities(actor, fresh.workspace.id);
  const stories = await prisma.editorialStory.findMany({ where: { ownerId: actor, organizationId: fresh.workspace.id, format: 'expertise' }, include: { revisions: { orderBy: { number: 'desc' }, take: 1, include: includeRevision } }, orderBy: { updatedAt: 'desc' }, take: 100 });
  const events = await prisma.studioCandidateEvent.findMany({ where: { candidateId: { in: stories.flatMap(s => s.revisions[0] ? [interviewOf(s.revisions[0]).opportunity.id] : []) }, kind: { in: ['expertise_feature','expertise_export'] } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1000 });
  const work = await Promise.all(stories.filter(s => s.revisions[0]).map(s => snapshot(actor, s.id, { fresh, owned: { story: s, revision: s.revisions[0], identity: fresh.identity, workspace: fresh.workspace }, events })));
  const used = new Set(work.map(s => s.opportunity.id));
  const current = stored.filter(s => s.opportunity.state === 'active' && !changedEvidence(s.opportunity.evidence, fresh.evidence).length);
  const cache = await discoveryState(actor, fresh.workspace.id);
  return { enabled: true as const, identity: fresh.identity, opportunities: current.filter(s => !used.has(s.opportunity.id)).map(s => s.opportunity).slice(0, 3), work: work.filter(s => s.status !== 'archived'), projects: fresh.projects, selectableEvidence: fresh.evidence.filter(e => e.assetId && e.imageUrl),
    discovery: { status: cache?.status === 'processing' && Date.now() - cache.updatedAt.getTime() < 300000 ? 'processing' : cache?.status === 'error' ? 'error' : !cache ? 'not_started' : cache.signature !== fresh.signature ? 'changed' : current.length ? 'current' : 'empty',
      message: cache?.status === 'error' ? 'Folio could not retrieve the comparison. Your saved work is unchanged. Try again.' : fresh.projects.length < 2 ? 'Choose another relevant project to explore how your approach changes between homes.' : undefined } };
}

export async function discoverOpportunities(actor: string, selected?: unknown, topic?: unknown) {
  requireExpertise(); const fresh = await expertiseSources(actor);
  const rawIds = selected === undefined ? fresh.projects.map(p => p.id) : selected;
  if (!Array.isArray(rawIds) || rawIds.some(id => typeof id !== 'string' || !fresh.projects.some(p => p.id === id))) fail('Choose projects from this workspace.');
  const ids = rawIds as string[];
  if (ids.length < 2) fail('Choose at least two relevant projects.');
  const intent = typeof topic === 'string' ? topic.trim().slice(0, 300) : undefined;
  const cache = await discoveryState(actor, fresh.workspace.id);
  if (cache?.status === 'processing' && Date.now() - cache.updatedAt.getTime() < 300000) return listExpertise(actor);
  if (cache && ['current','empty'].includes(cache.status) && cache.signature === fresh.signature && digest(cache.projectIds) === digest(ids) && (cache.topic || undefined) === intent) return listExpertise(actor);
  const stored = await storedOpportunities(actor, fresh.workspace.id);
  const limit = await checkRateLimit(`studio-expertise-discovery:${actor}:${fresh.workspace.id}`, { max: 3, windowMs: 60 * 60 * 1000 });
  if (!limit.success) fail('Your work was recently reviewed. Try again later.', 429);
  const evidence = fresh.evidence.filter(e => ids.includes(e.projectId));
  await saveDiscoveryState(actor, fresh.workspace.id, { status: 'processing', signature: fresh.signature, projectIds: ids, topic: intent });
  let proposals: ExpertiseOpportunity[];
  try { proposals = await discoverExpertise(evidence, stored.map(s => s.opportunity), intent); }
  catch (error) { await saveDiscoveryState(actor, fresh.workspace.id, { status: 'error', signature: fresh.signature, projectIds: ids, topic: intent }); throw error; }
  const latest = await expertiseSources(actor);
  if (latest.workspace.id !== fresh.workspace.id || latest.signature !== fresh.signature) fail('Your source work changed during discovery. Refresh to review the current work.', 409);
  for (const proposal of proposals) {
    const opportunity = { ...proposal, id: candidateId(actor, fresh.workspace.id, proposal.id) };
    if (stored.some(s => s.opportunity.id === opportunity.id)) continue;
    await saveOpportunity(actor, fresh.workspace.id, opportunity, fresh.signature, null, 'generated');
  }
  await saveDiscoveryState(actor, fresh.workspace.id, { status: proposals.length ? 'current' : 'empty', signature: fresh.signature, projectIds: ids, topic: intent });
  return { ...await listExpertise(actor), discovery: { status: proposals.length ? 'current' as const : 'empty' as const, message: proposals.length ? undefined : 'No strong connection found in this selection. Choose other projects or add more project context.' } };
}

export async function dismissOpportunity(actor: string, id: string, reason?: unknown) {
  requireExpertise(); const fresh = await expertiseSources(actor); const stored = await storedOpportunities(actor, fresh.workspace.id);
  const row = stored.find(s => s.opportunity.id === id); if (!row) fail('Opportunity not found.', 404);
  await saveOpportunity(actor, fresh.workspace.id, { ...row!.opportunity, state: 'dismissed' }, row!.corpus, row!.version, 'dismissed', typeof reason === 'string' ? reason.slice(0, 1000) : undefined);
  return listExpertise(actor);
}

/** Intentional comparisons can begin with uncertain photographs; they never become asserted recommendations. */
export async function compareExamples(actor: string, evidenceIds: unknown, topic?: unknown) {
  requireExpertise(); const fresh = await expertiseSources(actor);
  if (!Array.isArray(evidenceIds) || evidenceIds.length < 2 || evidenceIds.length > 6 || evidenceIds.some(id => typeof id !== 'string')) fail('Choose exact photographs from at least two projects.');
  const selected = fresh.evidence.filter(e => (evidenceIds as string[]).includes(e.id) && e.assetId && e.imageUrl);
  const projectIds = Array.from(new Set(selected.map(e => e.projectId))).sort();
  if (selected.length !== new Set(evidenceIds as string[]).size || projectIds.length < 2) fail('Choose accessible project photographs from two distinct projects.');
  const intention = typeof topic === 'string' ? topic.trim().slice(0,300) : '';
  const thesis = intention ? `What shaped your choices about ${intention}?` : 'What connects these choices, and what makes each project different?';
  const id = candidateId(actor, fresh.workspace.id, digest(['manual', selected.map(e => e.id).sort(), intention]));
  const stored = await storedOpportunities(actor, fresh.workspace.id);
  const previous = stored.find(s => s.opportunity.id === id);
  if (!previous) {
    const context = fresh.evidence.filter(e => projectIds.includes(e.projectId) && e.kind !== 'observation' && selected.some(image => image.projectId === e.projectId && (!image.roomId || image.roomId === e.roomId)));
    const evidence = [...selected, ...context.slice(0,12)];
    const opportunity: ExpertiseOpportunity = { id, thesis, readerBenefit: 'Help clients understand the judgment behind these choices.', comparisonType: 'designer_selected', projectIds, evidence,
      gaps: ['Confirm what the photographs show and whether this comparison is useful.'], qualification: ['The designer selected these exact examples; their connection has not been assumed.'],
      ranking: { evidence: 0, specificity: 0, clientValue: 0, novelty: 0, effort: 0 }, sourceSignature: digest(evidence.map(e => [e.id,e.revision,e.visibility])), state: 'active' };
    await saveOpportunity(actor, fresh.workspace.id, opportunity, fresh.signature, null, 'selected');
  } else if (previous.opportunity.state !== 'active') {
    await saveOpportunity(actor, fresh.workspace.id, { ...previous.opportunity, state: 'active' }, fresh.signature, previous.version, 'restored');
  }
  return startExpertise(actor, id);
}

export async function startExpertise(actor: string, opportunityId: string) {
  requireExpertise(); const fresh = await expertiseSources(actor); const stored = await storedOpportunities(actor, fresh.workspace.id);
  const row = stored.find(s => s.opportunity.id === opportunityId); if (!row || row.opportunity.state !== 'active') fail('Opportunity not found.', 404);
  const id = storyId(actor, fresh.workspace.id, opportunityId);
  if (await prisma.editorialStory.findUnique({ where: { id }, select: { id: true } })) return snapshot(actor, id);
  if (changedEvidence(row!.opportunity.evidence, fresh.evidence).length) fail('The examples changed. Refresh this opportunity before starting.', 409);
  const interview: ExpertiseInterview = { kind: EXPERTISE_KIND, opportunity: row!.opportunity, session: createSession(row!.opportunity), operations: [], derivatives: [] };
  try {
    await prisma.$transaction(async db => {
      const current = await expertiseSources(actor, db);
      if (current.workspace.id !== fresh.workspace.id || changedEvidence(row!.opportunity.evidence, current.evidence).length) fail('Your source work changed. Refresh.', 409);
      await db.editorialStory.create({ data: { id, ownerId: actor, organizationId: fresh.workspace.id, slug: id, format: 'expertise', status: 'draft',
        revisions: { create: { number: 1, title: row!.opportunity.thesis, interview: json(interview), blocks: {},
          sources: { create: fresh.posts.filter(p => row!.opportunity.projectIds.includes(p.projectId)).map(p => ({ projectPostId: p.projectPostId, sourceDigest: p.sourceDigest })) } } } } });
      await event(db, actor, fresh.workspace.id, row!.opportunity, `${id}:started`, 'started');
    }, { isolationLevel: 'Serializable' });
  } catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error; }
  return snapshot(actor, id);
}

export async function recordExpertiseImpressions(actor: string, ids: unknown) {
  requireExpertise(); if (!Array.isArray(ids) || ids.length > 3 || ids.some(id => typeof id !== 'string')) fail('Choose displayed opportunities.');
  const fresh = await expertiseSources(actor); const stored = await storedOpportunities(actor, fresh.workspace.id);
  await prisma.$transaction(async db => {
    const current = await expertiseSources(actor, db);
    if (current.workspace.id !== fresh.workspace.id) fail('Your workspace changed.', 409);
    for (const id of ids as string[]) {
      const opportunity = stored.find(s => s.opportunity.id === id)?.opportunity;
      if (!opportunity || opportunity.state !== 'active' || changedEvidence(opportunity.evidence, current.evidence).length) continue;
      await event(db, actor, fresh.workspace.id, opportunity, `impression:${digest([actor, opportunity.id, opportunity.sourceSignature])}`, 'impression');
    }
  });
  return { recorded: true };
}
export async function readExpertise(actor: string, id: string) { requireExpertise(); return snapshot(actor, id); }

async function event(db: Prisma.TransactionClient, actor: string, workspace: string | null, opportunity: ExpertiseOpportunity, key: string, kind: string, payload: unknown = {}) {
  const candidate = await db.studioCandidate.findFirst({ where: { id: opportunity.id, designerId: actor, organizationId: workspace }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
  if (!candidate?.versions[0]) return;
  await db.studioCandidateEvent.upsert({ where: { id: key }, create: { id: key, candidateId: candidate.id, version: candidate.currentVersion, sourceVersion: candidate.versions[0].sourceVersion, kind: `expertise_${kind}`, payload: json(payload) }, update: {} });
}

export async function changeExpertise(actor: string, id: string, body: unknown): Promise<ExpertiseSnapshot & { error?: string }> {
  requireExpertise(); const input = object(body);
  const actions = ['answer','correct','skip','continue','confirm','compose','edit','publish','feature','archive','export','replace'];
  if (!actions.includes(input.action) || !Number.isInteger(input.expectedVersion)) fail('Choose a valid article action and saved version.');
  const operation = digest([id, input]);
  let generated: ExpertiseArticle | null = null;
  if (input.action === 'compose') {
    const saved = await ownedExpertise(actor, id); const interview = interviewOf(saved.revision);
    const existingArticle = articleOf(saved.revision);
    if (existingArticle && existingArticle.thesisRevision === interview.session.thesisRevision) return snapshot(actor, id);
    if (saved.revision.editVersion !== input.expectedVersion) fail('This article changed. Reload.', 409);
    const fresh = await expertiseSources(actor);
    if (changedEvidence(interview.opportunity.evidence, fresh.evidence).length) fail('Review the changed source examples before composing.', 409);
    if (!(await checkRateLimit(`studio-expertise-compose:${actor}`, { max: 6, windowMs: 60 * 60 * 1000 })).success) fail('Your interview is saved. Please wait before composing another version.', 429);
    // Provider work stays outside the transaction; failed generation preserves the last saved session.
    generated = await composeExpertiseArticle(interview.opportunity, interview.session);
  }
  if (input.action === 'feature') {
    if (typeof input.featured !== 'boolean') fail('Choose whether to feature this article.');
    await prisma.$transaction(async db => {
      await db.$queryRaw`SELECT id FROM editorial_stories WHERE id=${id} FOR UPDATE`;
      const owned = await ownedExpertise(actor, id, db);
      if (await db.studioCandidateEvent.findUnique({ where: { id: operation }, select: { id: true } })) return;
      if (owned.revision.editVersion !== input.expectedVersion) fail('This article changed. Reload.', 409);
      if (!articleOf(owned.revision)) fail('Compose an article before choosing its profile presentation.');
      await event(db, actor, owned.workspace.id, interviewOf(owned.revision).opportunity, operation, 'feature', { featured: input.featured });
      // Concurrency token advances, while approved prose and media remain immutable.
      await db.editorialStoryRevision.update({ where: { id: owned.revision.id }, data: { editVersion: { increment: 1 } } });
    }, { isolationLevel: 'Serializable' });
    return snapshot(actor, id);
  }
  if (input.action === 'export') {
    await prisma.$transaction(async db => {
      await db.$queryRaw`SELECT id FROM editorial_stories WHERE id=${id} FOR UPDATE`;
      const owned = await ownedExpertise(actor, id, db); const interview = interviewOf(owned.revision); const article = articleOf(owned.revision);
      if (owned.revision.editVersion !== input.expectedVersion) fail('This article changed. Reload.', 409);
      if (!article || (!owned.revision.approvedAt && input.reviewed !== true)) fail('Review this article version before exporting.');
      const fresh = await expertiseSources(actor, db);
      if (changedEvidence(interview.opportunity.evidence, fresh.evidence).length || interview.opportunity.evidence.some(e => e.visibility !== 'public')) fail('Review changed or private evidence before exporting.', 409);
      validateArticle(article!, interview.opportunity, interview.session);
      const derivative = { id: `export_${operation.slice(0,32)}`, revision: owned.revision.number, articleVersion: owned.revision.editVersion, title: article!.title,
        caption: [article!.title, ...article!.claims.map(c => c.text)].join('\n\n'), mediaIds: article!.media.map(m => m.assetId), images: article!.media, createdAt: new Date().toISOString() };
      await event(db, actor, fresh.workspace.id, interview.opportunity, operation, 'export', { derivative });
    }, { isolationLevel: 'Serializable' });
    return snapshot(actor, id);
  }
  let runNext = false;
  await prisma.$transaction(async db => {
    await db.$queryRaw`SELECT id FROM editorial_stories WHERE id=${id} FOR UPDATE`;
    const owned = await ownedExpertise(actor, id, db); let revision = owned.revision;
    let interview = structuredClone(interviewOf(revision)); let article = articleOf(revision);
    if (interview.operations.includes(operation)) return;
    if (revision.editVersion !== input.expectedVersion) fail('This article changed in another tab. Reload before saving.', 409);
    if (owned.story.status === 'withdrawn') fail('This article is archived.', 409);
    const fresh = await expertiseSources(actor, db);
    const changes = changedEvidence(interview.opportunity.evidence, fresh.evidence);
    if (changes.length && ['compose','publish','continue','confirm'].includes(input.action)) fail('Source evidence changed. Replace or review the affected examples; your answers remain saved.', 409);
    // Approved article versions and their derivatives never change in place.
    if (revision.approvedAt && input.action === 'publish') {
      return;
    } else if (revision.approvedAt || (input.action === 'compose' && article && article.thesisRevision !== interview.session.thesisRevision)) {
      revision = await db.editorialStoryRevision.create({ data: { storyId: id, number: revision.number + 1, title: revision.title,
        editVersion: revision.editVersion, interview: json(interview), blocks: article ? json({ kind: EXPERTISE_KIND, article: { ...article, reviewed: false } }) : {},
        sources: { create: revision.sources.map(s => ({ projectPostId: s.projectPostId, sourceDigest: s.sourceDigest })) },
        answers: { create: revision.answers.map(a => ({ promptId: a.promptId, questionText: a.questionText, answerText: a.answerText, answeredById: a.answeredById, answeredAt: a.answeredAt })) } }, include: includeRevision });
      if (article) article = { ...article, reviewed: false };
    }
    if (['answer','correct','skip','confirm'].includes(input.action)) {
      if (input.evidenceIds !== undefined && (!Array.isArray(input.evidenceIds) || input.evidenceIds.some((key: unknown) => typeof key !== 'string' || !interview.opportunity.evidence.some(e => e.id === key)))) fail('Choose evidence from this comparison.');
      if (input.action === 'confirm' && interview.session.nextQuestion?.purpose !== 'confirm') fail('Finish the interview before confirming the framing.');
      const question = interview.session.nextQuestion;
      interview.session = answerSession(interview.session, typeof input.text === 'string' ? input.text : input.action === 'confirm' ? 'I confirm that this framing and these examples represent my view.' : '', { skip: input.action === 'skip', correction: input.action === 'correct', evidenceIds: input.evidenceIds });
      const answer = interview.session.answers[interview.session.answers.length - 1];
      await db.editorialStoryAnswer.upsert({ where: { revisionId_promptId: { revisionId: revision.id, promptId: answer.questionId } },
        create: { revisionId: revision.id, promptId: answer.questionId, questionText: question!.text, answerText: answer.text, answeredById: actor }, update: { answerText: answer.text, answeredById: actor, answeredAt: new Date() } });
      if (article) article = { ...article, reviewed: false };
      runNext = !changes.length;
    } else if (input.action === 'continue') runNext = !interview.session.nextQuestion;
    else if (input.action === 'compose') {
      // A retry never replaces hand-edited prose, including after an interrupted response.
      if (!article || article.thesisRevision !== interview.session.thesisRevision) article = generated;
    } else if (input.action === 'replace') {
      if (!Array.isArray(input.evidenceIds) || !input.evidenceIds.length) fail('Choose replacement evidence.');
      const selected = fresh.evidence.filter(e => input.evidenceIds.includes(e.id) && interview.opportunity.projectIds.includes(e.projectId));
      if (selected.length !== new Set(input.evidenceIds).size || new Set(selected.map(e => e.projectId)).size < 2) fail('Keep supported examples from at least two projects.');
      const old = interview.opportunity.evidence;
      interview.opportunity = { ...interview.opportunity, evidence: selected, sourceSignature: digest(selected.map(e => [e.id,e.revision,e.visibility])) };
      const affected = old.filter(e => !selected.some(f => f.id === e.id && f.revision === e.revision)).map(e => e.id);
      interview.session.answers = interview.session.answers.map(a => a.evidenceIds.some(e => affected.includes(e)) ? { ...a, invalidated: true } : a);
      interview.session.thesisRevision += 1;
      interview.session.coverage = { ...interview.session.coverage, confirmed: false, gaps: ['Review the replacement examples and confirm the comparison.'] };
      interview.session.nextQuestion = null; interview.session.status = 'interview';
      if (article) article = { ...article, reviewed: false };
    } else if (input.action === 'edit') {
      if (!article) fail('Compose the article before editing it.');
      article = validateArticle(input.article, interview.opportunity, interview.session);
      if (!['project','portrait','logo'].includes(article.cover)) fail('Choose a supported cover.');
      const coverUrl = article.cover === 'portrait' ? fresh.identity.portraitUrl : article.cover === 'logo' ? fresh.identity.logoUrl : undefined;
      if (article.cover !== 'project' && !coverUrl) fail('Choose an available portrait or logo, or use a project photograph.');
      article = { ...article, coverUrl, reviewed: false };
    } else if (input.action === 'publish') {
      if (!fresh.workspace.id || !(await canPublishFromOrg(actor, fresh.workspace.id, db)).ok) {
        fail('Join or create a firm with posting access before publishing.', 403);
      }
      if (!article) fail('Compose and review the article first.');
      validateArticle(article!, interview.opportunity, interview.session);
      if (input.reviewed !== true && !revision.approvedAt) fail('Review this article version before publishing or exporting.');
      const used = new Set([...article!.claims.flatMap(c => c.evidenceIds), ...(article!.introductionEvidenceIds || []), ...(article!.titleEvidenceIds || []), ...article!.media.map(m => m.evidenceId)]);
      if (interview.opportunity.evidence.some(e => used.has(e.id) && e.visibility !== 'public')) fail('Publish the source project or replace the private evidence before sharing.');
      article = { ...article!, reviewed: true };
      await db.editorialStoryRevision.update({ where: { id: revision.id }, data: { answersReviewedAt: new Date(), approvedById: actor, approvedAt: new Date(), publishedAt: new Date(), consentScope: 'feed_only' } });
      await db.editorialStory.update({ where: { id }, data: { status: 'published', publishedRevisionNumber: revision.number } });
    } else if (input.action === 'archive') await db.editorialStory.update({ where: { id }, data: { status: 'withdrawn' } });
    interview.operations = [...interview.operations, operation].slice(-100);
    await db.editorialStoryRevision.update({ where: { id: revision.id }, data: { editVersion: { increment: 1 }, title: article?.title || interview.session.thesis, interview: json(interview), blocks: article ? json({ kind: EXPERTISE_KIND, article }) : {} } });
    await db.editorialStory.update({ where: { id }, data: { updatedAt: new Date() } });
    await event(db, actor, fresh.workspace.id, interview.opportunity, operation, input.action);
  }, { isolationLevel: 'Serializable' });
  if (runNext) {
    const saved = await ownedExpertise(actor, id); const interview = interviewOf(saved.revision);
    try {
      if (!(await checkRateLimit(`studio-expertise-followup:${actor}`, { max: 60, windowMs: 60 * 60 * 1000 })).success) fail('Your answer is saved. Please wait before continuing.', 429);
      const session = readyToDraft(interview.session, interview.opportunity) ? { ...interview.session, status: 'ready' as const, nextQuestion: null } : await nextExpertiseQuestion(interview.opportunity, interview.session);
      await prisma.$transaction(async db => {
        await db.$queryRaw`SELECT id FROM editorial_stories WHERE id=${id} FOR UPDATE`;
        const current = await ownedExpertise(actor, id, db); const fresh = await expertiseSources(actor, db);
        if (current.revision.editVersion !== saved.revision.editVersion || changedEvidence(interview.opportunity.evidence, fresh.evidence).length) fail('Your saved work or evidence changed. Reload before continuing.', 409);
        await db.editorialStoryRevision.update({ where: { id: current.revision.id }, data: { editVersion: { increment: 1 }, interview: json({ ...interview, session }) } });
      }, { isolationLevel: 'Serializable' });
    } catch { return { ...await snapshot(actor, id), error: modelError() }; }
  }
  return snapshot(actor, id);
}

/** Public reads never trust persisted URLs or the owner's currently selected workspace. */
export async function publicExpertise(slug: string) {
  if (!expertiseEnabled()) return null;
  const story = await prisma.editorialStory.findFirst({ where: { slug, format: 'expertise', status: 'published' }, include: { owner: { select: { id: true, name: true, profileImage: true, brandProfile: { select: { logoImageUrl: true } } } }, publishedRevision: { include: includeRevision } } });
  const revision = story?.publishedRevision;
  if (!story || !revision?.approvedAt || !revision.publishedAt) return null;
  const interview = interviewOf(revision); const article = articleOf(revision); if (!article || interview.kind !== EXPERTISE_KIND) return null;
  if (article.cover === 'portrait' && article.coverUrl !== story.owner.profileImage || article.cover === 'logo' && article.coverUrl !== story.owner.brandProfile?.logoImageUrl) return null;
  const fresh = await portfolioEvidence(story.ownerId, story.organizationId);
  if (changedEvidence(interview.opportunity.evidence, fresh.evidence).length) return null;
  try { validateArticle(article, interview.opportunity, interview.session); } catch { return null; }
  if (article.media.some(m => !fresh.evidence.some(e => e.id === m.evidenceId && e.visibility === 'public' && e.assetId === m.assetId && e.imageUrl === m.url))) return null;
  const used = new Set([...article.claims.flatMap(c => c.evidenceIds), ...(article.introductionEvidenceIds || []), ...(article.titleEvidenceIds || [])]);
  if (interview.opportunity.evidence.some(e => used.has(e.id) && e.visibility !== 'public')) return null;
  const featured = await prisma.studioCandidateEvent.findFirst({ where: { candidateId: interview.opportunity.id, kind: 'expertise_feature' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  return { id: story.id, slug: story.slug, title: article.title, article: { ...article, featured: featured ? object(featured.payload).featured === true : article.featured }, owner: { id: story.owner.id, name: story.owner.name }, publishedAt: revision.publishedAt.toISOString() };
}
export async function publishedExpertise(userId: string) {
  if (!expertiseEnabled()) return [];
  const rows = await prisma.editorialStory.findMany({ where: { ownerId: userId, format: 'expertise', status: 'published' }, select: { slug: true }, orderBy: { updatedAt: 'desc' }, take: 24 });
  return (await Promise.all(rows.map(row => publicExpertise(row.slug)))).filter((row): row is NonNullable<typeof row> => row !== null);
}
