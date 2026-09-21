const fs = require('fs');
const assert = require('assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const entry = process.env.READINESS_PGLITE_PATH || require.resolve('@electric-sql/pglite');
  const { PGlite } = await import(pathToFileURL(path.resolve(entry)).href);
  const db = new PGlite();
  try {
    const sql = fs.readFileSync('docs/reviews/studio-readiness-proposed.sql', 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    await db.exec(`INSERT INTO studio_candidates VALUES ('candidate','actor',NULL,ARRAY['project'],1,'draft',NOW(),NOW());
      INSERT INTO studio_candidate_versions VALUES ('candidate',1,'source-a','{}',NOW());
      INSERT INTO studio_candidate_events VALUES ('event','candidate',1,'source-a','reviewed','{}',NOW());`);
    await assert.rejects(db.exec(`INSERT INTO studio_candidate_versions VALUES ('candidate',1,'source-b','{}',NOW())`), e => e.code === '23505');
    await assert.rejects(db.exec(`INSERT INTO studio_candidate_events VALUES ('wrong','candidate',1,'source-b','reviewed','{}',NOW())`), e => e.code === '23503');
    await assert.rejects(db.exec(`INSERT INTO studio_candidate_versions VALUES ('missing',1,'source-a','{}',NOW())`), e => e.code === '23503');
    await assert.rejects(db.exec(`UPDATE studio_candidates SET "currentVersion"=0`), e => e.code === '23514');
    const secured = await db.query(`SELECT count(*)::int AS n FROM pg_class WHERE relname IN ('studio_candidates','studio_candidate_versions','studio_candidate_events') AND relrowsecurity`);
    assert.equal(secured.rows[0].n, 3);
    await db.exec(`DELETE FROM studio_candidates WHERE id='candidate'`);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM studio_candidate_versions')).rows[0].n, 0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM studio_candidate_events')).rows[0].n, 0);
    console.log('PASS: disposable PostgreSQL DDL rerun, unique versions, exact source/event FK, orphan rejection, positive current version, RLS, cascade cleanup.');
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
