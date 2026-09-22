const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const clone = value => structuredClone(value);
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: key => { if (!(key in mocks)) throw Error(key); return mocks[key]; }, process: { env: { STUDIO_MY_EXPERTISE: 'true' } }, Date, Set, Map, structuredClone, console });
  return exports;
}
class AccessError extends Error { constructor(message, status) { super(message); this.status = status; } }
class PrismaError extends Error {}
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const evidence = ['p1','p2'].map((projectId, i) => ({ id: `image:${i}`, revision: 'v1', projectId, projectName: projectId, kind: 'observation', text: 'Designer supplied project example.', visibility: 'public', assetId: `asset:${i}`, imageUrl: `https://example.com/${i}.jpg`, alt: 'Kitchen cabinetry' }));
let corpus = { workspace: { id: null }, identity: { name: 'Designer', profileUrl: '/profile/owner' }, evidence: clone(evidence), projects: [{id:'p1',title:'One'},{id:'p2',title:'Two'}], posts: [], signature: 'corpus-v1' };
const opportunity = { id: 'expertise_opportunity', thesis: 'What shapes these storage decisions?', readerBenefit: 'Understand the choices', comparisonType: 'contrast', projectIds: ['p1','p2'], evidence: clone(evidence), gaps: [], qualification: ['Specific comparison'], ranking: {evidence:5,specificity:5,clientValue:5,novelty:5,effort:1}, sourceSignature: 'sources-v1', state: 'active' };
let state = { stories: [], revisions: [], candidates: [{id:opportunity.id,designerId:'owner',organizationId:null,projectIds:['p1','p2'],currentVersion:1,state:'active',updatedAt:new Date()}], versions:[{candidateId:opportunity.id,version:1,sourceVersion:'sources-v1',snapshot:{kind:'my-expertise-v1',opportunity,corpus:'corpus-v1'}}], events:[] };
function match(row, where) { return Object.entries(where || {}).every(([key,val]) => typeof val === 'object' && val !== null ? ('not' in val ? row[key] !== val.not : 'startsWith' in val ? row[key].startsWith(val.startsWith) : true) : row[key] === val); }
const revision = r => r ? {...clone(r),answers:clone(r.answers||[]),sources:clone(r.sources||[])} : null;
const story = s => s ? {...clone(s),owner:{id:s.ownerId,name:'Designer'},revisions:state.revisions.filter(r=>r.storyId===s.id).sort((a,b)=>b.number-a.number).slice(0,1).map(revision),publishedRevision:revision(state.revisions.find(r=>r.storyId===s.id&&r.number===s.publishedRevisionNumber))} : null;
const update = (r,d) => {for(const[k,v]of Object.entries(d))r[k]=v&&typeof v==='object'&&'increment'in v?r[k]+v.increment:clone(v);return r;};
const db = {
  $queryRaw: async()=>[],
  editorialStory: {
    findFirst: async({where})=>story(state.stories.find(s=>match(s,where))), findUnique:async({where})=>story(state.stories.find(s=>s.id===where.id)),
    findMany:async({where})=>state.stories.filter(s=>match(s,where)).map(story),
    create:async({data})=>{if(state.stories.some(s=>s.id===data.id))throw Error('duplicate');const {revisions,...s}=data;s.publishedRevisionNumber=null;state.stories.push(clone(s));const r=revisions.create;state.revisions.push({...clone(r),id:`revision:${state.revisions.length}`,storyId:s.id,editVersion:1,answers:[],sources:r.sources?.create||[]});return story(s);},
    update:async({where,data})=>story(update(state.stories.find(s=>s.id===where.id),data)),
  },
  editorialStoryRevision: {
    update:async({where,data})=>revision(update(state.revisions.find(r=>r.id===where.id),data)),
    create:async({data})=>{const r={...clone(data),id:`revision:${state.revisions.length}`,answers:data.answers?.create||[],sources:data.sources?.create||[]};state.revisions.push(r);return revision(r);},
  },
  editorialStoryAnswer:{upsert:async({where,create,update:data})=>{const r=state.revisions.find(r=>r.id===where.revisionId_promptId.revisionId);const a=r.answers.find(a=>a.promptId===where.revisionId_promptId.promptId);if(a)Object.assign(a,data);else r.answers.push(clone(create));}},
  studioCandidate:{
    findFirst:async({where})=>{const c=state.candidates.find(c=>match(c,where));return c?{...clone(c),versions:state.versions.filter(v=>v.candidateId===c.id).sort((a,b)=>b.version-a.version).slice(0,1)}:null;},
    findMany:async({where})=>state.candidates.filter(c=>match(c,where)).map(c=>({...clone(c),versions:state.versions.filter(v=>v.candidateId===c.id).sort((a,b)=>b.version-a.version).slice(0,1)})),
  },
  studioCandidateEvent:{
    findUnique:async({where})=>clone(state.events.find(e=>e.id===where.id)||null),
    findFirst:async({where})=>clone(state.events.filter(e=>match(e,where)).at(-1)||null),
    findMany:async({where})=>clone(state.events.filter(e=>match(e,where)).reverse()),
    upsert:async({where,create})=>{let event=state.events.find(e=>e.id===where.id);if(!event){event={...clone(create),createdAt:new Date()};state.events.push(event);}return event;},
  },
};
db.$transaction=async fn=>{const before=clone(state);try{return await fn(db);}catch(error){state=before;throw error;}};
const sources={digest:hash,object,requireExpertise(){},expertiseOwner:async actor=>{if(actor!=='owner')throw new AccessError('Forbidden',403);return{workspace:corpus.workspace,identity:corpus.identity};},expertiseSources:async actor=>{await sources.expertiseOwner(actor);return clone(corpus);},portfolioEvidence:async()=>clone(corpus),changedEvidence:(saved,fresh)=>saved.filter(e=>!fresh.some(f=>e.id===f.id&&e.revision===f.revision&&e.visibility===f.visibility)).map(e=>e.id)};
const prisma={PrismaClientKnownRequestError:PrismaError};
const common={'./flag':{expertiseEnabled:()=>true},'server-only':{},'@prisma/client':{Prisma:prisma},'@/lib/prisma':{prisma:db},'../data':{StudioAccessError:AccessError},'./sources':sources};
const store=load('src/lib/publishing-studio/expertise/store.ts',common);
const schemas=load('src/lib/publishing-studio/expertise/generation.schemas.ts',{zod:require('zod')});
const engine=load('src/lib/publishing-studio/expertise/engine.ts',{'./generation.schemas':schemas});
let modelFails=true, calls=0;
const generation={discoverExpertise:async()=>[],nextExpertiseQuestion:async(_o,s)=>{calls++;if(modelFails)throw Error('provider failed');return{...s,coverage:{angle:true,examples:['p1','p2'],reasoning:true,judgment:true,confirmed:false,contradictions:[],gaps:[]},nextQuestion:{id:'confirm',purpose:'confirm',text:'Confirm framing',evidenceIds:evidence.map(e=>e.id),gapId:'confirm',thesisRevision:s.thesisRevision,followUp:0},questions:[...s.questions,{id:'confirm',purpose:'confirm',text:'Confirm framing',evidenceIds:evidence.map(e=>e.id)}],status:'confirm'};},composeExpertiseArticle:async(o,s)=>({title:s.thesis,introduction:'',claims:[{id:'claim',text:s.answers[0].text,evidenceIds:evidence.map(e=>e.id),answerIds:[s.answers[0].id],status:'designer_confirmed'}],media:o.evidence.map(e=>({evidenceId:e.id,assetId:e.assetId,projectId:e.projectId,projectName:e.projectName,url:e.imageUrl,caption:e.projectName,alt:e.alt})),cover:'project',featured:false,thesisRevision:s.thesisRevision,reviewed:false})};
const service=()=>load('src/lib/publishing-studio/expertise/service.ts',{...common,'@/lib/rateLimit':{checkRateLimit:async()=>({success:true})},'./store':store,'./engine':engine,'./generation':generation});
(async()=>{
  let api=service(); let saved=await api.startExpertise('owner',opportunity.id);
  assert.equal(state.stories.length,1);
  assert.equal((await api.startExpertise('owner',opportunity.id)).id,saved.id,'retry reuses stable session');
  await assert.rejects(()=>api.readExpertise('other',saved.id),/Forbidden/);
  saved=await api.changeExpertise('owner',saved.id,{action:'answer',expectedVersion:saved.version,text:'The first family needed storage; the second displayed ceramics.'});
  assert.ok(saved.error);assert.equal(saved.session.answers.length,1,'provider failure preserves saved answer');
  api=service();saved=await api.readExpertise('owner',saved.id);assert.equal(saved.session.answers.length,1,'reload reconstructs saved interview');
  modelFails=false;saved=await api.changeExpertise('owner',saved.id,{action:'continue',expectedVersion:saved.version});
  saved=await api.changeExpertise('owner',saved.id,{action:'confirm',expectedVersion:saved.version});assert.equal(saved.session.status,'ready');
  saved=await api.changeExpertise('owner',saved.id,{action:'compose',expectedVersion:saved.version});assert.ok(saved.article);
  const title='The designer’s edited storage story';saved=await api.changeExpertise('owner',saved.id,{action:'edit',expectedVersion:saved.version,article:{...saved.article,title}});
  saved=await api.changeExpertise('owner',saved.id,{action:'compose',expectedVersion:saved.version});assert.equal(saved.article.title,title,'compose retry preserves manual edit');
  saved=await api.changeExpertise('owner',saved.id,{action:'publish',expectedVersion:saved.version,reviewed:true});assert.ok(saved.publishedUrl);
  const published=clone(state.revisions[0].blocks);const count=state.revisions.length;
  for(const featured of [true,false,true])saved=await api.changeExpertise('owner',saved.id,{action:'feature',expectedVersion:saved.version,featured});
  assert.equal((await api.publicExpertise(saved.id)).article.featured,true,'true/false/true feature selection records fresh events');
  assert.equal(state.revisions.length,count,'featuring does not create unpublished prose');assert.deepEqual(state.revisions[0].blocks,published);
  const exportAction={action:'export',expectedVersion:saved.version,reviewed:true};
  saved=await api.changeExpertise('owner',saved.id,exportAction);await api.changeExpertise('owner',saved.id,exportAction);
  assert.equal(saved.exports.length,1);assert.equal(state.events.filter(e=>e.kind==='expertise_export').length,1,'retry freezes one derivative');assert.deepEqual(state.revisions[0].blocks,published,'export never edits published version');
  corpus.evidence[0].revision='changed';corpus.evidence[0].imageUrl='https://example.com/replaced.jpg';
  assert.equal(await api.publicExpertise(saved.id),null,'changed media fails public read closed');
  saved=await api.readExpertise('owner',saved.id);assert.equal(saved.session.answers.length,2,'source changes retain original answers');assert.equal(saved.exports.length,0,'revoked old export not served');assert.equal(saved.article.media.length,1,'old asset URL removed from author preview');
  await assert.rejects(()=>api.changeExpertise('owner',saved.id,{action:'export',expectedVersion:saved.version,reviewed:true}),/changed|private/);
  saved=await api.changeExpertise('owner',saved.id,{action:'replace',expectedVersion:saved.version,evidenceIds:evidence.map(e=>e.id)});
  assert.equal(saved.sourceChanges.length,0,'replacement repairs current source signature');assert.equal(saved.exports.length,0,'repair cannot resurrect obsolete derivative URL on the same asset identity');
  assert.ok(saved.session.answers.some(a=>a.invalidated),'only affected original answers are flagged for review');
  await assert.rejects(()=>api.changeExpertise('owner',saved.id,{action:'answer',expectedVersion:1,text:'stale tab'}),/another tab/);
  assert.equal(calls,2,'only explicit answer/continue invokes followup');
  console.log('PASS expertise persistence, retries, ownership, publication immutability, featuring, and source revocation');
})().catch(error=>{console.error(error);process.exitCode=1;});
