import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { canonicalTypeDisplay } from '../scripts/review-typescript-display.mjs';
const files=['src/app/api/admin/organizations/route.ts','src/app/api/consultations/[consultationId]/chat/route.ts','src/app/api/cron/dormancy-check/route.ts','src/app/api/projects/[id]/export/route.ts'];
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const root=process.cwd(), client=path.resolve('node_modules/.prisma/client/index.d.ts');
const activeClient=fs.readFileSync(client,'utf8');
// Counterfactual declaration overlay only: remove the single additive property
// from generated declarations. No disk schema/client mutation or regeneration.
const oldClient=activeClient.replace(/^\s*(?:readonly )?membersCanPublish\??:.*\r?\n/gm,'').replaceAll(' | "membersCanPublish"','');
assert(!oldClient.includes('membersCanPublish'));
for(const file of files){const current=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');const before=execFileSync('git',['show','HEAD:'+file],{encoding:'utf8'}).replaceAll('\r\n','\n');assert.equal(current,before,'Source changed '+file);}
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile);const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root,{noEmit:true,incremental:false});
function snapshot(prior){
 const host=ts.createCompilerHost(parsed.options);const original=host.readFile.bind(host);
 host.readFile=file=>path.resolve(file)===client&&prior?oldClient:original(file);
 const program=ts.createProgram({rootNames:parsed.fileNames,options:parsed.options,host});const checker=program.getTypeChecker();
 const out=[];
 for(const d of ts.getPreEmitDiagnostics(program)){
  const file=d.file&&path.relative(root,d.file.fileName).replaceAll('\\','/');if(!files.includes(file)||d.code!==2339)continue;
  let access;const visit=node=>{if(ts.isPropertyAccessExpression(node)&&node.name.getStart(d.file)===d.start)access=node;ts.forEachChild(node,visit);};visit(d.file);
  assert(access,'Property access witness missing');
  const type=checker.getTypeAtLocation(access.expression);
  out.push({file,code:d.code,start:d.start,length:d.length,sourceSha256:hash(d.file.text),property:access.name.text,propertyExists:!!checker.getPropertyOfType(type,access.name.text),message:ts.flattenDiagnosticMessageText(d.messageText,' ').replace(/\s+/g,' ').trim(),fullType:checker.typeToString(type,access.expression,ts.TypeFormatFlags.NoTruncation)});
 }
 return out;
}
console.log('Capturing counterfactual prior declarations');const before=snapshot(true);console.log('Capturing active declarations');const after=snapshot(false);
const baseline=JSON.parse(fs.readFileSync('tools/typescript-baseline.json'));const table=JSON.parse(fs.readFileSync('tools/typescript-display-equivalences.json'));assert.equal(ts.version,table.compilerVersion);
const entries=new Map();
for(const a of after){const b=before.find(x=>x.file===a.file&&x.start===a.start&&x.length===a.length&&x.code===a.code&&x.sourceSha256===a.sourceSha256);assert(b);if(a.message===b.message)continue;assert.equal(a.propertyExists,false);assert.equal(b.propertyExists,false);assert.equal(a.property,b.property);
 const withoutField=a.fullType.replace(/membersCanPublish: boolean; ?/g,'');assert.notEqual(withoutField,a.fullType);assert.equal(canonicalTypeDisplay(withoutField),canonicalTypeDisplay(b.fullType),'Other type change '+a.file);
 const known=baseline.diagnostics.find(r=>r[0]===b.file&&r[1]===b.code&&r[2]===b.message)||baseline.diagnostics.find(r=>r[0]===b.file&&r[1]===b.code&&r[2]===table.entries.find(e=>e.file===b.file&&e.code===b.code&&e.after===b.message)?.before);assert(known,'Unknown prior fingerprint '+b.file);
 const key=JSON.stringify([a.file,a.code,a.message]);let entry=entries.get(key);if(!entry){entry={file:a.file,code:a.code,before:known[2],after:a.message,count:0,reason:'Approved Organization.membersCanPublish scalar changes only inferred type display; identical missing-property diagnostic at unchanged source span.',occurrences:[]};entries.set(key,entry);}entry.count++;entry.occurrences.push({start:a.start,length:a.length,sourceSha256:a.sourceSha256,property:a.property,propertyExistsBefore:false,propertyExistsAfter:false,priorRendering:b.message,beforeFullType:b.fullType,afterFullType:a.fullType});
}
const proof=[...entries.values()];assert.equal(proof.reduce((n,r)=>n+r.count,0),7);assert.equal(proof.length,4);
for(const {occurrences,...entry} of proof){assert(!table.entries.some(e=>e.file===entry.file&&e.code===entry.code&&e.after===entry.after));table.entries.push(entry);}
fs.writeFileSync('tools/typescript-display-equivalences.json',JSON.stringify(table,null,2)+'\n');
fs.writeFileSync('docs/reviews/FIRM_ENROLLMENT_TYPESCRIPT_DISPLAY_PROOF.json',JSON.stringify({compilerVersion:ts.version,base:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),method:'Same application source and compiler, CompilerHost counterfactual declaration overlay removing only Organization.membersCanPublish. Identical source hashes/spans and missing-property lookup; full receiver types identical after removing that additive boolean and canonical property ordering. Active client/schema never modified.',activeClientSha256:hash(activeClient),counterfactualClientSha256:hash(oldClient),baselineSha256:hash(fs.readFileSync('tools/typescript-baseline.json')),budget:baseline.total,entries:proof},null,2)+'\n');console.log('Proved 7 occurrences across 4 exact fingerprints; baseline unchanged');
