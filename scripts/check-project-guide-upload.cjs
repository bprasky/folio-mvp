// Real route body, synthetic auth/storage/Prisma boundaries. No credentials or external IO.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let actor='viewer',writes=0,storage=0,revalidated=[];
const mocks={
 'zod':require('zod'),
 '@/lib/server/safe-product-url':{UnsafeProductUrl:class extends Error{},parseProductUrl:()=>{throw Error('Unexpected URL upload')},safeProductResource:()=>{throw Error('Unexpected external fetch')}},
 'next/server':{NextResponse:{json:(value,init)=>Response.json(value,init)}},
 'next-auth':{getServerSession:async()=>actor?{user:{id:actor}}:null},
 '@/app/api/auth/[...nextauth]/options':{authOptions:{}},
 '@/lib/authz/access':{assertProjectWrite:async(id,project)=>{assert.equal(project,'project');if(id!=='owner')throw Error('Forbidden: Insufficient permissions');}},
 '@/lib/prisma':{prisma:{projectImage:{create:async({data})=>{writes++;return{id:'image',...data}}}}},
 '@/lib/storage':{saveBufferToProjectStorage:async()=>{storage++;return{publicUrl:'https://storage.test/image'}}},
 '@/lib/search/indexMoment':{indexMoment:async()=>{}},'next/cache':{revalidatePath:path=>revalidated.push(path)}
};
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/projects/[id]/images/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,require:name=>{if(!(name in mocks))throw Error(name);return mocks[name]},console:{log(){},error(){},warn(){}},Buffer,URL,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://storage.test'}},fetch:()=>{throw Error('Unexpected external fetch')},AbortSignal});
const upload=()=>exportsObject.POST(new Request('https://folio.test/api/projects/project/images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageData:'aW1hZ2U=',mimeType:'image/png',name:'Room'})}),{params:{id:'project'}});
(async()=>{assert.equal((await upload()).status,403);assert.equal(writes,0);assert.equal(storage,0);actor=null;assert.equal((await upload()).status,401);assert.equal(storage,0);actor='owner';assert.equal((await upload()).status,201);assert.equal(writes,1);assert.equal(storage,1);assert.deepEqual(revalidated,['/project/project']);console.log('PASS guide upload: viewers/anonymous rejected before storage; owner upload succeeds and revalidates project.');})().catch(error=>{console.error(error);process.exitCode=1});
