const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const h = require('./harness.cjs');
const { memoryDatabase } = require('./memory-db.cjs');
const { factories } = require('./fixtures.cjs');
const { publishPortfolio, unpublishPortfolio, portfolioReviewVersion, hasPortfolioInterviewProgress } = require('../../src/lib/publish/portfolio.ts');
const { editorialProjectVisibility } = require('../../src/lib/publish/portfolioVisibility.ts');
const { transitionEditorial } = require('../../src/lib/editorial/lifecycle.ts');
const { getPublicPortfolio } = require('../../src/lib/project-channel/getPublicPortfolio.ts');

test('photo-first publication, draft privacy, feature lifecycle and explicit withdrawal', async () => {
  const db = memoryDatabase(); h.useDatabase(db); const f = factories(db);
  const owner = await f.user(), stranger = await f.user();
  const org = await f.organization(); await f.membership(owner.id, org.id);
  const project = await f.project(owner.id, { isPublic: false, designerOrgId: org.id });
  const a = await f.image(project.id, { roomId: null, name: 'Living.jpg' });
  const b = await f.image(project.id, { roomId: null, name: 'Outside.jpg' });
  const document = await f.image(project.id, { name: 'Private schedule.pdf' });
  const post = await db.projectPost.create({ data: { projectId: project.id, slug: 'imported-home', status: 'DRAFT', provenance: { websiteImport: {}, interview: { secret: 'PRIVATE_INTERVIEW' } } } });
  const read = () => db.project.findUniqueOrThrow({ where: { id: project.id }, include: { images: true, post: { select: { status: true } } } });
  const input = { projectId: project.id, title: 'Reviewed home', coverImageId: a.id, includedImageIds: [a.id], version: portfolioReviewVersion(await read()) };
  await assert.rejects(publishPortfolio(stranger.id, input), /Forbidden/);
  await assert.rejects(publishPortfolio(owner.id, { ...input, includedImageIds: [document.id], coverImageId: document.id }), /photographs/);
  await assert.rejects(publishPortfolio(owner.id, { ...input, coverImageId: b.id }), /cover/);
  await publishPortfolio(owner.id, input);
  const live = await read();
  assert.equal(live.isPublic, true); assert.ok(live.portfolioPublishedAt);
  assert.equal(live.images.find(photo => photo.id === a.id).roomId, null, 'No invented room assignment');
  assert.equal(live.images.find(photo => photo.id === b.id).inclusion, 'EXCLUDED');
  assert.equal((await db.projectPost.findUnique({ where: { id: post.id } })).status, 'DRAFT');
  const publicProject = await getPublicPortfolio(project.id);
  assert.deepEqual(publicProject.images.map(photo => photo.id), [a.id]);
  assert.equal(publicProject.portfolioCoverImageId, a.id);
  assert.doesNotMatch(JSON.stringify(publicProject), /PRIVATE_INTERVIEW|Private schedule|provenance|websiteImport/);
  await publishPortfolio(owner.id, input);
  const notices = await db.notification.findMany({ where: { type: 'PROJECT_INTERVIEW_INVITATION' } });
  assert.equal(notices.length, 1); assert.equal(notices[0].userId, owner.id);
  assert.match(notices[0].actionUrl, /view=story$/);
  await db.projectPost.update({ where: { id: post.id }, data: { expandedBlocks: { lead: { title: 'Feature' }, galleryChapters: [] } } });
  await assert.rejects(transitionEditorial({ userId: owner.id, projectId: project.id, action: 'publish' }), /Sort every photo/);
  await transitionEditorial({ userId: owner.id, projectId: project.id, action: 'submit' });
  assert.equal((await read()).isPublic, true, 'Review preserves explicitly published photographs');
  const admin = await f.user({ role: 'ADMIN' });
  await transitionEditorial({ userId: admin.id, projectId: project.id, action: 'reject', reason: 'Needs more detail' });
  assert.equal((await read()).isPublic, true, 'Rejected feature remains private while portfolio stays public');
  const room = await f.room(project.id);
  await db.projectImage.update({ where: { id: a.id }, data: { roomId: room.id } });
  await transitionEditorial({ userId: owner.id, projectId: project.id, action: 'publish' });
  assert.equal((await db.notification.findUnique({ where: { id: notices[0].id } })).read, true, 'A published feature resolves its interview invitation');
  await transitionEditorial({ userId: owner.id, projectId: project.id, action: 'unpublish' });
  assert.equal((await read()).isPublic, true, 'Feature withdrawal does not remove separate portfolio consent');
  await unpublishPortfolio(owner.id, project.id);
  assert.equal((await read()).portfolioPublishedAt, null);
  assert.equal(await getPublicPortfolio(project.id), null);
  assert.equal((await db.projectPost.findUnique({ where: { id: post.id } })).status, 'DRAFT');
  assert.equal(h.unexpectedNetwork.length, 0); assert.equal(h.emails.length, 0);
  assert.equal(hasPortfolioInterviewProgress({ websiteImport: {} }), false);
  assert.equal(hasPortfolioInterviewProgress({ interview: { guided: { id: 'saved-guided-session' } } }), true);
  assert.equal(hasPortfolioInterviewProgress({ interview: { payload: { answers: ['saved answer'] } } }), true);
});

