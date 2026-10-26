// Real React forms in Chromium; synthetic auth, HTTP and navigation only.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild'), puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/rollout-recovery');
let calls = [], failUpload = true, failSave = false;
async function main() {
  fs.mkdirSync(out, {recursive:true});
  await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';
import Modal from './src/components/ProjectCreationModal';
window.closedCount=0;window.savedCount=0;
createRoot(document.getElementById('root')).render(<Modal isOpen onClose={()=>{window.closedCount++;sessionStorage.setItem('closed','1')}} onProjectCreated={()=>window.savedCount++} currentUserId="owner" currentUserRole="DESIGNER"/>);`,loader:'tsx',resolveDir:root},bundle:true,platform:'browser',jsx:'automatic',outfile:path.join(out,'app.js'),alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},plugins:[{name:'boundaries',setup(build){
    build.onResolve({filter:/^(next\/(image|navigation|link)|next-auth\/react|@\/components\/interviews\/CreateProjectGuide)$/},args=>({path:args.path,namespace:'fixture'}));
    build.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'jsx',resolveDir:root,contents:args.path==='next/navigation'?`const router={push:url=>window.navigation=url,replace:url=>window.navigation=url};export const useRouter=()=>router;`:
      args.path==='next-auth/react'?`const data={user:{id:'owner',operatingAsOrgId:'org'}};export const useSession=()=>({data,status:'authenticated'});`:
      args.path.includes('CreateProjectGuide')?`import React from'react';export const CreateProjectGuide=({onManual})=><button onClick={onManual}>Manual entry</button>;`:
      args.path==='next/link'?`import React from'react';export default props=><a {...props}/>;`:
      `import React from'react';export default({fill,priority,unoptimized,...props})=><img {...props}/>;`}));
  }}]});
  fs.writeFileSync(path.join(out,'photo.png'),await require('sharp')({create:{width:8,height:6,channels:3,background:'#ccc'}}).png().toBuffer());
  const server=http.createServer((req,res)=>{
    const route=req.url.split('?')[0];
    const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
    if(route==='/app.js')return fs.createReadStream(path.join(out,'app.js')).pipe(res);
    if(!route.startsWith('/api/'))return res.end('<html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/app.js"></script></html>');
    if(route==='/api/user/workspace-context')return json({operatingAsOrgId:'org',organizations:[{id:'org',userRole:'OWNER'}]});
    if(req.method==='GET')return json([]);
    let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
      calls.push({route,method:req.method,body:JSON.parse(body||'{}')});
      if(route==='/api/projects')return json(failSave?{error:'fixture save failure'}:{id:'saved-project'},failSave?503:200);
      if(route.endsWith('/images')){if(failUpload){failUpload=false;return json({error:'fixture upload failure'},503);}return json({image:{id:'saved-image'}});}
      return json({id:'fixture'});
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await puppeteer.launch({executablePath:process.env.GUIDED_TEST_BROWSER||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    const page=await browser.newPage();page.on('pageerror',err=>console.error(err));
    const base=`http://127.0.0.1:${server.address().port}`;
    const click=async label=>{for(const button of await page.$$('button'))if((await button.evaluate(el=>el.textContent.trim()))===label){await button.click();return;}throw Error('Missing button '+label);};
    for(const width of [390,1440]){
      calls=[];failUpload=true;failSave=false;await page.setViewport({width,height:1000});await page.goto(base+'/modal');await page.evaluate(()=>sessionStorage.removeItem('closed'));
      await page.waitForSelector('input[placeholder="Enter project name"]');await page.type('input[placeholder="Enter project name"]','Recovery house');
      await page.type('input[placeholder="Client or company name"]','Residential');
      // The original modal requires a project category before advancing.
      await page.evaluate(()=>{const select=document.querySelector('select');if(select){select.value=[...select.options].find(o=>o.value)?.value;select.dispatchEvent(new Event('change',{bubbles:true}));}});
      await click('Next: Add Images');await (await page.$('input[type=file]')).uploadFile(path.join(out,'photo.png'));
      await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(el=>el.textContent.trim()==='Next: Tag Products'&&!el.disabled));
      await click('Next: Tag Products');await click('Create Project');
      await page.waitForFunction(()=>document.body.textContent.includes('Retry to finish'));
      assert.equal(await page.evaluate(()=>window.closedCount),0);
      await click('Create Project');await page.waitForFunction(()=>sessionStorage.getItem('closed')==='1');
      assert.equal(calls.filter(c=>c.route==='/api/projects'&&c.method==='POST').length,1);
      assert.equal(calls.filter(c=>c.route==='/api/projects'&&c.method==='PUT').length,1);
      assert.equal(calls.filter(c=>c.route.endsWith('/images')).length,2);
      console.log(`PASS modal upload failure stays open and retry reuses project (${width}px)`);

    }
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
