const { test } = require('node:test');
const assert = require('node:assert/strict');
const { disposableTarget } = require('./fixtures.cjs');

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
