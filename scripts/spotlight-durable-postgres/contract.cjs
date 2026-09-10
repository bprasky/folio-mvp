const assert = require('node:assert/strict');
module.exports = function contract(cat, reviewedSql) {
  assert.equal(cat.tables.length,2); assert.ok(cat.tables.every(t=>t.rls && !t.force_rls && t.owner==='postgres'));
  assert.equal(cat.columns.length,31); assert.equal(cat.policies,0);
  const types={TEXT:'text',INTEGER:'integer',JSONB:'jsonb',VARCHAR:'character varying',TIMESTAMP:'timestamp without time zone'};
  let count=0;
  for(const table of reviewedSql.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+) \(([\s\S]*?)\n\);/g)) {
    for(const m of table[2].matchAll(/^\s*(\w+) (TEXT|INTEGER|JSONB|VARCHAR|TIMESTAMP)(?:\((\d+)\))?([^\n]*)/gm)) {
      const col=cat.columns.find(x=>x.table_name===table[1]&&x.column_name===m[1]); assert.ok(col,m[1]); count++;
      assert.equal(col.data_type,types[m[2]]); assert.equal(col.is_nullable,/NOT NULL|PRIMARY KEY/.test(m[4])?'NO':'YES');
      if(m[2]==='VARCHAR') assert.equal(col.character_maximum_length,Number(m[3]));
      if(m[2]==='TIMESTAMP') assert.equal(col.datetime_precision,Number(m[3]));
      const d=m[4].match(/DEFAULT (CURRENT_TIMESTAMP|0)/)?.[1]||null; assert.equal(col.column_default,d);
    }
  }
  assert.equal(count,31);
  const fks=cat.constraints.filter(x=>x.type==='f'); assert.equal(fks.length,6);
  const defs=[
    ['spotlight_questions','spotlight_id','product_spotlights','id'],
    ['spotlight_questions','id, current_answer_number','spotlight_answer_revisions','question_id, revision_number'],
    ['spotlight_questions','parent_answer_revision_id','spotlight_answer_revisions','id'],
    ['spotlight_answer_revisions','question_id, question_version','spotlight_questions','id, question_version'],
    ['spotlight_answer_revisions','answering_user_id','users','id'],
    ['spotlight_answer_revisions','reused_from_revision_id','spotlight_answer_revisions','id'],
  ];
  for(const [table,cols,target,refs] of defs) {
    const fk=fks.find(x=>x.table_name===table&&x.definition.startsWith(`FOREIGN KEY (${cols})`)); assert.ok(fk,cols);
    assert.equal(fk.definition,`FOREIGN KEY (${cols}) REFERENCES ${target}(${refs}) ON UPDATE RESTRICT ON DELETE RESTRICT`);
    assert.equal(fk.delete_action,'r'); assert.equal(fk.update_action,'r');
  }
  assert.equal(cat.constraints.filter(x=>x.type==='p').length,2);
  const checks=cat.constraints.filter(x=>x.type==='c'); assert.equal(checks.length,11);
  const expected=[...reviewedSql.matchAll(/CONSTRAINT (\w+) CHECK/g)].map(m=>m[1]).sort();
  assert.deepEqual(checks.map(x=>x.name).sort(),expected);
  // Full PostgreSQL-rendered CHECK definitions are retained as evidence, with
  // every named predicate exercised by positive/negative SQL in suite.cjs.
  assert.equal(cat.indexes.length,11);
  for(const m of reviewedSql.matchAll(/CREATE (UNIQUE )?INDEX IF NOT EXISTS (\w+) ON public\.(\w+)\(([^)]+)\)([^;]*);/g)) {
    const idx=cat.indexes.find(x=>x.indexname===m[2]); assert.ok(idx,m[2]);
    const expected=`CREATE ${m[1]||''}INDEX ${m[2]} ON public.${m[3]} USING btree (${m[4]})${m[5].replace('WHERE retired_at IS NULL','WHERE (retired_at IS NULL)')}`;
    assert.equal(idx.indexdef,expected);
  }
  assert.equal(cat.functions.length,2);
  const normalized=s=>s.replace(/\s+/g,' ').trim();
  for(const fn of cat.functions) {
    const match=reviewedSql.match(new RegExp('FUNCTION public\\.'+fn.name+'\\(\\) RETURNS trigger\\s+LANGUAGE plpgsql SET search_path = pg_catalog AS \\$\\$([\\s\\S]*?)\\$\\$;'));
    assert.ok(match,fn.name); assert.equal(normalized(fn.body),normalized(match[1]));
    assert.equal(fn.security_definer,false); assert.equal(fn.result,'trigger'); assert.deepEqual(fn.config,['search_path=pg_catalog']);
  }
  const triggers={spotlight_questions_guard:[23,'spotlight_question_guard'],spotlight_questions_no_delete:[11,'spotlight_history_no_mutation'],spotlight_questions_no_truncate:[34,'spotlight_history_no_mutation'],spotlight_answers_no_mutation:[27,'spotlight_history_no_mutation'],spotlight_answers_no_truncate:[34,'spotlight_history_no_mutation']};
  assert.equal(cat.triggers.length,5);
  for(const t of cat.triggers) { assert.ok(triggers[t.name]); assert.equal(t.type,triggers[t.name][0]); assert.equal(t.enabled,'O'); assert.ok(t.definition.endsWith(`EXECUTE FUNCTION ${triggers[t.name][1]}()`)); }
};
