// Explicit opt-in only. Three synthetic fixtures; no application data or database writes.
if (!process.argv.includes('--live')) { console.log('Use --live for three bounded synthetic provider calls.'); process.exit(0); }
require('dotenv').config({ path: '.env.local', quiet: true });require('dotenv').config({ path: '.env', quiet: true });
const fs = require('node:fs');
const { generateActivity } = require('./lib/load-story-activity.cjs').load('src/lib/publishing-studio/generate-activity.ts');
const first = require('./fixtures/story-activity-context.json');
const second = { ...first, designerName: 'Sam Rivera', references: [
  { id:'bio:education',kind:'bio',text:'SYNTHETIC TEST PROFILE. Sam studied furniture design in Providence, Rhode Island, and now works in Chicago.' },
  { id:'bio:collecting',kind:'bio',text:'Sam collects vintage maps and spends weekends looking through secondhand bookshops.' },
  { id:'bio:habits',kind:'bio',text:'Sam starts each design with a collage of photographs and painted paper.' },
  { id:'bio:background',kind:'bio',text:'Sam grew up in a family of musicians and enjoys building small speakers.' },
  { id:'project:studio',kind:'project',projectId:'p1',text:'The recent Garden House project used deep green walls, a long oak bench, and recycled glass lights. Sam tested the bench height with cardboard mockups. A quiet corner was set aside for listening to records.' },
] };
(async()=>{
  const results=[];
  for(const [name,brief,context] of [
    ['Alex designer',{subject:'designer',format:'twenty_questions'},first],
    ['Sam designer',{subject:'designer',format:'twenty_questions'},second],
    ['Garden living room',{subject:'project',projectId:'p1',roomId:'r1',format:'qa'},first],
  ]) {
    if(process.argv.includes('--project-only') && brief.subject!=='project')continue;
    try { const definition=await generateActivity(brief,context);results.push({name,definition});console.log(name,definition.questions.length,'validated questions'); }
    catch(error){results.push({name,error:error.message});console.log(name,'FAILED:',error.message);process.exitCode=1;}
  }
  fs.mkdirSync('.tmp/story-activities',{recursive:true});fs.writeFileSync(process.argv.includes('--project-only')?'.tmp/story-activities/project-question-eval.json':'.tmp/story-activities/question-eval.json',JSON.stringify(results,null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
