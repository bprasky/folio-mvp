const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/publishing-studio/opportunities.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,URLSearchParams});
const {personalIntroductionOpportunity:personal,activityOpportunity,feedOpportunity,candidateOpportunity}=exportsObject;
assert.match(personal.path,/20-question/);assert.match(personal.result,/review and edit/);assert.match(personal.destination,/About section/);assert.doesNotMatch(JSON.stringify(personal),/seconds|quick|pinned|leads|conversion/i);
for(const format of ['qa','material','method']){const value=activityOpportunity(format);assert.match(value.metadata,/5 questions/);assert.match(value.href,new RegExp('format='+format));assert.match(value.path,/five/);assert.ok(value.purpose&&value.reason&&value.result&&value.destination&&value.action);}
assert.match(activityOpportunity('qa',{id:'p',title:'A home'}).href,/chooseRoom=1/);
assert.match(activityOpportunity('bio').destination,/publish/);
const card={kind:'suggestion',format:'project_story',projectIds:['p'],title:'Home',caption:'Actual published overview'};
const before=JSON.stringify(card),value=feedOpportunity(card,'Home');assert.match(value.purpose,/Give Home a fuller introduction/);assert.equal(JSON.stringify(card),before);assert.doesNotMatch(JSON.stringify(value),/never unveiled|first ever|scheduled|published automatically/i);
const blocked={shape:'material',readiness:'quick',blockers:[{question:'Why?',kind:'truth'}],rationale:'Needs source support'};
assert.match(candidateOpportunity(blocked).result,/export waits/);assert.match(candidateOpportunity(blocked).path,/1 remaining step/);assert.equal(blocked.readiness,'quick');
assert.match(feedOpportunity({...card,kind:'idea',projectIds:['a','b']},'Homes').result,/direction to keep/);
console.log('PASS opportunity promises: actual effort, destinations, no inferred publication, source immutability and blocked readiness.');
