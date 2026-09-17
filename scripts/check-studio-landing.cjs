const assert = require('node:assert/strict'), fs = require('fs'), vm = require('vm'), ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, imports) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, URLSearchParams, fetch: fetchMock, require: id => id in imports ? imports[id] : require(id) }); return exports; }
const requests = [], destinations = [];
function fetchMock(url, options) { return new Promise(resolve => requests.push({url,body:JSON.parse(options.body),resolve})); }
const navigation = load('src/lib/publishing-studio/navigation.ts', {});
let params = new URLSearchParams();
const data = { workspace: { name: 'BP Design', id: 'bp' }, projects: ['Meru', 'La Gorce'].map((title, i) => ({ id: `p${i}`, title, published: true, canCreate: true, canCreateCampaign: true })), editorials: [], posts: [], campaigns: [], ideas: [], feed: ['Meru', 'La Gorce'].map((title, i) => ({id:`suggestion:p${i}`,projectIds:[`p${i}`],title:`Inside ${title}`,caption:`Prepared caption for ${title}`,imageUrl:`https://example.com/${i}.jpg`,imageUrls:[`https://example.com/${i}.jpg`],revision:'source-v1',kind:'suggestion',format:'project_story',status:'recommended',updatedAt:'2026-09-17',canPolish:true})) };
const hero = load('src/components/instagram-export/CarouselHero.tsx', {});
const feedCard = load('src/components/publishing-studio/StudioFeedCard.tsx', { '@/components/instagram-export/CarouselHero': hero });
const imports = { 'next/dynamic': {default: () => props => React.createElement('div', {'data-campaign-project':props.projectId}, props.projectTitle)}, 'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) }, 'next/navigation': { useRouter: () => ({ replace() { }, push(href) { destinations.push(href); } }), useSearchParams: () => params }, './useStudio': { useStudio: () => ({ data, reload() { } }) }, './StudioFeedCard': feedCard, '@/lib/publishing-studio/navigation': navigation };
const { PublishingStudio } = load('src/components/publishing-studio/PublishingStudio.tsx', imports);
let html = renderToStaticMarkup(React.createElement(PublishingStudio));
assert.match(html, /Polish this post: Inside Meru/); assert.match(html, /Prepared caption for Meru/); assert.match(html, /Inside La Gorce/);
assert.doesNotMatch(html, /Start a project campaign|Choose a published project|Create a post/);
assert.equal((html.match(/aspect-\[4\/5\]/g)||[]).length, 2);
params = new URLSearchParams('project=p0&view=campaigns&create=campaign');
html = renderToStaticMarkup(React.createElement(PublishingStudio));
assert.match(html,/Polish this post: Inside Meru/); assert.doesNotMatch(html,/Inside La Gorce|Choose a published project/);
const {ProjectSocialPanel}=load('src/components/publishing-studio/ProjectSocialPanel.tsx',imports);
html=renderToStaticMarkup(React.createElement(ProjectSocialPanel,{projectId:'p0'}));
assert.match(html,/href="\/designer\/studio\?project=p0"/); assert.match(html,/Inside Meru/); assert.doesNotMatch(html,/Inside La Gorce|create=|view=campaigns/);
params=new URLSearchParams('type=campaign'); html=renderToStaticMarkup(React.createElement(PublishingStudio)); assert.match(html,/No posts match/);
console.log('PASS Studio feed: photo-led proposed posts without social history; legacy campaign link stays populated; same scoped project cards and canonical hub link; explicit type filter.');


async function checkInteractions() {
 const {JSDOM}=require('jsdom'), {createRoot}=require('react-dom/client'), {act}=React;
 const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.test/designer/studio'});
 global.window=dom.window;global.document=dom.window.document;global.IS_REACT_ACT_ENVIRONMENT=true;
 params=new URLSearchParams();
 const root=createRoot(document.getElementById('root'));
 await act(async()=>root.render(React.createElement(PublishingStudio)));
 assert.equal(requests.length,0,'Browsing available cards must not call preparation or generation');
 await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Build a campaign').click());
 assert.equal(document.querySelector('[data-campaign-project]').getAttribute('data-campaign-project'),'p0','Campaign opens directly with source project selected');
 const button=()=>document.querySelector('button[aria-label="Polish this post: Inside Meru"]');
 await act(async()=>button().click());
 assert.equal(requests.length,1);assert.equal(requests[0].url,'/api/publishing-studio/prepare');
 assert.equal(requests[0].body.cardId,'suggestion:p0');assert.equal(requests[0].body.revision,'source-v1');
 await act(async()=>requests[0].resolve({ok:true,json:async()=>({href:'/designer/projects/p0/instagram?export=saved'})}));
 assert.equal(destinations.at(-1),'/designer/projects/p0/instagram?export=saved&studio=all');
 params=new URLSearchParams('project=p0');
 await act(async()=>root.render(React.createElement(PublishingStudio)));
 await act(async()=>button().click());
 await act(async()=>requests[1].resolve({ok:false,json:async()=>({error:'Source changed. Reload your ideas.'})}));
 assert.match(document.querySelector('[role="alert"]').textContent,/Source changed/);assert.equal(destinations.length,1);
 await act(async()=>root.render(React.createElement(ProjectSocialPanel,{projectId:'p0'})));
 await act(async()=>button().click());
 await act(async()=>requests[2].resolve({ok:true,json:async()=>({href:'/designer/projects/p0/instagram?export=saved'})}));
 assert.equal(destinations.at(-1),'/designer/projects/p0/instagram?export=saved&studio=project');
 await act(async()=>root.unmount());
 console.log('PASS Studio interactions: no browse generation; exact prepared card/revision; direct global/project editor routes; visible preparation failure without navigation.');
}
checkInteractions().catch(error=>{console.error(error);process.exitCode=1;});
