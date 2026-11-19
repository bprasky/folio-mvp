// Actual UI, shared theme CSS and local API fixtures. No account, external request or publication.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const esbuild=require('esbuild'),postcss=require('postcss'),tailwind=require('tailwindcss');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.tmp/coverage-browser');fs.mkdirSync(out,{recursive:true});
const entry=`import React from 'react';import{createRoot}from'react-dom/client';
import{ImportPhotoApproval}from'./src/components/onboarding/ImportPhotoApproval';
import{CoverageManager}from'./src/components/coverage/CoverageManager';
import {StudioProfileTools} from './src/components/org-profile/StudioProfileTools';
import {OrgMemberNotices} from './src/components/org-profile/OrgMemberNotices';
import AddRecognitionModal from './src/components/org-profile/AddRecognitionModal';
import OrgProfileHero from './src/components/org-profile/OrgProfileHero';
import ProfileFeed from './src/components/profile/unified/ProfileFeed';
import{ProfileDetails}from'./src/components/profile/ProfileDetails';
const item={id:'public',type:'recognition',publishedAt:'2026-11-01',pinnedAt:null,engagement:0,data:{coverage:{id:'public',title:'A home shaped by its courtyard',source:'Design Journal',url:'https://press.example/story',category:'feature',publicationDate:'2026-10-01',project:null,imageUrl:null}}};
const org={id:'studio',name:'Courtyard Studio',type:'DESIGN_FIRM',description:'A residential design practice in Miami.',location:'Miami',specialties:[],serviceRegions:[],projectTypes:[]};
const next={title:'Review your website import',description:'Choose which projects and photographs appear on your studio profile.',href:'/onboarding/workspace?import=fixture',action:'Open import'};
const studio=<main style={{maxWidth:1100,margin:'0 auto',padding:'24px'}}><OrgProfileHero org={org} projectCount={0} year={2026} isMember/>
  <StudioProfileTools orgId="studio" next={next} isAdmin canInvite><OrgMemberNotices orgId="studio" isOwner isMember canAddToTeam currentUserNeedsProfile/></StudioProfileTools></main>;
createRoot(document.getElementById('root')).render(location.pathname==='/studio' ? studio : location.pathname==='/recognition' ? <AddRecognitionModal open orgId="studio" onOpenChange={()=>{}}/> : <main style={{maxWidth:1100,margin:'0 auto',padding:'24px'}}><header className="folio-h1">FOLIO</header>
<ImportPhotoApproval importId="fixture" onPublished={()=>{window.approvals=(window.approvals||0)+1}}/>
<CoverageManager scope={{type:'organization',id:'studio'}} autoDiscover/>
<ProfileDetails name="Test Studio" organization description="A Miami studio working with natural stone and courtyard homes." location="Miami" specialties={['Residential interiors']}/>
<ProfileFeed userId="owner" initialItems={[item]}/></main>);`;
async function build(){
  await esbuild.build({stdin:{contents:entry,loader:'tsx',resolveDir:root},bundle:true,outfile:path.join(out,'bundle.js'),jsx:'automatic',alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"development"','process.env.NEXT_PUBLIC_FOLIO_EDITORIAL_PROFILE_HERO':'"false"'},plugins:[{name:'framework-boundaries',setup(b){
    b.onResolve({filter:/^next\/(navigation|link|image)$/},a=>({path:a.path,namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'tsx',resolveDir:root,contents:a.path==='next/navigation'?`export const useRouter=()=>({push(){},replace(){},refresh(){}});export const useSearchParams=()=>new URLSearchParams();export const usePathname=()=>'/profile/owner';`:a.path==='next/link'?`import React from'react';export default({href,children,prefetch,...props})=><a href={href} {...props}>{children}</a>;`:`import React from'react';export default({fill,priority,unoptimized,quality,loader,...props})=><img {...props}/>;`}));
  }}]});
  let globals=fs.readFileSync(path.join(root,'src/app/globals.css'),'utf8').replace(/@import\s+"([^"]+)";/g,(_,file)=>file.startsWith('../styles/')?fs.readFileSync(path.resolve(root,'src/app',file),'utf8'):'');
  const config=require('../tailwind.config.js');config.content=[path.join(root,'src/**/*.{tsx,ts}'),{raw:entry,extension:'tsx'}];
  globals=(await postcss([tailwind(config)]).process(globals,{from:path.join(root,'src/app/globals.css')})).css;
  fs.writeFileSync(path.join(out,'globals.css'),globals+'@font-face{font-family:FixtureHeadline;src:url(/fonts/CormorantGaramond.ttf)}@font-face{font-family:FixtureBody;src:url(/fonts/InstrumentSans.ttf)}:root{--font-headline:FixtureHeadline;--font-body:FixtureBody}body{background:var(--surface-ground);color:var(--folio-text-primary)}');
}
let live=new Set(),fail=true,coverage=[],searches=0,payloads=[];
const pending=()=>({id:'coverage',version:'2026-11-17T00:00:00.000Z',scope:{type:'organization',id:'studio'},state:'pending',title:'A home shaped by its courtyard',source:'Design Journal',url:'https://press.example/story',category:'interview',publicationDate:null,matchReason:'Matches the studio and its Courtyard House project.',projectId:'p1',useForInterview:false,readStatus:'unread',readMessage:''});
const review=()=>({items:coverage,projects:[{id:'p1',title:'Courtyard House',isPublic:true}]});
const photoProjects=()=>['p1','p2'].filter(id=>!live.has(id)).map((id,i)=>({projectId:id,title:id==='p1'?'Courtyard House':'Waterfront Home',version:'a'.repeat(64),coverImageId:id+'-1',photos:[1,2].map(n=>({id:id+'-'+n,url:'/photo.svg',name:'Photograph '+n,inclusion:'INCLUDED'}))}));
function handler(req,res){const url=new URL(req.url,'http://fixture');const json=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))};
  if(url.pathname==='/api/onboarding/workspace/fixture/publish'){
    if(req.method==='GET')return json({profileHref:'/org/studio',projects:photoProjects()});
    let body='';req.on('data',d=>body+=d);req.on('end',()=>{const data=JSON.parse(body);payloads.push(data);const results=data.projects.map(p=>{const published=!(fail&&p.projectId==='p2');if(published)live.add(p.projectId);return{projectId:p.projectId,published}});fail=false;json({results,profileHref:'/org/studio'})});return;
  }
  if(url.pathname==='/api/orgs/studio/members/missing-from-team')return json({missing:[{userId:'member',name:'Avery Lane',email:'avery@example.test',orgRole:'MEMBER',hasBio:false,title:null,profileImage:null}]});
  if(url.pathname==='/api/coverage'){
    if(req.method==='GET')return json(review());
    let body='';req.on('data',d=>body+=d);req.on('end',()=>{const data=JSON.parse(body);if(req.method==='POST'){searches++;coverage=[pending()];return json({...review(),found:1})}
      if(data.action==='read')coverage[0]={...coverage[0],version:'2026-11-17T00:00:01.000Z',readStatus:'read',readMessage:'Article text is available to inform your interview.'};
      else coverage[0]={...coverage[0],...data,state:data.action==='approve'?'approved':'dismissed'};json(review());});return;
  }
  if(url.pathname.startsWith('/api/'))return json({items:[]});
  if(url.pathname.startsWith('/fonts/')){res.setHeader('Content-Type','font/ttf');return res.end(fs.readFileSync(path.join(root,'public/fonts/publication',path.basename(url.pathname))))}
  if(url.pathname==='/photo.svg'){res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#c6b8a2"/><rect x="430" y="30" width="330" height="420" fill="#e8ece0"/><path d="M0 450L800 390V600H0Z" fill="#817a6a"/><rect x="60" y="350" width="400" height="150" rx="6" fill="#ede6da"/></svg>')}
  if(['/bundle.js','/bundle.css','/globals.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');return res.end(fs.readFileSync(path.join(out,path.basename(url.pathname))))}
  if(url.searchParams.has('reset')){live=new Set();coverage=[];fail=true;searches=0;payloads=[]}
  const theme=url.searchParams.get('theme')==='dark'?'dark':'light';res.end(`<!doctype html><html data-theme="${theme}" class="${theme==='dark'?'dark':''}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);
}
// Compare the rendered label with its own background, compositing translucent
// backgrounds and element opacity through each ancestor up to the canvas.
async function checkLabel(page,selector){
  await page.waitForSelector(selector,{visible:true});
  const {label,ratio}=await page.$eval(selector,async element=>{
    await Promise.all(element.getAnimations().map(animation=>animation.finished));
    const color=value=>value.match(/[\d.]+/g).map(Number);
    const over=(front,back)=>{
      const alpha=front[3]+back[3]*(1-front[3]);
      return [...front.slice(0,3).map((v,i)=>alpha?(v*front[3]+back[i]*back[3]*(1-front[3]))/alpha:0),alpha];
    };
    const layer=value=>{const [r,g,b,a=1]=color(value);return [r,g,b,a]};
    let ink=layer(getComputedStyle(element).color),paper=[0,0,0,0];
    for(let el=element;el;el=el.parentElement){
      const style=getComputedStyle(el),background=layer(style.backgroundColor);
      if(paper[3]<1 && style.backgroundImage!=='none')throw Error('Contrast fixture needs a solid surface for '+element.textContent);
      ink=over(ink,background);paper=over(paper,background);
      ink[3]*=Number(style.opacity);paper[3]*=Number(style.opacity);
    }
    const luminance=rgba=>over(rgba,[255,255,255,1]).slice(0,3).reduce((sum,value,i)=>{
      const v=value/255;
      return sum+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    },0);
    const a=luminance(ink),b=luminance(paper);
    return {label:element.textContent.trim(),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
  assert.ok(ratio>=4.5,label+' rendered at '+ratio.toFixed(2)+':1 on '+page.url());
  return ratio;
}
(async()=>{await build();if(process.argv.includes('--build-only'))return console.log('PASS real coverage and import approval components bundle');const server=http.createServer(handler);await new Promise(r=>server.listen(process.argv.includes('--serve')?3111:0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;if(process.argv.includes('--serve'))return console.log('Coverage review fixture: '+base);
  let browser;try{browser=await require('puppeteer-core').launch({executablePath:process.env.GUIDED_TEST_BROWSER||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message)});page.setDefaultTimeout(10000);
    await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')?r.continue():r.abort());
    // A reload replaces the button after the fetch resolves. Locators re-resolve
    // the element and wait for a stable, enabled control before the real click.
    const click=async text=>{console.log('Click:',text);await page.locator('button::-p-text('+text+')').click()};
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    for(const theme of ['light','dark'])for(const width of [390,1440]){
      await page.setViewport({width,height:1000});
      await page.goto(base+'/studio?theme='+theme,{waitUntil:'networkidle0'});
      await page.waitForSelector('button::-p-text(Manage profile)');
      assert.equal(await page.$('a[href="/onboarding/workspace?import=fixture"]'), null, 'private next step stays in its sheet');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:path.join(out,'studio-'+theme+'-'+width+'.png'),fullPage:true});
      const next='a[href="/onboarding/workspace?import=fixture"]',team='[aria-label="Members to add to team"] button',complete='a[href="/profile"]';
      const ratios=[await checkLabel(page,'button::-p-text(Manage profile)')];
      await click('Manage profile');
      await page.waitForSelector(next, {visible:true});
      ratios.push(await checkLabel(page,next));
      await page.waitForSelector('a[href="/org/studio/edit"]',{visible:true});
      for(const selector of [team,complete,'button[aria-label="Dismiss"]','a[href="/org/studio/edit"]'])ratios.push(await checkLabel(page,selector));
      await page.hover(team);ratios.push(await checkLabel(page,team));
      await page.focus(complete);ratios.push(await checkLabel(page,complete));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:path.join(out,'studio-controls-'+theme+'-'+width+'.png'),fullPage:true});
      await page.goto(base+'/recognition?theme='+theme,{waitUntil:'networkidle0'});
      for(const selector of ['button[aria-pressed="true"]','button[aria-pressed="false"]','[role="dialog"] button:disabled'])ratios.push(await checkLabel(page,selector));
      await page.click('button[aria-pressed="false"]');
      await page.type('input[placeholder="Featured in Luxe Interiors + Design"]','Courtyard House');
      ratios.push(await checkLabel(page,'[role="dialog"] button::-p-text(Add Recognition)'));
      await page.goto(base+'?reset=1&theme='+theme,{waitUntil:'networkidle0'});
      ratios.push(await checkLabel(page,'[aria-label="Publish imported photographs"] button'));
      console.log('PASS '+theme+' '+width+'px profile control contrast, minimum '+Math.min(...ratios).toFixed(2)+':1');
      // Local storage guards the background sweep across tabs and visits; explicit search remains available.
      await page.evaluate(()=>localStorage.clear());if(!searches){await click('Find & manage coverage');await click('Find my coverage');await page.click('[aria-label="Close coverage review"]')}
      await click('Add 2 projects to my profile');await page.waitForFunction(()=>document.body.textContent.includes('1 project is now visible'));
      assert.equal(live.size,1);assert.equal(payloads[0].projects.length,2);assert.equal(payloads[0].projects[0].includedImageIds.length,2);
      await click('Reload photographs');await click('Add 1 project to my profile');await page.waitForFunction(()=>window.approvals===2);assert.equal(live.size,2);
      assert.ok(await page.$('details p'), 'Useful profile copy is present before opening details');
      assert.ok(await page.$('a[href="https://press.example/story"]'), 'Initial feed contains a crawlable source link');
      await click('Review 1 possible feature');await click('Read for interview context');await page.waitForFunction(()=>document.body.textContent.includes('Article text is available'));
      assert.ok(await page.$('input[type="checkbox"]'));assert.equal(coverage[0].useForInterview,false);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
      await page.screenshot({path:path.join(out,`${theme}-${width}.png`),fullPage:true});
      await click('This is our work \u2014 add to Folio');await page.waitForFunction(()=>document.body.textContent.includes('On your Folio'));assert.equal(coverage[0].state,'approved');
      await page.keyboard.press('Escape');await page.waitForSelector('[role="dialog"]',{hidden:true});assert.equal(await page.$('[role="dialog"]'),null);
    }
    assert.deepEqual(errors,[]);console.log('PASS actual UI: bulk publication, partial recovery, background sweep, review/read/approve, initial feed links, keyboard close and mobile/desktop light/dark layouts');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