test('stale review, ownership, unsupported feature states and legacy withdrawal', async () => {
  const db = memoryDatabase(); h.useDatabase(db); const f = factories(db);
  const owner = await f.user(), other = await f.user();
  const org = await f.organization(); await f.membership(owner.id, org.id);
  const p = await f.project(owner.id, { isPublic: false, designerOrgId: org.id }), q = await f.project(other.id);
  const a = await f.image(p.id), foreign = await f.image(q.id);
  const read = () => db.project.findUniqueOrThrow({ where: { id: p.id }, include: { images: true, post: { select: { status: true } } } });
  const input = { projectId: p.id, title: p.title, coverImageId: a.id, includedImageIds: [a.id], version: portfolioReviewVersion(await read()) };
  await assert.rejects(publishPortfolio(owner.id, { ...input, includedImageIds: [foreign.id], coverImageId: foreign.id }), /photographs/);
  await f.image(p.id);
  await assert.rejects(publishPortfolio(owner.id, input), /changed/);
  assert.equal((await read()).isPublic, false);
  for (const status of ['REVIEW', 'ARCHIVED', 'PUBLISHED']) {
    await db.projectPost.upsert({ where: { projectId: p.id }, create: { projectId: p.id, slug: 'private', status }, update: { status } });
    await assert.rejects(publishPortfolio(owner.id, { ...input, version: portfolioReviewVersion(await read()) }), /feature publication/);
  }
  assert.equal(await db.notification.count(), 0);
  const now = new Date();
  assert.equal(editorialProjectVisibility({ isPublic: true, publishedAt: now }, false).isPublic, false, 'Legacy feature-only withdrawal is unchanged');
  assert.equal(editorialProjectVisibility({ isPublic: false, portfolioPublishedAt: now }, false).isPublic, false, 'A hidden project is never resurrected');
});

test('portfolio migration is additive, repeatable and never backfills consent', async () => {
  const pg = new PGlite();
  try {
    await pg.exec('CREATE TABLE projects (id TEXT PRIMARY KEY, "isPublic" BOOLEAN); INSERT INTO projects VALUES (\'private\', false), (\'legacy\', true);');
    const migration = fs.readFileSync('prisma/migrations/20261116213000_portfolio_publication/migration.sql', 'utf8');
    await pg.exec(migration); await pg.exec(migration);
    const { rows } = await pg.query('SELECT * FROM projects ORDER BY id');
    assert.ok(rows.every(row => row.portfolioPublishedAt === null && row.portfolioCoverImageId === null));
    assert.equal(rows[0].isPublic, true); assert.equal(rows[1].isPublic, false);
  } finally { await pg.close(); }
});
