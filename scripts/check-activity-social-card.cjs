const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const rendered=[];
const ctx={measureText:text=>({width:text.length*20}),fillRect(){},fillText(text){rendered.push(text);},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
const canvas={getContext:()=>ctx,toBlob:callback=>callback(new Blob(['png'],{type:'image/png'}))};
const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/publishing-studio/social-answer-card.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,document:{fonts:{ready:Promise.resolve()},documentElement:{},createElement:()=>canvas},getComputedStyle:()=>({getPropertyValue:()=>''}),Blob,Promise});
async function main(){
const {wrapCardText,socialAnswerCardFits,renderSocialAnswerCard}=exportsObject;
const wrapped=wrapCardText('A thoughtful room\nWith daylight',text=>text.length,10);assert.equal(wrapped.join(' ').replace(/\s+/g,' '),'A thoughtful room With daylight');assert(wrapped.every(line=>line.length<=10));
assert.equal(wrapCardText('abcdefghijklmnop',text=>text.length,5).join(''),'abcdefghijklmnop');
assert(socialAnswerCardFits(2,8));assert(!socialAnswerCardFits(10,20));
const blob=await renderSocialAnswerCard('What feels like home?','Warm light and familiar objects.','A Designer');assert.equal(blob.type,'image/png');assert.equal(canvas.width,1080);assert.equal(canvas.height,1350);assert(rendered.includes('Warm light and familiar objects.'));assert(rendered.includes('A Designer'));assert(rendered.includes('FOLIO'));
await assert.rejects(renderSocialAnswerCard('Question?','word '.repeat(1000),'A Designer'),/too long/);
console.log('PASS activity social image: exact answer text, measured wrapping, branded portrait PNG and explicit overlong rejection.');}
main().catch(error=>{console.error(error);process.exitCode=1;});
