const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const pure = require('./studio-publication-test-import.cjs');
const hooks = pure('./publication-headlines');
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports,require:id => mocks[id] || pure(id) || require(id)});
  return exports;
}
assert.deepEqual(Array.from(hooks.sourceSentences('We reduced the island by 2.5 feet. Dr. Jones approved the plan.')), ['We reduced the island by 2.5 feet.', 'Dr. Jones approved the plan.']);
assert.deepEqual(Array.from(hooks.publicationHeadlines(['Living room','A closer look at the house','Opening the kitchen to the garden','x'.repeat(100)], ['Living room'])), ['Opening the kitchen to the garden']);
const {buildStudioFeed,preparedConfig} = load('src/lib/publishing-studio/feed.ts', {'./opportunities':{feedOpportunity:()=>({})}});
const project = {id:'p',title:'Garden House',ownerId:'owner',designerId:'owner',isPublic:true,designer:{name:'Mira'},rooms:[{id:'r',name:'Living room'}],
  images:[{id:'image',url:'/source.jpg',roomId:'r',room:null,inclusion:'INCLUDED'}],post:{status:'PUBLISHED',updatedAt:new Date(),heroAssetId:'image',excerpt:'A home arranged around a planted courtyard, with rooms that open toward the garden.',
    expandedBlocks:{lead:{kicker:'A home around the courtyard',kickerAlternatives:['An unselected idea']},galleryChapters:[{roomId:'r',title:'The opening that changed the room',body:['We replaced the wall with an opening toward the garden. The original plan blocked the view from the living room, so the design team tested a different arrangement before deciding on the final location of the opening.']}]}}};
let cards = buildStudioFeed([project],[],[],[],'owner',false);
assert.equal(cards[0].title,'A home around the courtyard');
assert.equal(cards[0].publicationIntent,'cross_post');
assert(!cards[0].headlineOptions.includes('An unselected idea'));
const room = cards.find(card=>card.roomId==='r');
assert.equal(room.title,'The opening that changed the room');
assert.equal(preparedConfig(room).headline,room.title);
assert.equal(preparedConfig(room).selectedImageUrls[0],'/source.jpg');
cards = buildStudioFeed([project],[{id:'saved',projectId:'p',headline:'My edited cover',caption:'My edited caption',status:'draft',updatedAt:new Date(),config:{studioCardId:room.id,roomId:'r',selectedImageUrls:['/source.jpg']}}],[],[],'owner',false);
assert(!cards.some(card=>card.id===room.id));
assert.equal(cards.find(card=>card.exportId==='saved').title,'My edited cover');
assert.equal(cards.find(card=>card.exportId==='saved').caption,'My edited caption');
assert.equal(cards.find(card=>card.exportId==='saved').roomId,'r');
assert.equal(hooks.activityHeadline('twenty_questions','Mira'),'Meet Mira');
assert.equal(hooks.activityHeadline('material','Mira'), 'How do I choose a material?');
console.log('PASS audience hooks: published title selection, no unselected alternatives, decimal/attribution fidelity, same prepared cover, personal question framing, saved edits and room attribution.');
