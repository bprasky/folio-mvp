const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createRoot } = require('react-dom/client');
const { act } = React;
const { renderToStaticMarkup } = require('react-dom/server');
const dom = new JSDOM('<div id="root"></div>', {url:'https://fixture.test/designer/projects/p1/instagram'});
global.window = dom.window; global.document = dom.window.document;
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
const destinations = [];

const requests = [];
const fetchMock = (url, options) => new Promise(resolve => requests.push({ url, body: JSON.parse(options.body), resolve }));
function load(file) {
  // Native drawing is checked by check-publication-social.ts and the browser
  // fixture. This DOM harness focuses on the editor's persistence/exit controls.
  if (file.endsWith('PublicationPhotoPreview.tsx')) return { PublicationPhotoPreview: ({ photo }) => React.createElement('div', { role: 'img', 'aria-label': photo.roomName }, photo.quote) };
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports: loaded.exports, module: loaded, console, window: dom.window, document: dom.window.document, URL, fetch: fetchMock, require: id => {
    if (id === 'next/navigation') return { useRouter: () => ({ push: href => destinations.push(href) }) };
    if (id === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id.startsWith('./')) return load(require('node:path').resolve(require('node:path').dirname(file), id + '.tsx'));
    return require('./studio-publication-test-import.cjs')(id) || require(id);
  } });
  return loaded.exports;
}
const { InstagramExportEditor } = load('src/components/instagram-export/InstagramExportEditor.tsx');
const { SlidePreview } = load('src/components/instagram-export/SlidePreview.tsx');
const { SlideThumbnails } = load('src/components/instagram-export/SlideThumbnails.tsx');
const { CampaignWizard } = load('src/components/instagram/CampaignWizard.tsx');
const props = { project: { id: 'p1', title: 'A home' }, post: { slug: 'home' }, designer: { name: 'Designer' }, images: [{id:'1',url:'https://fixture.test/a.jpg',room:'r1'}, {id:'2',url:'https://fixture.test/b.jpg',room:'r2'}], rooms: [{id:'r1',name:'Kitchen'}, {id:'r2',name:'Bedroom'}, {id:'r3',name:'Empty'}], initialExport: { id:'saved',updatedAt:'2026-09-01T00:00:00.000Z',config: { aspectRatio:'1:1',selectedImageUrls:['https://fixture.test/b.jpg'],bioEnabled:false },headline:'Saved headline',caption:'Saved caption' } };
async function main() {
  for (const ratio of ['1:1','4:5','9:16']) {
    const markup = renderToStaticMarkup(React.createElement(SlidePreview, {slides:[{type:'hero',imageUrl:'fixture.jpg'}],activeIndex:0,aspectRatio:ratio,headline:'Headline',headlinePosition:'bottom_left',watermarkStyle:'minimal',designerName:'Designer',projectName:'Home',caption:'short',onSelectSlide() {}}));
    assert.ok(markup.includes(`aspect-ratio:${ratio.replace(':',' / ')}`));
    assert.ok(!markup.includes('folio-design-system'));
    assert.ok(!markup.includes('short...'));
    const thumbs = renderToStaticMarkup(React.createElement(SlideThumbnails,{slides:[{type:'hero'}],activeIndex:0,aspectRatio:ratio,onSelect(){}}));
    assert.ok(thumbs.includes('overflow-x:auto'));
  }
  const campaign = renderToStaticMarkup(React.createElement(CampaignWizard, {projectId:'p1',projectTitle:'Home',onClose(){}}));
  assert.ok(campaign.includes('max-h-[calc(100dvh-2rem)]'));
  assert.ok(campaign.includes('overflow-y-auto'));
  assert.ok(campaign.includes('aria-label="Close campaign"'));
  assert.ok(!campaign.includes('folio-design-system'));
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(InstagramExportEditor, props)));
  assert.equal(requests.length,0,'Opening saved export must not generate');
  assert.ok(document.body.textContent.includes('Saved headline'));
  assert.ok(!document.body.textContent.includes('“Saved headline”'), 'Editorial headline is not a quotation');
  assert.ok(!document.body.textContent.includes('folio-design-system'));
  assert.ok([...document.querySelectorAll('a')].some(a => a.getAttribute('href') === '/designer/studio?project=p1'), document.body.innerHTML.slice(0,2500));
  const click = async text => act(async () => [...document.querySelectorAll('button')].find(b=>b.textContent===text).click());
  await click('Save draft');
  const save = requests.at(-1);
  assert.equal(save.body.caption, 'Saved caption');
  assert.equal(save.body.exportId, 'saved');
  assert.equal(save.body.saveOnly, true);
  await act(async () => save.resolve({ok:true,json:async()=>({export:{id:'saved',updatedAt:'2026-09-02T00:00:00.000Z'},images:[]})}));
  assert.ok(window.location.search.includes('export=saved'));
  await click('Save draft');
  assert.equal(requests.at(-1).body.expectedUpdatedAt,'2026-09-02T00:00:00.000Z','Next save uses returned concurrency token');
  await act(async () => requests.at(-1).resolve({ok:true,json:async()=>({export:{id:'saved',updatedAt:'2026-09-03T00:00:00.000Z'},images:[]})}));
  assert.equal([...document.querySelectorAll('button')].find(b => b.textContent === 'Kitchen'), undefined, 'Saved drafts do not switch to a different story');
  assert.equal(document.querySelector('#instagram-caption').value, 'Saved caption', 'Caption is available on initial polish screen');
  await click('Suggest alternatives');
  await act(async () => requests.at(-1).resolve({ok:false,json:async()=>({error:'Caption service unavailable'})}));
  assert.equal(document.querySelector('#instagram-caption').value, 'Saved caption', 'Failure preserves selected caption');
  assert.ok(document.body.textContent.includes('Caption service unavailable'));
  await click('Retry captions');
  await act(async () => requests.at(-1).resolve({ok:true,json:async()=>({caption:'New option',captions:['New option','Second option']})}));
  assert.equal(document.querySelector('#instagram-caption').value, 'Saved caption', 'Alternatives never overwrite edits');
  await click('Second option');
  assert.equal(document.querySelector('#instagram-caption').value, 'Second option');
  await act(async () => root.render(React.createElement(InstagramExportEditor, {...props,key:'five',initialExport:{...props.initialExport,config:{slideCount:5,bioEnabled:true,selectedImageUrls:props.images.map(image=>image.url)}}})));
  await act(async () => [...document.querySelectorAll('button[aria-label^="Slide "]')].at(-1).click());
  await click('Images & style');
  await click('3 slides');
  assert.ok(document.querySelector('button[aria-label="Slide 3: CTA Slide"][aria-pressed="true"]'),'Reducing slides clamps selected index');
  assert.ok(document.body.textContent.includes('Full Editorial'));
  const roomImages = [
    { id: 'fk-kitchen', url: 'https://fixture.test/renamed.jpg', name: 'FK kitchen photo', roomId: 'r1', room: 'Old kitchen name' },
    { id: 'fk-bedroom', url: 'https://fixture.test/misleading.jpg', name: 'FK bedroom photo', roomId: 'r2', room: 'Kitchen' },
    { id: 'legacy-kitchen', url: 'https://fixture.test/legacy.jpg', name: 'Legacy kitchen photo', room: 'Kitchen' },
  ];
  const beforeRoomOpen = requests.length;
  await act(async () => root.render(React.createElement(InstagramExportEditor, { ...props, key: 'room-fk', images: roomImages,
    initialExport: { ...props.initialExport, config: { ...props.initialExport.config, roomId: 'r1', selectedImageUrls: [roomImages[0].url] } },
  })));
  assert.equal(requests.length, beforeRoomOpen, 'Opening a prepared room must not generate');
  await click('Images & style');
  assert.ok(document.querySelector('img[alt="FK kitchen photo"]'), 'Prepared room picker follows the FK after a room rename');
  assert.ok(document.querySelector('img[alt="Legacy kitchen photo"]'), 'No-FK legacy photos still resolve by room name');
  assert.equal(document.querySelector('img[alt="FK bedroom photo"]'), null, 'Conflicting room text must not override the FK');
  await act(async () => root.render(React.createElement(InstagramExportEditor, {...props, key:'pitch', initialExport:{...props.initialExport,config:{...props.initialExport.config,slideCount:2,pitch:'A story about the kitchen island',rationale:'The interview explains the stone choice.',beats:['The island anchors the room.'],captionOptions:['Prepared first','Prepared second']}}})));
  assert.ok(document.body.textContent.includes('A story about the kitchen island'));
  assert.ok(document.body.textContent.includes('The interview explains the stone choice.'));
  assert.ok(document.body.textContent.includes('2 slides'));
  await click('Prepared second');
  assert.equal(document.querySelector('#instagram-caption').value,'Prepared second');
  await click('Bio');
  await act(async () => document.querySelector('button[aria-label="Include designer bio slide"]').click());
  assert.ok(document.body.textContent.includes('3 slides'),'Enabling bio expands a two-slide draft');
  await click('Images & style');
  assert.equal([...document.querySelectorAll('button')].find(button=>button.textContent==='2 slides').disabled,true,'Two slides is unavailable with a bio');
  assert.ok(document.querySelector('button[aria-pressed="true"]').textContent);
  assert.equal([...document.querySelectorAll('button')].find(button=>button.textContent==='3 slides').getAttribute('aria-pressed'),'true');
  await click('Headline');
  await click('Suggest alternatives');
  await act(async () => requests.at(-1).resolve({ok:false,json:async()=>({error:'Headline service unavailable'})}));
  assert.ok(document.body.textContent.includes('Saved headline'),'Headline failure preserves draft');
  assert.ok(document.body.textContent.includes('Retry headlines'));
  const beforePreview = requests.length;
  const preview = { config: {...props.initialExport.config, studioCardId:'project:p1', studioRevision:'v1', captionOptions:['Preview caption','Changed caption']}, headline:'Preview headline', caption:'Preview caption' };
  await act(async () => root.render(React.createElement(InstagramExportEditor, {...props,key:'preview',initialExport:null,initialPreview:preview})));
  assert.equal(requests.length,beforePreview,'Transient proposal makes no generation or persistence requests');
  const exit = async () => { const event = new window.MouseEvent('click',{bubbles:true,cancelable:true,button:0}); await act(async () => document.querySelector('a[aria-label="Back to Publishing Studio"]').dispatchEvent(event)); return event; };
  let exitEvent = await exit();assert.equal(exitEvent.defaultPrevented,false,'Untouched preview exits immediately');assert.equal(document.querySelector('dialog').open,false);
  await click('Headline');await click('Caption');exitEvent=await exit();assert.equal(exitEvent.defaultPrevented,false,'Navigation through tabs is not a content edit');
  await click('Changed caption');await exit();assert.equal(document.querySelector('dialog').open,true);
  await click('Keep editing');assert.equal(document.querySelector('dialog').open,false);assert.equal(document.querySelector('#instagram-caption').value,'Changed caption');
  await click('Preview caption');exitEvent=await exit();assert.equal(exitEvent.defaultPrevented,false,'Restoring original content clears dirty state');
  await click('Changed caption');await exit();await click('Discard changes');assert.equal(requests.length,beforePreview,'Discard does not persist');assert.match(destinations.at(-1),/designer\/studio/);
  await act(async () => root.render(React.createElement(InstagramExportEditor, {...props,key:'preview-save',initialExport:null,initialPreview:preview})));
  await click('Changed caption');await exit();await click('Save draft and exit');
  const firstSave=requests.at(-1);assert.equal(firstSave.body.exportId,undefined);assert.equal(firstSave.body.config.studioCardId,'project:p1');assert.equal(firstSave.body.config.studioRevision,'v1');assert.equal(firstSave.body.saveOnly,true);
  const navigationCount=destinations.length;
  await act(async()=>firstSave.resolve({ok:false,json:async()=>({error:'Save failed'})}));assert.equal(destinations.length,navigationCount);assert.equal(document.querySelector('dialog').open,true);assert.match(document.querySelector('dialog [role="alert"]').textContent,/not saved/);
  await click('Save draft and exit');await act(async()=>requests.at(-1).resolve({ok:true,json:async()=>({export:{id:'new',updatedAt:'2026-09-04T00:00:00.000Z'},images:[]})}));assert.equal(destinations.length,navigationCount+1);assert.equal(document.querySelector('dialog').open,false);
  assert.equal(window.location.search.includes('proposal='),false);
  // Simulate the browser updating URL/state before dispatching popstate. Preserve
  // Next's opaque history state when restoring the editor, then resume the back.
  const originalBack=window.history.back;let backCalls=0;window.history.back=()=>{backCalls++;};
  window.history.replaceState({__NA:true,tree:'editor'},'', '/designer/projects/p1/instagram?proposal=project:p1');
  await act(async () => root.render(React.createElement(InstagramExportEditor,{...props,key:'history',initialExport:null,initialPreview:preview})));
  let laterPops=0;const laterPop=()=>laterPops++;window.addEventListener('popstate',laterPop);
  window.history.replaceState({__NA:true,tree:'studio'},'', '/designer/studio');
  await act(async()=>window.dispatchEvent(new window.PopStateEvent('popstate',{state:window.history.state})));
  assert.equal(laterPops,1,'Clean history navigation passes through');assert.equal(document.querySelector('dialog').open,false);
  window.history.replaceState({__NA:true,tree:'editor'},'', '/designer/projects/p1/instagram?proposal=project:p1');
  await click('Changed caption');
  const moveBack=async()=>{window.history.replaceState({__NA:true,tree:'studio'},'', '/designer/studio');await act(async()=>window.dispatchEvent(new window.PopStateEvent('popstate',{state:window.history.state})));};
  await moveBack();assert.equal(laterPops,1,'Dirty history navigation is intercepted before router');assert.equal(document.querySelector('dialog').open,true);assert.equal(window.history.state.tree,'editor');assert.match(window.location.pathname,/instagram/);
  await click('Keep editing');assert.equal(backCalls,0);assert.equal(document.querySelector('#instagram-caption').value,'Changed caption');
  await moveBack();await click('Discard changes');assert.equal(backCalls,1,'Discard resumes browser back');
  await act(async () => root.render(React.createElement(InstagramExportEditor,{...props,key:'history-save',initialExport:null,initialPreview:preview})));
  await click('Changed caption');await moveBack();await click('Save draft and exit');
  await act(async()=>requests.at(-1).resolve({ok:false,json:async()=>({error:'Save failed'})}));assert.equal(backCalls,1);assert.equal(document.querySelector('dialog').open,true);
  await click('Save draft and exit');await act(async()=>requests.at(-1).resolve({ok:true,json:async()=>({export:{id:'back-saved',updatedAt:'2026-09-05T00:00:00.000Z'},images:[]})}));assert.equal(backCalls,2,'Successful draft save resumes browser back');
  window.removeEventListener('popstate',laterPop);window.history.back=originalBack;
  await act(async () => root.render(React.createElement(InstagramExportEditor,{...props,key:'legacy',initialExport:null})));
  const initialCaption = requests.filter(r=>r.url.endsWith('generate-caption')).at(-1);
  assert.equal(initialCaption.body.headline,'','Caption does not wait for headline generation');
  await act(async () => initialCaption.resolve({ok:true,json:async()=>({caption:'Independent caption'})}));
  await click('Kitchen');
  assert.equal(document.querySelector('#instagram-caption').value,'Independent caption','Changing room retains current copy');
  await act(async () => root.unmount());
  console.log('Carousel regression checks passed: saved reopen, ratios, accurate count, prepared story metadata/options, safe regeneration failures, independent caption generation, source changes preserving copy, FK-first picker and slide selection.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
