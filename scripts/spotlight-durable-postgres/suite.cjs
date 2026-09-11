const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const contract = require('./contract.cjs');
const lit=v=>v===null?'NULL':`'${String(v).replace(/'/g,"''")}'`;
const insert=(table,fields)=>`INSERT INTO ${table} (${Object.keys(fields).join(',')}) VALUES (${Object.values(fields).map(lit).join(',')});`;
const key=n=>Number(n).toString(16).padStart(64,'0');
const q=(id,overrides={})=>insert('spotlight_questions',{id,spotlight_id:'s',kind:'BASE',question_version:1,meaning_key:key(1),context_snapshot:JSON.stringify({snapshotVersion:1,projectId:'project',roomId:'room',productId:'product',sourceTagIds:['tag-a','tag-b']}),wording:'Why did you choose this piece?',prompt_version:'v1',policy_version:'v1',...overrides});
const a=(id,overrides={})=>insert('spotlight_answer_revisions',{id,question_id:'q',question_version:1,revision_number:1,answering_user_id:'answerer',accepted_text:'  Exact text\nCafé — 木.  ',acceptance_snapshot:'{"snapshotVersion":1,"sourceTagIds":["tag-a","tag-b"]}',input_modality:'TEXT',acceptance_mode:'AUTHORED',request_key:id,request_hash:key(42),accepted_state_version:1,accepted_selection_version:1,...overrides});
const spot=(id,overrides={})=>insert('product_spotlights',{id,project_id:'project',product_id:'product',room_id:'room',publisher_user_id:'publisher',selected_by_id:'selector',variant:id,updated_at:'2026-09-10',...overrides});
const check=p=>`DO $$ BEGIN IF NOT (${p}) THEN RAISE EXCEPTION 'Synthetic assertion failed'; END IF; END $$;`;
module.exports=async({sql,test,migration,catalogSql,evidence})=>{
  await test('Exact migration applies; all columns/FKs/indexes/functions/triggers/RLS match; initially empty',async()=>{
    await sql(migration); evidence.catalog=JSON.parse(await sql(catalogSql)); contract(evidence.catalog,migration);
    assert.equal(evidence.catalog.questionCount,0); assert.equal(evidence.catalog.answerCount,0);
  });
  await test('Empty replay preserves the complete catalog',async()=>{await sql(migration); assert.deepEqual(JSON.parse(await sql(catalogSql)),evidence.catalog);});
  await sql("INSERT INTO users VALUES ('answerer');"+spot('s')+spot('s2')+"INSERT INTO product_spotlight_tags(tag_id,spotlight_id) VALUES ('tag-a','s'),('tag-b','s');"+q('q')+q('q2',{spotlight_id:'s2'}));
  await test('Even unanswered scheduling blocks spotlight and project hard deletion',async()=>{
    assert.equal(await sql('SELECT count(*) FROM spotlight_answer_revisions'),'0');
    for(const statement of ["DELETE FROM product_spotlights WHERE id='s'","DELETE FROM projects WHERE id='project'"])
      await sql(statement,{error:'23503[\\s\\S]*spotlight_questions_spotlight_id_fkey'});
    assert.equal(await sql("SELECT count(*) FROM projects WHERE id='project'"),'1');
    await sql("BEGIN; UPDATE spotlight_questions SET retired_at=now(),retired_reason='DESELECTED',state_version=1 WHERE id='q'; DELETE FROM product_spotlights WHERE id='s'; COMMIT;",{error:'23503'});
  });
  await test('Question CHECKs reject kind/parent, version, text/hash, snapshot and retirement errors',async()=>{
    for(const [overrides,code] of [
      [{kind:'OTHER'},'23514'],[{kind:'FOLLOW_UP'},'23514'],[{parent_answer_revision_id:'missing'},'23514'],
      [{question_version:0},'23514'],[{state_version:-1},'23514'],[{wording:'   '},'23514'],
      [{meaning_key:'bad'},'23514'],[{prompt_version:''},'23514'],[{policy_version:''},'23514'],
      [{context_snapshot:'[]'},'23514'],[{context_snapshot:'null'},'23514'],
      [{retired_at:'2026-09-10'},'23514'],[{retired_reason:'DESELECTED'},'23514'],[{retired_at:'2026-09-10',retired_reason:'OTHER'},'23514'],
      [{state_version:1},'23514'],[{current_answer_number:1},'23514'],[{spotlight_id:'missing'},'23503']
    ]) await sql(q('invalid',{question_version:9,meaning_key:key(9),...overrides}),{error:code});
  });
  await test('Active-kind, meaning, version and identity uniqueness reject duplicates',async()=>{
    for(const overrides of [{question_version:2,meaning_key:key(2)},{retired_at:'2026-09-10',retired_reason:'DESELECTED'},{question_version:2,retired_at:'2026-09-10',retired_reason:'DESELECTED'},{meaning_key:key(2),retired_at:'2026-09-10',retired_reason:'DESELECTED'}])
      await sql(q('duplicate',overrides),{error:'23505'});
    await sql(q('q'),{error:'23505'});
  });
  await test('Immutable question definitions reject every definition-column UPDATE, DELETE and TRUNCATE',async()=>{
    for(const assignment of ["id='changed'","spotlight_id='s2'","kind='FOLLOW_UP'","question_version=2",`meaning_key='${key(8)}'`,"context_snapshot='{}'","wording='changed'","prompt_version='v2'","policy_version='v2'","parent_answer_revision_id='missing'","created_at=created_at+interval '1 second'"])
      await sql(`UPDATE spotlight_questions SET ${assignment},state_version=1 WHERE id='q'`,{error:'23514'});
    await sql("DELETE FROM spotlight_questions WHERE id='q'",{error:'23514'});
    await sql('TRUNCATE spotlight_questions CASCADE',{error:'23514'});
    await sql("UPDATE spotlight_questions SET state_version=2 WHERE id='q'",{error:'23514'});
    await sql("UPDATE spotlight_questions SET retired_at=now() WHERE id='q'",{error:'23514'});
  });
  await test('Atomic first answer and next revision preserve exact accepted text and old version',async()=>{
    await sql('BEGIN;'+a('a1')+"UPDATE spotlight_questions SET current_answer_number=1,state_version=1 WHERE id='q';COMMIT;");
    assert.equal(JSON.parse(await sql("SELECT to_json(accepted_text) FROM spotlight_answer_revisions WHERE id='a1'")),'  Exact text\nCafé — 木.  ');
    await sql('BEGIN;'+a('a2',{revision_number:2,accepted_state_version:2,accepted_text:'Second answer'})+"UPDATE spotlight_questions SET current_answer_number=2,state_version=2 WHERE id='q';COMMIT;");
    assert.equal(await sql("SELECT count(*) FROM spotlight_answer_revisions WHERE question_id='q'"),'2');
    assert.equal(await sql("SELECT current_answer_number FROM spotlight_questions WHERE id='q'"),'2');
    await sql('BEGIN;'+a('other-answer',{question_id:'q2'})+"UPDATE spotlight_questions SET current_answer_number=1,state_version=1 WHERE id='q2';ROLLBACK;");
    await sql("UPDATE spotlight_questions SET current_answer_number=1,state_version=1 WHERE id='q2'",{error:'23503[\\s\\S]*spotlight_questions_current_answer_fk'});
  });
  await test('Append-only revisions reject every UPDATE, DELETE and TRUNCATE',async()=>{
    for(const assignment of ["accepted_text='rewrite'","id='new'","question_id='q2'","question_version=2","revision_number=4","answering_user_id='publisher'","acceptance_snapshot='{}'","input_modality='VOICE'","acceptance_mode='CONFIRMED_REUSE'","reused_from_revision_id='a2'","reuse_snapshot='{}'","request_key='new'",`request_hash='${key(7)}'`,"accepted_state_version=9","accepted_selection_version=9","accepted_at=now()"])
      await sql(`UPDATE spotlight_answer_revisions SET ${assignment} WHERE id='a1'`,{error:'23514'});
    await sql("DELETE FROM spotlight_answer_revisions WHERE id='a1'",{error:'23514'});
    await sql('TRUNCATE spotlight_answer_revisions CASCADE',{error:'23514'});
  });
  await test('Answer CHECKs/FKs reject malformed input; all modality/reuse shapes accept valid rows',async()=>{
    for(const [overrides,code] of [
      [{revision_number:0},'23514'],[{accepted_state_version:0},'23514'],[{accepted_selection_version:0},'23514'],
      [{accepted_text:' '},'23514'],[{request_key:''},'23514'],[{request_hash:'bad'},'23514'],[{acceptance_snapshot:'[]'},'23514'],[{acceptance_snapshot:'null'},'23514'],
      [{input_modality:'OTHER'},'23514'],[{acceptance_mode:'OTHER'},'23514'],[{acceptance_mode:'CONFIRMED_REUSE'},'23514'],
      [{reuse_snapshot:'{}'},'23514'],[{reused_from_revision_id:'a1'},'23514'],[{acceptance_mode:'CONFIRMED_REUSE',reuse_snapshot:'[]'},'23514'],
      [{acceptance_mode:'CONFIRMED_REUSE',reuse_snapshot:'{}',reused_from_revision_id:'invalid'},'23514'],
      [{question_version:2},'23503'],[{question_id:'missing'},'23503'],[{answering_user_id:'missing'},'23503'],
      [{acceptance_mode:'CONFIRMED_REUSE',reuse_snapshot:'{}',reused_from_revision_id:'missing'},'23503']
    ]) await sql(a('invalid',{revision_number:3,...overrides}),{error:code});
    for(const input_modality of ['TEXT','VOICE','MIXED']) await sql('BEGIN;'+a('valid',{revision_number:3,input_modality})+'ROLLBACK;');
    for(const reused_from_revision_id of [null,'a1']) await sql('BEGIN;'+a('valid',{revision_number:3,acceptance_mode:'CONFIRMED_REUSE',reuse_snapshot:'{}',reused_from_revision_id})+'ROLLBACK;');
  });
  await test('Revision ordinal and actor/question request namespace unique; hash conflicts remain service work',async()=>{
    await sql(a('duplicate',{revision_number:2}),{error:'23505[\\s\\S]*spotlight_answers_number_key'});
    await sql(a('duplicate',{revision_number:3,request_key:'a1',accepted_text:'different'}),{error:'23505[\\s\\S]*spotlight_answers_request_key'});
    await sql('BEGIN;'+a('other-actor',{revision_number:3,answering_user_id:'publisher',request_key:'a1'})+a('other-question',{question_id:'q2',request_key:'a1'})+'ROLLBACK;');
    // Positive witness of limits: SQL permits a semantically dishonest snapshot/hash
    // and insertion without head advancement. Future service validation is required.
    await sql('BEGIN;'+a('unheaded',{revision_number:9,acceptance_snapshot:'{}'})+check("(SELECT current_answer_number=2 FROM spotlight_questions WHERE id='q')")+'ROLLBACK;');
  });
  await test('Pointer rejects null/backward/skipped movement and missing next revision; valid retirement/reactivation',async()=>{
    for(const value of ['NULL','1','4']) await sql(`UPDATE spotlight_questions SET current_answer_number=${value},state_version=3 WHERE id='q'`,{error:'23514'});
    await sql("UPDATE spotlight_questions SET current_answer_number=3,state_version=3 WHERE id='q'",{error:'23503'});
    await sql("BEGIN; UPDATE spotlight_questions SET retired_at=now(),retired_reason='DESELECTED',state_version=3 WHERE id='q'; UPDATE spotlight_questions SET retired_at=NULL,retired_reason=NULL,state_version=4 WHERE id='q';"+check("(SELECT current_answer_number=2 FROM spotlight_questions WHERE id='q')")+'ROLLBACK;');
  });
  await test('Follow-up parent FK and active-kind uniqueness preserve previous definitions',async()=>{
    await sql(q('follow',{kind:'FOLLOW_UP',parent_answer_revision_id:'a2'}));
    await sql(q('follow-duplicate',{kind:'FOLLOW_UP',parent_answer_revision_id:'a2',question_version:2,meaning_key:key(2)}),{error:'23505'});
    await sql(q('follow-missing',{spotlight_id:'s2',kind:'FOLLOW_UP',parent_answer_revision_id:'missing'}),{error:'23503'});
    await sql("BEGIN; UPDATE spotlight_questions SET retired_at=now(),retired_reason='PARENT_REANSWERED',state_version=1 WHERE id='follow';"+q('follow-next',{kind:'FOLLOW_UP',parent_answer_revision_id:'a2',question_version:2,meaning_key:key(2)})+'ROLLBACK;');
  });
  await test('Source deletion removes only that source; room deletion SET NULL retains accepted history',async()=>{
    const snapshot=await sql("SELECT acceptance_snapshot::text FROM spotlight_answer_revisions WHERE id='a1'");
    await sql("BEGIN; DELETE FROM product_tags WHERE id='tag-a';"+check("(SELECT count(*)=1 FROM product_spotlight_tags WHERE spotlight_id='s')")+check("(SELECT is_selected FROM product_spotlights WHERE id='s')")+"DELETE FROM product_tags WHERE id='tag-b';"+check("(SELECT count(*)=0 FROM product_spotlight_tags WHERE spotlight_id='s')")+check('(SELECT count(*)=2 FROM spotlight_answer_revisions)')+'ROLLBACK;');
    await sql("BEGIN; DELETE FROM rooms WHERE id='room';"+check("(SELECT room_id IS NULL FROM product_spotlights WHERE id='s')")+check('(SELECT count(*)=2 FROM spotlight_answer_revisions)')+'ROLLBACK;');
    assert.equal(await sql("SELECT acceptance_snapshot::text FROM spotlight_answer_revisions WHERE id='a1'"),snapshot);
  });
  await test('Answered/retired project and spotlight deletion remain restricted',async()=>{
    for(const table of ['projects','product_spotlights']) await sql(`DELETE FROM ${table} WHERE id='${table==='projects'?'project':'s'}'`,{error:'23503'});
    await sql("BEGIN; UPDATE spotlight_questions SET retired_at=now(),retired_reason='DESELECTED',state_version=state_version+1; DELETE FROM projects WHERE id='project';COMMIT;",{error:'23503'});
    // A never-scheduled draft still follows the old cascade behavior.
    await sql('BEGIN;'+spot('never-scheduled',{project_id:'other-project',product_id:'other-product',room_id:'other-room'})+"DELETE FROM projects WHERE id='other-project';"+check("NOT EXISTS(SELECT 1 FROM product_spotlights WHERE id='never-scheduled')")+'ROLLBACK;');
  });
  for(const [label,statement,constraint] of [
    ['product',"DELETE FROM products WHERE id='product'",'product_spotlights_product_id_fkey'],
    ['personal publisher',"DELETE FROM users WHERE id='publisher'",'product_spotlights_publisher_user_id_fkey'],
    ['selector',"DELETE FROM users WHERE id='selector'",'product_spotlights_selected_by_id_fkey'],
    ['answering user',"DELETE FROM users WHERE id='answerer'",'spotlight_answer_revisions_answering_user_id_fkey'],
  ]) await test(label+' deletion restricted',()=>sql(statement,{error:'23503[\\s\\S]*'+constraint}));
  await test('Studio publisher deletion restricted',()=>sql('BEGIN;'+spot('studio',{publisher_user_id:null,publisher_org_id:'studio'})+"DELETE FROM organizations WHERE id='studio';COMMIT;",{error:'23503[\\s\\S]*product_spotlights_publisher_org_id_fkey'}));
  await test('Failure after revision INSERT rolls back history/request key and leaves current head untouched',async()=>{
    await sql('BEGIN;'+a('rolled-back',{revision_number:3,accepted_state_version:3})+'SELECT 1/0;COMMIT;',{error:'22012'});
    assert.equal(await sql("SELECT count(*) FROM spotlight_answer_revisions WHERE id='rolled-back'"),'0');
    assert.equal(await sql("SELECT current_answer_number FROM spotlight_questions WHERE id='q'"),'2');
    await sql('BEGIN;'+a('rolled-back',{revision_number:3,accepted_state_version:3})+"UPDATE spotlight_questions SET current_answer_number=3,state_version=3 WHERE id='q';ROLLBACK;");
  });
  await test('Browser roles denied without grants and constrained by RLS with synthetic grants; postgres works',async()=>{
    await sql('CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS; GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;');
    for(const role of ['anon','authenticated','service_role']) for(const table of ['spotlight_questions','spotlight_answer_revisions']) await sql(`SET ROLE ${role}; SELECT * FROM ${table};`,{error:'42501'});
    // Grants exist only inside a rolled-back synthetic adversarial test. No
    // application or service_role grants are installed by this migration.
    for(const role of ['anon','authenticated']) {
      for(const table of ['spotlight_questions','spotlight_answer_revisions']) {
        await sql(`BEGIN; GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO ${role}; SET LOCAL ROLE ${role};`+check(`(SELECT count(*)=0 FROM ${table})`)+`WITH d AS (DELETE FROM ${table} RETURNING *) SELECT count(*) FROM d; ROLLBACK;`);
        const update=table==='spotlight_questions'?'state_version=state_version+1':"accepted_text='changed'";
        assert.equal(await sql(`BEGIN; GRANT SELECT,UPDATE ON ${table} TO ${role}; SET LOCAL ROLE ${role}; WITH d AS (UPDATE ${table} SET ${update} RETURNING *) SELECT count(*) FROM d; ROLLBACK;`),'0');
      }
      await sql(`BEGIN; GRANT SELECT,INSERT ON spotlight_questions TO ${role}; SET LOCAL ROLE ${role};`+q('browser',{spotlight_id:'s2',question_version:3,meaning_key:key(3)}),{error:'42501'});
      await sql(`BEGIN; GRANT SELECT,INSERT ON spotlight_answer_revisions TO ${role}; SET LOCAL ROLE ${role};`+a('browser',{revision_number:3}),{error:'42501'});
    }
    await sql('BEGIN;'+a('server',{revision_number:3,accepted_state_version:3})+"UPDATE spotlight_questions SET current_answer_number=3,state_version=3 WHERE id='q';ROLLBACK;");
    evidence.roleScope='Synthetic anon/authenticated/service_role; no application-role execution or grants';
  });
  for(const kind of ['question','revision','request']) await test('Concurrent '+kind+' duplicates: one commit, one uniqueness rejection',async()=>{
    const app='durable-race-'+kind;
    const stmt=which=>kind==='question'?q('race-'+which,{spotlight_id:'s2',kind:'FOLLOW_UP',parent_answer_revision_id:'a1'}):a('race-'+kind+'-'+which,{question_id:'q2',revision_number:kind==='request'?(which==='a'?3:4):1,request_key:kind==='request'?'race-request':'race-'+which});
    const winner=sql('BEGIN;'+stmt('a')+'SELECT pg_sleep(4);COMMIT;',{app});
    let seen=false;
    for(let i=0;i<30;i++){if(await sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${app}' AND wait_event='PgSleep'`)==='1'){seen=true;break;} await new Promise(r=>setTimeout(r,100));}
    assert.ok(seen,'Observe first transaction holding unique entry');
    await sql(stmt('b'),{error:'23505'}); await winner;
  });
  await test('Populated replay preserves all IDs/exact text/heads/counts and complete catalog',async()=>{
    const data="SELECT json_build_object('questions',(SELECT json_agg(q ORDER BY id) FROM spotlight_questions q),'answers',(SELECT json_agg(a ORDER BY id) FROM spotlight_answer_revisions a))";
    const before=await sql(data); const cat=await sql(catalogSql); await sql(migration);
    assert.equal(await sql(data),before); assert.equal(await sql(catalogSql),cat); evidence.populatedCatalog=JSON.parse(cat);
  });
  await test('Fault-injected migration rolls back all new objects; exact retry/replay succeeds',async()=>{
    await sql('CREATE DATABASE spotlight_rollback;');
    const root=path.resolve(__dirname,'../..');
    await sql(fs.readFileSync(path.join(root,'scripts/spotlight-postgres/fixtures.sql'),'utf8'),{database:'spotlight_rollback'});
    await sql(fs.readFileSync(path.join(root,'prisma/migrations/20260910180000_add_product_spotlight_draft_selection/migration.sql'),'utf8'),{database:'spotlight_rollback'});
    await sql(migration.replace('COMMIT;','SELECT 1/0; COMMIT;'),{database:'spotlight_rollback',error:'22012'});
    assert.equal(await sql("SELECT count(*) FROM pg_tables WHERE tablename IN ('spotlight_questions','spotlight_answer_revisions')",{database:'spotlight_rollback'}),'0');
    assert.equal(await sql("SELECT count(*) FROM pg_proc WHERE proname IN ('spotlight_question_guard','spotlight_history_no_mutation')",{database:'spotlight_rollback'}),'0');
    await sql(migration,{database:'spotlight_rollback'}); await sql(migration,{database:'spotlight_rollback'}); contract(JSON.parse(await sql(catalogSql,{database:'spotlight_rollback'})),migration);
  });
};
