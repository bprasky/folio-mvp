const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:key=>{if(!(key in mocks))throw Error(key);return mocks[key];},Date,JSON});return exports;}
class AccessError extends Error{constructor(message,status){super(message);this.status=status;}}
(async()=>{const{PGlite}=await import('@electric-sql/pglite');const pg=new PGlite();try{ await pg.exec("SET TIME ZONE 'UTC'");
 await pg.exec('CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE organizations (id TEXT PRIMARY KEY); CREATE TABLE editorial_queue_items (id TEXT PRIMARY KEY); CREATE TABLE project_posts (id TEXT PRIMARY KEY);');
 await pg.exec(fs.readFileSync('prisma/migrations/20260921160000_studio_readiness_candidates/migration.sql','utf8'));
 await pg.exec(fs.readFileSync('prisma/migrations/20260921220000_editorial_story_activities/migration.sql','utf8'));
 await pg.exec("INSERT INTO users VALUES ('owner'),('other'); INSERT INTO project_posts VALUES ('post1'),('post2');");
 const q=async(sql,args=[])=>(await pg.query(sql,args)).rows;
 const candidate=async where=>{const row=(await q('SELECT * FROM studio_candidates WHERE id=$1 AND "designerId"=$2 AND "organizationId" IS NOT DISTINCT FROM $3',[where.id,where.designerId,where.organizationId]))[0];if(row)row.versions=await q('SELECT * FROM studio_candidate_versions WHERE "candidateId"=$1 ORDER BY version DESC LIMIT 1',[row.id]);return row||null;};
 const db={
  $queryRaw:async(strings,...values)=>q(strings.reduce((sql,s,i)=>sql+(i?'$'+i:'')+s,''),values),
  studioCandidate:{findFirst:async({where})=>candidate(where),
   create:async({data:d})=>q('INSERT INTO studio_candidates(id,"designerId","organizationId","projectIds","currentVersion",state,"updatedAt") VALUES($1,$2,$3,$4,$5,$6,NOW())',[d.id,d.designerId,d.organizationId,d.projectIds,d.currentVersion,d.state]),
   upsert:async({create:d})=>q('INSERT INTO studio_candidates(id,"designerId","organizationId","projectIds","currentVersion",state,"updatedAt") VALUES($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT(id) DO NOTHING',[d.id,d.designerId,d.organizationId,d.projectIds,d.currentVersion,d.state]),
   update:async({where,data:d})=>q('UPDATE studio_candidates SET "currentVersion"=$1,"updatedAt"=NOW() WHERE id=$2',[d.currentVersion,where.id]),
   updateMany:async({where:w,data:d})=>({count:(await q('UPDATE studio_candidates SET "currentVersion"=$1,state=$2,"projectIds"=$3,"updatedAt"=NOW() WHERE id=$4 AND "designerId"=$5 AND "organizationId" IS NOT DISTINCT FROM $6 AND "currentVersion"=$7 RETURNING id',[d.currentVersion,d.state,d.projectIds,w.id,w.designerId,w.organizationId,w.currentVersion])).length}),
  },
  studioCandidateVersion:{create:async({data:d})=>q('INSERT INTO studio_candidate_versions("candidateId",version,"sourceVersion",snapshot) VALUES($1,$2,$3,$4)',[d.candidateId,d.version,d.sourceVersion,JSON.stringify(d.snapshot)])},
  studioCandidateEvent:{create:async({data:d})=>q('INSERT INTO studio_candidate_events(id,"candidateId",version,"sourceVersion",kind,payload) VALUES($1,$2,$3,$4,$5,$6)',[d.id,d.candidateId,d.version,d.sourceVersion,d.kind,JSON.stringify(d.payload)])},
 };
 db.$transaction=async fn=>{await pg.exec('BEGIN ISOLATION LEVEL SERIALIZABLE');try{const result=await fn(db);await pg.exec('COMMIT');return result;}catch(error){await pg.exec('ROLLBACK');throw error;}};
 let workspace=null;
 const sources={digest:value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),object:v=>v&&typeof v==='object'?v:{},expertiseOwner:async actor=>{if(actor!=='owner')throw new AccessError('Forbidden',403);return{workspace:{id:workspace}};}};
 const store=load('src/lib/publishing-studio/expertise/store.ts',{'server-only':{},'@prisma/client':{},'@/lib/prisma':{prisma:db},'../data':{StudioAccessError:AccessError},'./sources':sources});
 const opportunity={id:'expertise-pg',projectIds:['p1','p2'],state:'active',sourceSignature:'source1',thesis:'What shaped these choices?',evidence:[{id:'image1',revision:'one',projectId:'p1'},{id:'image2',revision:'one',projectId:'p2'}]};
 await store.saveOpportunity('owner',null,opportunity,'corpus',null,'generated');
 assert.equal((await candidate({id:opportunity.id,designerId:'owner',organizationId:null})).versions[0].snapshot.opportunity.evidence.length,2,'exact evidence JSON survives real Postgres');
 await store.saveOpportunity('owner',null,{...opportunity,state:'dismissed'},'corpus',1,'dismissed','Not my comparison');
 await assert.rejects(()=>store.saveOpportunity('owner',null,opportunity,'corpus',1,'generated'),e=>e.status===409);
 assert.equal((await q('SELECT count(*)::int AS n FROM studio_candidate_versions'))[0].n,2,'stale CAS rolls back version/event writes');
 await assert.rejects(()=>store.saveOpportunity('other',null,opportunity,'corpus',2,'generated'),e=>e.status===403);
 workspace='other-workspace';await assert.rejects(()=>store.saveOpportunity('owner',null,opportunity,'corpus',2,'generated'),e=>e.status===409);workspace=null;
 await store.saveDiscoveryState('owner',null,{status:'processing',signature:'corpus',projectIds:['p1','p2']});
 await assert.rejects(()=>store.saveDiscoveryState('owner',null,{status:'processing',signature:'corpus'}),e=>e.status===409);
 await store.saveDiscoveryState('owner',null,{status:'empty',signature:'corpus'});
 assert.equal((await store.discoveryState('owner',null)).status,'empty','empty discovery cache survives SQL constraints');
 await assert.rejects(()=>q('INSERT INTO studio_candidate_events(id,"candidateId",version,"sourceVersion",kind,payload) VALUES($1,$2,$3,$4,$5,$6)',['wrong-source',opportunity.id,2,'wrong','test','{}']),/foreign key/i);
 // Exercise the actual native publication FK and frozen source/answer contracts used by the service.
 await q('INSERT INTO editorial_stories(id,"ownerId",slug,format,"updatedAt") VALUES($1,$2,$3,$4,NOW())',['article','owner','article-slug','expertise']);
 const interview={kind:'my-expertise-v1',opportunity,session:{answers:[{text:'Original concise reasoning.'}],position:1}};
 await q('INSERT INTO editorial_story_revisions(id,"storyId",number,title,blocks,interview) VALUES($1,$2,$3,$4,$5,$6)',['r1','article',1,'Choices',JSON.stringify({kind:'my-expertise-v1',article:{title:'Reviewed title',media:[{assetId:'image1'}]}}),JSON.stringify(interview)]);
 await q('INSERT INTO editorial_story_answers(id,"revisionId","promptId","questionText","answerText","answeredById") VALUES($1,$2,$3,$4,$5,$6)',['a1','r1','q1','What changed?','Original concise reasoning.','owner']);
 await q('INSERT INTO editorial_story_sources("revisionId","projectPostId","sourceDigest") VALUES($1,$2,$3)',['r1','post1','revision1']);
 await q('UPDATE editorial_story_revisions SET "approvedById"=$1,"approvedAt"=NOW(),"publishedAt"=NOW(),"answersReviewedAt"=NOW(),"consentScope"=$3 WHERE id=$2',['owner','r1','feed_only']);
 await q('UPDATE editorial_stories SET status=$1,"publishedRevisionNumber"=$2 WHERE id=$3',['published',1,'article']);
 await q('INSERT INTO editorial_story_revisions(id,"storyId",number,title,blocks,interview) SELECT $1,"storyId",2,title,$2,interview FROM editorial_story_revisions WHERE id=$3',['r2',JSON.stringify({kind:'my-expertise-v1',article:{title:'Unpublished edits'}}),'r1']);
 const publicRow=(await q('SELECT r.blocks FROM editorial_stories s JOIN editorial_story_revisions r ON r."storyId"=s.id AND r.number=s."publishedRevisionNumber" WHERE s.id=$1',['article']))[0];
 assert.equal(publicRow.blocks.article.title,'Reviewed title','draft revision cannot silently change published pointer');
 assert.equal((await q('SELECT "answerText" FROM editorial_story_answers WHERE id=$1',['a1']))[0].answerText,'Original concise reasoning.');
 await assert.rejects(()=>q('UPDATE editorial_stories SET "publishedRevisionNumber"=99 WHERE id=$1',['article']),/foreign key/i);
 console.log('PASS actual PostgreSQL expertise candidate CAS/JSONB/cache/events and native article answer/source/publication constraints');
 }finally{await pg.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
