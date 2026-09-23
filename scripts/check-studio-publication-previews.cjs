const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const pure = require('./studio-publication-test-import.cjs');
function load(file, mocks={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>mocks[id] || pure(id) || require(id)});return exports;}
const svg=pure('@/lib/instagram-export/svg-templates');
const {CarouselHero}=pure('@/components/instagram-export/CarouselHero');
const {JSDOM}=require('jsdom');
for(const [ratio,height] of [['1:1',1080],['4:5',1350],['9:16',1920]]) for(const position of ['bottom_left','bottom_center','top_left']) {
 const html=renderToStaticMarkup(React.createElement(CarouselHero,{imageUrl:'/chosen.jpg',headline:'A saved & edited title',aspectRatio:ratio,headlinePosition:position,watermarkText:'folio presents Example Designer'}));
 const dom=new JSDOM(html);const images=[...dom.window.document.querySelectorAll('img')];
 assert.equal(images[0].getAttribute('src'),'/chosen.jpg');
 const layers=images.slice(1).map(image=>decodeURIComponent(image.getAttribute('src').split(',')[1]));
 assert.equal(layers[0],svg.createGradientOverlaySVG(1080,height,position));
 assert.equal(layers[1],svg.createHeadlineSVG('A saved & edited title',1080,height,position));
 assert.equal(layers[2],svg.createWatermarkSVG('folio_presents','Example Designer',1080,height,position));
 dom.window.close();
}
const feed=load('src/lib/publishing-studio/feed.ts',{'./opportunities':{feedOpportunity:()=>({})}});
const saved=feed.savedPublicationPreview({selectedImageUrls:['/chosen.jpg','/revoked.jpg'],aspectRatio:'1:1',headlinePosition:'top_left',watermarkStyle:'folio_presents',designerName:'Example'},[{url:'/chosen.jpg'},{url:'/other.jpg'}],'Fallback');
assert.equal(saved.imageUrl,'/chosen.jpg');assert.deepEqual(Array.from(saved.imageUrls),['/chosen.jpg']);assert.equal(saved.preview.watermarkText,'folio presents Example');assert.equal(saved.preview.aspectRatio,'1:1');
assert.equal(feed.savedPublicationPreview({selectedImageUrls:['/revoked.jpg','/other.jpg']},[{url:'/other.jpg'}],'Example').imageUrl,null,'A missing saved cover must never silently become another photograph');
const {ActivityArticleCover}=pure('./ActivityArticleCover');
for(const identity of [{name:'Example Designer'},{name:'Example Designer',portraitUrl:'/portrait.jpg',logoUrl:'/logo.svg'},{name:'Example Designer',logoUrl:'/logo.svg'}]) {
 const html=renderToStaticMarkup(React.createElement(ActivityArticleCover,{title:'My saved title',identity,working:true}));assert.match(html,/My saved title/);assert.match(html,/Example Designer/);assert.match(html,/Working preview/);
 if(identity.portraitUrl){assert.match(html,/portrait.jpg/);assert.doesNotMatch(html,/logo.svg/);} else if(identity.logoUrl)assert.match(html,/logo.svg/);else assert.doesNotMatch(html,/<img/);
}
const {StudioPublicationCard}=pure('./StudioPublicationCard');
const html=renderToStaticMarkup(React.createElement(StudioPublicationCard,{preview:React.createElement('span',null,'Saved preview'),title:'Title',benefit:'Benefit',contribution:'Review the cover',actionLabel:'Choose your cover',href:'/work/exact-id'}));
const dom=new JSDOM(html);assert.equal(dom.window.document.querySelectorAll('a[href="/work/exact-id"]').length,2);assert.equal(dom.window.document.querySelector('dialog'),null);dom.window.close();
const {expertisePreviewState}=pure('./ExpertiseArticleCover');
const snapshot={sourceChanges:[],session:{thesis:'Corrected premise',thesisRevision:2,status:'interview',nextQuestion:{text:'What changed?'}},article:{title:'Stale title',thesisRevision:1}};
assert.equal(expertisePreviewState(snapshot).title,'Corrected premise');assert.equal(expertisePreviewState(snapshot).article,null);
assert.equal(expertisePreviewState({...snapshot,article:{title:'My saved article',thesisRevision:2}}).actionLabel,'Review and publish');
assert.equal(expertisePreviewState({...snapshot,sourceChanges:['revoked']}).actionLabel,'Review sources');
console.log('PASS publication previews: export SVG parity across all layouts, exact saved asset/identity selection, missing-cover safety, personal fallbacks, identical action destinations and corrected expertise stages.');
