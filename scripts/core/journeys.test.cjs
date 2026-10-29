const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const h = require('./harness.cjs');
const { memoryDatabase } = require('./memory-db.cjs');
const { factories } = require('./fixtures.cjs');
const { PrismaClient } = require('@prisma/client');

async function journeys(t, database) {
  h.useDatabase(database);
  const db = h.facade, f = factories(db), r = h.request;
  const signup = h.route('auth/signup'), diagnostic = h.route('onboarding/diagnostic');
  const state = h.route('onboarding/state'), firm = h.route('onboarding/firm/enroll');
  const enrollment = h.route('auth/org-setup');
  const bio = h.route('onboarding/bio/commit'), preview = h.route('onboarding/profile-preview/complete');
  const workspace = h.route('user/workspace-context');
  const projects = h.route('projects'), detail = h.route('projects/[id]');
  const rooms = h.route('projects/[id]/rooms'), images = h.route('projects/[id]/images');
  const tagging = h.route('tag-product-to-image'), init = h.route('posting/project/[projectId]/init');
  const status = h.route('posting/project/[projectId]/status');
  const context = id => ({ params: { id } }), editorial = projectId => ({ params: { projectId } });
  const { middleware } = require(resolve('middleware.ts'));
  let owner, orgId, projectId, room, image, product, tag;
  const body = async (response, expected = 200) => {
    const data = await response.json(); assert.equal(response.status, expected, JSON.stringify(data)); return data;
  };
  await t.test('1 signup, credentials, signed cookie, designer onboarding and subsequent authenticated request', async () => {
    h.anonymous();
    assert.equal((await state.GET()).status, 401);
    const email = `${randomUUID()}@core.test`, password = 'Core fixture password 42!';
    const input = { name: 'Core Designer', email, password, acceptedTerms: true };
    const response = await signup.POST(r(input));
    const created = await body(response, 202);
    assert.equal(created.verificationRequired, true);
    assert.equal(await db.user.findFirst({ where: { email } }), null, 'Pending signup must not create a usable account');
    const verification = h.authOptions.providers.find(p => p.options?.id === 'email-verification').options.authorize;
    const code = h.emails.at(-1).html.match(/>(\d{6})</)[1];
    const verified = await verification({ code }, { headers: { cookie: response.headers.get('set-cookie').split(';')[0] } });
    assert.equal((await signup.POST(r({ ...input, email: email.toUpperCase() }))).status, 400);
    const saved = await db.user.findUniqueOrThrow({ where: { id: verified.id } });
    assert.equal(saved.role, 'INDIVIDUAL'); assert.equal(saved.accountStatus, 'APPROVED'); assert.ok(saved.emailVerifiedAt);
    assert.notEqual(saved.passwordHash, password); assert.ok(saved.tosAcceptedAt); assert.ok(saved.privacyAcceptedAt);
    const provider = h.authOptions.providers.find(p => p.id === 'credentials' && !p.options?.id);
    const authorize = provider.options.authorize;
    assert.equal(await authorize({ email, password: 'incorrect' }, { headers: {} }), null);
    owner = await authorize({ email, password }, { headers: {} }); assert.equal(owner.id, saved.id);
    let signed = await h.login(owner);
    assert.equal(signed.session.user.id, owner.id);
    assert.equal(new URL((await middleware(signed.request)).headers.get('location')).pathname, '/onboarding/diagnostic');
    assert.equal((await body(await state.GET())).completed, false);
    const intent = await body(await diagnostic.POST(r({ role: 'DESIGNER' })));
    const destination = new URL(intent.nextPath, 'http://folio.test');
    assert.equal(destination.pathname, '/auth/org-setup'); assert.equal(destination.searchParams.get('type'), 'designer');
    await h.login(owner);
    assert.equal((await body(await state.GET())).role, 'INDIVIDUAL', 'professional intent cannot grant a role');
    assert.equal((await projects.POST(r({ title: 'Too early', projectStatus: 'new_project' }))).status, 403);
    assert.equal((await firm.POST(r({ mode: 'solo' }))).status, 410, 'retired creator cannot create a firm');
    const existingFirm = await f.organization({ name: 'Existing other firm' });
    assert.equal((await firm.POST(r({ mode: 'join', organizationId: existingFirm.id }))).status, 403);
    assert.equal(await db.organizationUser.count({ where: { userId: owner.id } }), 0);
    assert.equal((await enrollment.POST(r({ name: 'Core Designer Studio', type: 'designer' }))).status, 400);
    orgId = (await body(await enrollment.POST(r({ name: 'Core Designer Studio', type: 'designer', confirmed: true })), 201)).organizationId;
    const membership = await db.organizationUser.findFirst({ where: { userId: owner.id, organizationId: orgId } });
    assert.equal(membership.role, 'OWNER'); assert.equal(membership.isActive, true);
    const firmRecord = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
    assert.equal(firmRecord.status, 'CLAIMED'); assert.equal(firmRecord.verifiedAt, null);
    assert.equal((await body(await state.GET())).nextStep, 'done', 'profile enrichment is optional after firm setup');
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).operatingAsOrgId, orgId);
    await h.login(owner);
    assert.equal((await body(await bio.POST(r({ bio: 'I design rooms around daylight and daily use.', specialties: ['Residential'] })))).nextPath, '/onboarding/profile-preview');
    await body(await preview.POST());
    const complete = await body(await state.GET());
    assert.equal(complete.completed, true); assert.equal(complete.resumePath, '/');
    for (const timestamp of Object.values(complete.timestamps)) assert.ok(timestamp);
    const user = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
    assert.equal(user.role, 'DESIGNER'); assert.equal(user.bio, 'I design rooms around daylight and daily use.');
    signed = await h.login(owner); assert.equal((await middleware(signed.request)).headers.get('location'), null);
    await body(await workspace.POST(r({ operatingAsOrgId: orgId })));
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).operatingAsOrgId, orgId);
  });
  await t.test('2 create project, room, image upload and product tag; canonical readback preserves relationships', async () => {
    await h.login(owner);
    const creation = { title: 'Core House', projectStatus: 'new_project', designerOrgId: orgId, requestId: randomUUID() };
    projectId = (await body(await projects.POST(r(creation)), 201)).id;
    assert.match(projectId, /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    assert.equal((await body(await projects.POST(r(creation)), 200)).id, projectId, 'lost creation acknowledgement reuses the project');
    assert.equal(await db.project.count({ where: { id: projectId } }), 1);
    const saved = await db.project.findUniqueOrThrow({ where: { id: projectId } });
    assert.equal(saved.ownerId, owner.id); assert.equal(saved.designerId, owner.id); assert.equal(saved.designerOrgId, orgId); assert.equal(saved.isPublic, false);
    room = await body(await rooms.POST(r({ name: 'Living Room', requestId: require('node:crypto').randomUUID() }), context(projectId)));
    image = (await body(await images.POST(r({ name: 'Room photo', room: room.name, imageData: 'dGVzdC1pbWFnZQ==', mimeType: 'image/png' }), context(projectId)), 201)).image;
    assert.equal(image.projectId, projectId); assert.equal(image.room, room.name);
    const { assignImageToRoom } = require(resolve('src/app/actions/projectImages.ts'));
    await assignImageToRoom({ imageId: image.id, roomId: room.id });
    assert.equal((await db.projectImage.findUniqueOrThrow({ where: { id: image.id } })).roomId, room.id);
    const userCount = await db.user.count();
    const createdProduct = await body(await h.route('designer/products').POST(r({
      name: 'Core Chair', vendorName: 'Core Workshop', url: 'https://product.test/chair',
      imageUrl: 'https://storage.test/chair.png',
    })));
    product = await db.product.findUniqueOrThrow({ where: { id: createdProduct.productId } });
    assert.equal(product.brand, 'Core Workshop'); assert.equal(product.vendorId, null);
    assert.equal(await db.user.count(), userCount);
    tag = await body(await tagging.POST(r({ projectId, imageId: image.id, productId: product.id, x: 0.25, y: 0.75, createSelection: true, finishRaw: 'Oak', finishConfirmed: true, deduplicate: true })));
    const persisted = await db.productTag.findFirst({ where: { imageId: image.id, productId: product.id } });
    assert.ok(persisted); assert.equal(persisted.x, 0.25); assert.equal(persisted.y, 0.75); assert.equal(persisted.finishRaw, 'Oak');
    tag = persisted;
    const replayTag = await body(await tagging.POST(r({ projectId, imageId: image.id, productId: product.id, x: 0.25, y: 0.75, createSelection: true, finishRaw: 'Oak', finishConfirmed: true, deduplicate: true })));
    assert.equal(replayTag.id, tag.id);
    assert.equal(await db.selection.count({ where: { productTagId: tag.id } }), 1);
    const selection = await db.selection.findFirst({ where: { productTagId: tag.id } });
    assert.equal(selection.projectId, projectId); assert.equal(selection.roomId, room.id);
    const reloaded = await body(await projects.GET(r(undefined, 'GET', '/api/projects?mine=true')));
    const own = reloaded.find(p => p.id === projectId), photo = own.images.find(i => i.id === image.id);
    assert.equal(own.designerId, owner.id); assert.equal(photo.noProducts, false);
    assert.deepEqual(photo.tags.map(t => [t.id, t.product.id, t.x, t.y]), [[tag.id, product.id, 0.25, 0.75]]);
    const expected = { imageId: image.id, x: 0.25, y: 0.75 };
    const firstMove = { id: tag.id, x: 30, y: 40, expected };
    await body(await tagging.PATCH(r(firstMove, 'PATCH')));
    await body(await tagging.PATCH(r(firstMove, 'PATCH'))); // uncertain-result replay
    assert.equal((await tagging.PATCH(r({ id: tag.id, x: 60, y: 70, expected }, 'PATCH'))).status, 409);
    assert.equal((await db.productTag.findUniqueOrThrow({ where: { id: tag.id } })).x, 30);

    assert.equal((await body(await detail.GET(r(), context(projectId)))).rooms[0].id, room.id);
  });
  await t.test('3 direct owner/stranger requests and canonical organization write authorization', async () => {
    h.anonymous(); assert.equal((await detail.GET(r(), context(projectId))).status, 401);
    const stranger = await f.user(); await h.login(stranger);
    assert.equal((await detail.GET(r(), context(projectId))).status, 403);
    assert.equal((await projects.PUT(r({ id: projectId, title: 'Stolen' }, 'PUT'))).status, 403);
    assert.equal((await tagging.POST(r({ projectId, imageId: image.id, productId: product.id, x: 0.9, y: 0.9 }))).status, 403);
    assert.equal((await init.POST(r({}), editorial(projectId))).status, 403);
    assert.equal((await status.PATCH(r({ action: 'publish' }, 'PATCH'), editorial(projectId))).status, 403);
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: projectId } })).title, 'Core House');
    assert.equal(await db.productTag.count({ where: { imageId: image.id } }), 1);
    const { assertProjectWrite } = require(resolve('src/lib/authz/access.ts'));
    const member = await f.user(); await f.membership(member.id, orgId, { role: 'VIEWER' });
    await db.projectParticipant.create({ data: { projectId, userId: member.id, role: 'VIEWER', side: 'DESIGNER' } });
    await h.login(member);
    assert.equal((await detail.GET(r(), context(projectId))).status, 200);
    assert.equal((await projects.PUT(r({ id: projectId, title: 'Viewer edit' }, 'PUT'))).status, 403);
    await assert.rejects(assertProjectWrite(member.id, projectId), /Forbidden/);
    await db.organizationUser.updateMany({ where: { userId: member.id, organizationId: orgId }, data: { role: 'MEMBER' } });
    await assertProjectWrite(member.id, projectId);
    await h.login(member); await body(await projects.PUT(r({ id: projectId, title: 'Member edit' }, 'PUT')));
    await h.login(owner); await body(await projects.PUT(r({ id: projectId, title: 'Core House Revised' }, 'PUT')));
    assert.equal((await body(await detail.GET(r(), context(projectId)))).title, 'Core House Revised');
  });
  await t.test('4 saved interview, real deterministic generation, review/publication and public slug identity', async () => {
    await h.login(owner);
    await body(await init.POST(r({}), editorial(projectId)));
    const first = await db.projectPost.findUniqueOrThrow({ where: { projectId } });
    await body(await init.POST(r({}), editorial(projectId)));
    assert.equal((await db.projectPost.findUniqueOrThrow({ where: { projectId } })).id, first.id);
    const interview = h.route('posting/project/[projectId]/interview');
    const answers = ['We moved the doorway to bring the garden into view.', 'The oak chair gives us a place to read in the afternoon.', 'The room is arranged around a quiet route through the house.'].map((answer, i) => ({ questionId: `core-q-${i}`, question: 'What changed in this room?', answer, section: 'designIntent', role: 'DESIGNER', roomId: room.id }));
    await body(await interview.POST(r({ answers, selectedQuestionIds: answers.map(a => a.questionId) }), editorial(projectId)));
    const read = await db.projectPost.findUniqueOrThrow({ where: { projectId } });
    assert.deepEqual(read.provenance.interview.payload.answers.map(a => a.answer), answers.map(a => a.answer));
    const projection = await db.editorialInterview.findUnique({ where: { projectId }, include: { answers: true } });
    assert.equal(projection.answers.length, 3);
    const narrative = 'The doorway now faces the garden. A chair sits beside the opening, leaving a clear route through the room. The designer arranged this place for reading in afternoon light. The change follows the daily pattern described in the interview.';
    h.setArticle({ lead: { title: 'A Door Opens Toward the Garden', kicker: 'A Door Opens Toward the Garden', deck: 'A changed doorway brings afternoon reading closer to the garden.' }, sections: [0, 1, 2].map(() => ({ type: 'narrative', heading: 'Living Room', body: narrative })), galleryChapters: [{ title: 'Living Room', imageIds: [image.id], body: [narrative, narrative] }], pullQuotes: [], credits: [] });
    const beforeGeneration = h.modelCalls.length;
    const generationRoute = h.route('posting/project/[projectId]/interview/generate');
    const locked = { ...read.provenance, interview: { ...read.provenance.interview, status: { phase: 'generating', startedAt: Date.now(), requestId: 'other-writer' } } };
    await db.projectPost.update({ where: { projectId }, data: { provenance: locked } });
    assert.equal((await generationRoute.POST(r({ forceOverwriteDraft: true, includeBio: false, includeProjectHistory: false }), editorial(projectId))).status, 202, 'force must not bypass another generator');
    assert.equal(h.modelCalls.length, beforeGeneration);
    locked.interview.status.startedAt = Date.now() - 900000;
    await db.projectPost.update({ where: { projectId }, data: { provenance: locked } });

    await body(await h.route('posting/project/[projectId]/interview/generate').POST(r({ force: true, includeBio: false, includeProjectHistory: false }), editorial(projectId)));
    const draft = await db.projectPost.findUniqueOrThrow({ where: { projectId } });
    assert.equal(draft.id, first.id); assert.equal(draft.status, 'DRAFT'); assert.ok(draft.expandedBlocks.galleryChapters.length);
    assert.ok(h.modelCalls.length > beforeGeneration); assert.equal(draft.provenance.interview.payload.answers.length, 3); assert.ok(draft.provenance.interview.generatedAt);
    const { getPostBySlug } = require(resolve('src/lib/post/getPostBySlug.ts'));
    assert.equal(await getPostBySlug(draft.slug), null);
    const act = action => status.PATCH(r({ action }, 'PATCH'), editorial(projectId));
    await body(await act('submit')); await body(await act('submit'));
    assert.equal((await db.projectPost.findUniqueOrThrow({ where: { projectId } })).status, 'REVIEW');
    assert.ok((await act('publish')).status >= 400);
    const admin = await f.user({ role: 'ADMIN' }); await h.login(admin);
    const review = await db.projectPost.findUniqueOrThrow({ where: { projectId } });
    const approve = () => status.PATCH(r({ action: 'approve', expectedUpdatedAt: review.updatedAt.toISOString() }, 'PATCH'), editorial(projectId));
    await body(await approve()); const published = await db.projectPost.findUniqueOrThrow({ where: { projectId } });
    assert.equal(published.status, 'PUBLISHED');
    await body(await approve());
    assert.equal((await db.projectPost.findUniqueOrThrow({ where: { projectId } })).publishedAt.toISOString(), published.publishedAt.toISOString());
    const publicPost = await getPostBySlug(published.slug); assert.equal(publicPost.id, first.id); assert.equal(publicPost.project.isPublic, true);
    assert.equal(published.provenance.interview.payload.answers.length, 3);
    assert.equal(published.provenance.editorialReview.reviewedBy, admin.id);
    await h.login(owner); await body(await act('unpublish'));
    assert.equal(await getPostBySlug(published.slug), null);
    const privateProject = await db.project.findUniqueOrThrow({ where: { id: projectId } }); assert.equal(privateProject.isPublic, false); assert.equal(privateProject.publishedAt, null);
  });
  await t.test('5 mounted vendor collaboration invitation, designer acceptance, readback and unrelated vendor isolation', async () => {
    const vendor = await f.user({ role: 'VENDOR' }), vendorOrg = await f.organization({ type: 'VENDOR', vendorTier: 'PROFESSIONAL' });
    await f.membership(vendor.id, vendorOrg.id);
    const stories = h.route('collaboration/stories'), storyRoute = h.route('collaboration/stories/[id]');
    await h.login(vendor);
      const invite = { designerUserId: owner.id, taggedProjectId: projectId, taggedProductIds: [product.id], vendorOrgId: 'spoofed-organization', vendorUserId: owner.id };
    const created = await body(await stories.POST(r(invite)), 201);
    const story = created.story || created;
    assert.equal(story.vendorOrgId, vendorOrg.id); assert.equal(story.designerUserId, owner.id); assert.equal(story.taggedProjectId, projectId);
    assert.equal((await stories.POST(r(invite))).status, 409);
    const stranger = await f.user({ role: 'VENDOR' }), otherOrg = await f.organization({ type: 'VENDOR', vendorTier: 'PROFESSIONAL' }); await f.membership(stranger.id, otherOrg.id);
    await h.login(stranger);
    assert.equal((await storyRoute.GET(r(), context(story.id))).status, 403);
    assert.equal((await storyRoute.PATCH(r({ title: 'Stolen' }, 'PATCH'), context(story.id))).status, 403);
    await h.login(owner);
    await body(await h.route('collaboration/stories/[id]/respond').POST(r({ response: 'ACCEPT' }), context(story.id)));
    await h.login(vendor);
    const accepted = await body(await storyRoute.GET(r(), context(story.id)));
    assert.notEqual(accepted.title, 'Stolen');
    assert.equal(accepted.status, 'ACCEPTED'); assert.ok(accepted.acceptedAt); assert.equal(accepted.taggedProjectId, projectId);
    await body(await storyRoute.PATCH(r({ title: 'A shared project story' }, 'PATCH'), context(story.id)));
    const list = await body(await stories.GET(r(undefined, 'GET', '/api/collaboration/stories')));
    assert.equal(list.stories.find(s => s.id === story.id).title, 'A shared project story');
  });
  await t.test('6 guided interview with correction, canonical evidence and private editable draft', async () => {
    await h.login(owner);
    const guidedProject = await f.project(owner.id, { title: 'Guided Garden House', designerOrgId: orgId });
    const reading = await f.room(guidedProject.id, { name: 'Reading Room' });
    const dining = await f.room(guidedProject.id, { name: 'Dining Room' });
    const photos = [
      await f.image(guidedProject.id, { roomId: reading.id, room: reading.name, inclusion: 'INCLUDED' }),
      await f.image(guidedProject.id, { roomId: dining.id, room: dining.name, inclusion: 'INCLUDED' }),
    ];
    const guided = h.route('posting/project/[projectId]/interview/guided');
    const routeContext = editorial(guidedProject.id), expected = new Map();
    const previousFlag = process.env.NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW;
    process.env.NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW = '1';
    let session;
    const send = async command => {
      session = (await body(await guided.POST(r({ requestId: randomUUID(), version: session?.version ?? 0, ...command }), routeContext))).session;
      return session;
    };
    const recordAnswer = async (question, text, action = 'answer') => {
      const linkedImageId = photos.find(photo => photo.roomId === question.roomId)?.id ?? photos[0].id;
      expected.set(question.id, { prompt: question.text, answer: text, roomId: question.roomId, linkedImageId });
      await send({ action, questionId: question.id, text, selectedImageId: linkedImageId, inputModality: 'text' });
    };
    try {
      // The existing provider double returns no project plan and incomplete room
      // wording, so the actual preparers must retain every required fallback slot.
      h.setArticle({});
      await send({ action: 'start' });
      assert.equal(session.plan.length, 5); assert.equal(session.roomsPrepared, false);
      const opening = session.plan[0];
      for (let index = 0; index < 5; index++) {
        const question = session.plan.find(q => q.id === session.activeQuestionId);
        assert.equal(question.roomId, null);
        await recordAnswer(question, `Project answer ${index + 1}: We opened the route to the garden so the family could read together in afternoon light.`);
      }
      assert.equal(session.roomsPrepared, true); assert.equal(session.plan.length, 11);
      const original = session.turns.find(turn => turn.questionId === opening.id);
      await recordAnswer(opening, '  The clients wanted a quiet reading place.\nWe opened the route toward the garden for afternoon use.  ', 'correct');
      const correction = session.turns.find(turn => turn.supersedes === original.id);
      assert.ok(correction); assert.equal(session.turns.find(turn => turn.id === original.id).supersededBy, correction.id);
      for (const question of session.plan.filter(q => q.roomId !== null)) {
        assert.deepEqual(question.sourceAnswerIds, [], 'neutral fallback room questions do not invent answer dependencies');
        assert.deepEqual(question.sourceImageIds, photos.filter(photo => photo.roomId === question.roomId).map(photo => photo.id));
      }
      for (let index = 0; index < 6; index++) {
        const question = session.plan.find(q => q.id === session.activeQuestionId);
        assert.ok(question?.roomId);
        const name = question.roomId === reading.id ? reading.name : dining.name;
        await recordAnswer(question, `${name} answer ${index + 1}: The layout gives the family a clear route to the garden. We kept the center open because they use this room together every afternoon.`);
      }
      assert.equal(session.status, 'ready');
      await send({ action: 'finish' }); assert.equal(session.status, 'finished');
      const saved = await db.projectPost.findUniqueOrThrow({ where: { projectId: guidedProject.id } });
      assert.equal(saved.provenance.interview.payload.answers.length, expected.size);
      const assertEvidence = post => {
        assert.deepEqual(post.provenance.interview.guided, session, 'generation must retain the entire saved session and correction history');
        for (const answer of post.provenance.interview.payload.answers) {
          const raw = expected.get(answer.questionId);
          assert.equal(post.provenance.interview.guided.turns.find(turn => turn.questionId === answer.questionId && !turn.supersededBy).text, raw.answer);
          assert.deepEqual({ prompt: answer.prompt, answer: answer.answer, roomId: answer.roomId, linkedImageId: answer.linkedImageId }, { ...raw, answer: raw.answer.trim() });
          assert.equal(answer.questionSource, 'base_question'); assert.equal(answer.inputModality, 'text');
        }
      };
      assertEvidence(saved);
      const projection = await db.editorialInterview.findUniqueOrThrow({ where: { projectId: guidedProject.id }, include: { answers: true } });
      assert.equal(projection.answers.length, expected.size); assert.equal(projection.status, 'COMPLETED');
      for (const answer of projection.answers) {
        const raw = expected.get(answer.questionId);
        assert.deepEqual({ prompt: answer.questionText, answer: answer.answerText, roomId: answer.roomId, linkedImageId: answer.linkedImageId }, { ...raw, answer: raw.answer.trim() });
      }
      const narrative = 'Afternoon light reaches the garden-facing doorway. A clear route through the room leaves space for the family to gather. The designer arranged the room around these daily routines. The change follows the project direction described in the interview.';
      h.setArticle({
        lead: { title: 'Rooms Opening Toward the Garden', kicker: 'Rooms Opening Toward the Garden', deck: 'An open route connects two rooms with the family garden.' },
        sections: [reading, dining, reading].map(room => ({ type: 'narrative', heading: room.name, body: narrative })),
        galleryChapters: [reading, dining].map(room => ({ title: room.name, imageIds: photos.filter(photo => photo.roomId === room.id).map(photo => photo.id), body: [narrative, narrative] })),
        pullQuotes: [], credits: [],
      });
      const beforeGeneration = h.modelCalls.length;
      await body(await h.route('posting/project/[projectId]/interview/generate').POST(r({ force: true, includeBio: false, includeProjectHistory: false }), routeContext));
      const draft = await db.projectPost.findUniqueOrThrow({ where: { projectId: guidedProject.id } });
      assert.equal(draft.id, saved.id); assert.equal(draft.status, 'DRAFT'); assert.ok(draft.provenance.interview.generatedAt);
      assert.ok(h.modelCalls.length > beforeGeneration); assertEvidence(draft);
      for (const key of ['answers', 'followups', 'selectedQuestionIds'])
        assert.deepEqual(draft.provenance.interview.payload[key], saved.provenance.interview.payload[key]);
      for (const room of [reading, dining]) {
        const chapter = draft.expandedBlocks.galleryChapters.find(chapter => chapter.roomId === room.id);
        assert.ok(chapter, `${room.name} must have an editable chapter`); assert.ok(chapter.body.some(paragraph => paragraph.includes('garden')));
        assert.ok(chapter.body.every(paragraph => !paragraph.trim().startsWith('{')), 'the fixture must yield article prose, not raw provider JSON');
        assert.deepEqual(chapter.imageIds, photos.filter(photo => photo.roomId === room.id).map(photo => photo.id));
      }
      const { getPostForStaging } = require(resolve('src/lib/post/getPostForStaging.ts'));
      const { getPostBySlug } = require(resolve('src/lib/post/getPostBySlug.ts'));
      assert.equal((await getPostForStaging(guidedProject.id)).id, saved.id);
      assert.equal(await getPostBySlug(draft.slug), null);
      assert.equal((await db.project.findUniqueOrThrow({ where: { id: guidedProject.id } })).isPublic, false);
      assert.deepEqual((await body(await guided.GET(r(), routeContext))).session, session);
    } finally {
      if (previousFlag === undefined) delete process.env.NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW;
      else process.env.NEXT_PUBLIC_FLAG_GUIDED_INTERVIEW = previousFlag;
    }
  });
  await new Promise(setImmediate);
  assert.deepEqual(h.unexpectedNetwork, [], 'No unmocked external request is permitted, even when application code catches it');
}

test('CORE LOCAL/CI — real orchestration with deterministic database double (not persistence proof)', t => journeys(t, memoryDatabase()));
test('DATABASE JOURNEYS — all six journeys against disposable Prisma transaction', { skip: !h.target && 'LIVE DATABASE TEST NOT EXECUTED — CORE_TEST_DATABASE_URL unavailable', timeout: 180000 }, async t => {
  const db = new PrismaClient({ datasources: { db: { url: h.target } } });
  const rollback = new Error('ROLLBACK_CORE_FIXTURES');
  try {
    await assert.rejects(db.$transaction(async tx => { await journeys(t, tx); throw rollback; }, { timeout: 150000 }), error => error === rollback);
  } finally { await db.$disconnect(); }
});
