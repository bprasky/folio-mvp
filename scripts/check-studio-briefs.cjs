const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const exportsUnderTest = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/publishing-studio/recommendations.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsUnderTest});
const {recommendStudioStories:rank} = exportsUnderTest;
const card = (project, room = true) => ({id:project+(room?':room':':overview'),projectIds:[project],kind:'suggestion',roomId:room?'room':undefined,updatedAt:'2026-09-18',pitch:'A supported design decision.'});
const data = {evaluatedAt:'2026-09-18T14:00:00Z', projects:[
  {id:'new',title:'New home',publishedAt:'2026-09-12'},
  {id:'old',title:'Older home',publishedAt:'2024-01-01'},
  {id:'unknown',title:'Unknown date'},
],feed:[card('old'),card('new'),card('unknown'),card('new',false)]};
let result=rank(data,data.feed);
assert.equal(result[0].id,'project:new');
assert.match(result[0].reason,/New to Folio/);
assert(!result.some(group=>/completed|trending/.test(group.reason)));
assert.match(result.find(group=>group.id==='project:old').title,/refresh/);
assert.match(result.find(group=>group.id==='project:unknown').title,/Stories from/);
assert.equal(result[0].cards[0].roomId,'room');
assert.equal(result.flatMap(g=>g.cards).length,data.feed.length);
assert.equal(rank(data,[card('old')]).length,1,'filter first; do not reintroduce hidden cards');
assert.equal(rank(data,[]).length,0);
assert.equal(rank({...data,projects:[{id:'new',title:'Future',publishedAt:'2027-01-01'}]},[card('new')])[0].label,'Project focus');
const busy={...data,feed:[...data.feed,...[1,2,3].map(id=>({id:'saved'+id,projectIds:['new'],kind:'carousel',status:'exported',updatedAt:'2026-09-17'}))]};
result=rank(busy,data.feed);
assert.equal(result[0].id,'project:old','recent saved activity reduces repetition');
assert.match(result.find(g=>g.id==='project:new').reason,/recently worked/);
assert(!result.some(g=>g.reason.includes('posted')),'export is not publication');
assert.equal(JSON.stringify(rank(data,data.feed)),JSON.stringify(rank({...data,evaluatedAt:'2026-09-18T23:00:00Z'},data.feed)),'stable throughout the day');
const weak={...data,feed:[card('new',false),card('old')]};
assert.equal(rank(weak,weak.feed)[0].id,'project:old','substance wins over recency alone');
const peers={...data,projects:['a','b','c'].map(id=>({id,title:id,publishedAt:'2024-01-01'})),feed:['a','b','c'].map(id=>card(id))};
const leaders=new Set(Array.from({length:12},(_,i)=>rank({...peers,evaluatedAt:new Date(Date.UTC(2026,8,18+i*7)).toISOString()},peers.feed)[0].id));
assert(leaders.size>1,'equally strong archive projects get turns across weeks');
console.log('PASS Studio briefs: source grouping, substance, true publication timing, unknown/future dates, saved activity, stable ordering and filters.');
