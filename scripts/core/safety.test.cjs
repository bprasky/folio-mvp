const { test } = require('node:test');
const assert = require('node:assert/strict');
const { disposableTarget } = require('./fixtures.cjs');
const { memoryDatabase } = require('./memory-db.cjs');
const { Prisma } = require('@prisma/client');

test('database execution is absent by default and requires explicit disposable acknowledgement', () => {
  assert.equal(disposableTarget({}), null);
  assert.throws(() => disposableTarget({ CORE_TEST_DATABASE_URL: 'postgresql://fixture@localhost/core_test' }), /DISPOSABLE=1/);
});
test('database gate refuses application identities, schema bypasses and non-test databases', () => {
  const base = { CORE_TEST_DATABASE_DISPOSABLE: '1', DATABASE_URL: 'postgresql://fixture@application.invalid/production' };
  for (const target of ['postgresql://fixture@application.invalid/core_test?schema=isolated', 'postgresql://fixture@localhost/production', 'https://localhost/core_test']) {
    assert.throws(() => disposableTarget({ ...base, CORE_TEST_DATABASE_URL: target }));
  }
  assert.throws(() => disposableTarget({ ...base, DATABASE_URL: 'postgresql://postgres.project@direct.invalid/postgres', CORE_TEST_DATABASE_URL: 'postgresql://postgres.project@pool.invalid/core_test' }), /pooler identity/);
  const target = 'postgresql://fixture@127.0.0.1:55449/folio_core_disposable_test';
  assert.equal(disposableTarget({ ...base, CORE_TEST_DATABASE_URL: target }), target);
});

test('local double compares JSON snapshots structurally and recognizes SQL null in CAS filters', async () => {
  const db = memoryDatabase();
  const first = await db.projectPost.create({ data: { projectId: 'json-cas-fixture' } });
  const provenance = { interview: { answers: ['first', 'second'], revision: 1 } };
  const initial = await db.projectPost.updateMany({
    where: { id: first.id, updatedAt: first.updatedAt, provenance: { equals: Prisma.DbNull } },
    data: { provenance },
  });
  assert.equal(initial.count, 1, 'a fresh SQL-null row must accept the initial save');
  for (const expected of [Prisma.DbNull, { interview: { ...provenance.interview, revision: 2 } }, { interview: { ...provenance.interview, answers: ['second', 'first'] } }]) {
    const stale = await db.projectPost.updateMany({
      where: { id: first.id, provenance: { equals: expected } }, data: { provenance: { overwritten: true } },
    });
    assert.equal(stale.count, 0, 'a different snapshot must not overwrite the saved interview');
  }
  const reordered = { interview: { revision: 1, answers: ['first', 'second'] } };
  const matching = await db.projectPost.updateMany({
    where: { id: first.id, provenance: { equals: reordered } }, data: { provenance: { saved: true } },
  });
  assert.equal(matching.count, 1, 'JSON object property order must not affect equality');
});
