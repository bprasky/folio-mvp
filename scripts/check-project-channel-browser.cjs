// Real React/CSS in Chromium. Server authorization is tested separately by check-project-channel-routes.cjs.
// Optional PUBLIC_POST_FIXTURES/PUBLIC_ASSET_FIXTURES use read-only public snapshots, never private records.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
require('tsx/cjs');
const { publicPost } = require('../src/lib/post/publicPost.ts');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.tmp/channel-browser');
fs.mkdirSync(out, { recursive: true });
const publicPosts = process.env.PUBLIC_POST_FIXTURES ? fs.readdirSync(process.env.PUBLIC_POST_FIXTURES).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(process.env.PUBLIC_POST_FIXTURES, f)))) : [];
const manifest = process.env.PUBLIC_ASSET_FIXTURES ? JSON.parse(fs.readFileSync(path.join(process.env.PUBLIC_ASSET_FIXTURES, 'manifest.json'))) : [];
const assets = new Map(manifest.filter(r => r.status === 200).map(r => [r.url, `/public-assets/${r.file}`]));
function localize(value) {
  if (typeof value === 'string') return assets.get(value) || value;
  if (Array.isArray(value)) return value.map(localize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localize(v)]));
  return value;
}
function fixture(count = 5) {
  return { id: 'fixture-post', projectId: 'fixture-project', slug: 'fixture', status: 'PUBLISHED', heroAssetId: count > 1 ? 'photo-1' : 'photo-0', excerpt: 'A photographic project with an independently published Folio feature.',
    project: { id: 'fixture-project', title: 'Channel fixture', isPublic: true, city: 'Miami', designerOrg: { name: 'Fixture Studio' }, designer: { name: 'Fixture designer' },
      images: Array.from({ length: count }, (_, i) => ({ id: `photo-${i}`, url: `/photo.svg?i=${i}`, name: `Photograph ${i}`, room: `Space ${Math.floor(i / 2)}`, roomId: `room-${Math.floor(i / 2)}`, inclusion: 'INCLUDED', tags: i === 0 ? [{ id: 'tag', productId: 'chair', product: { id: 'chair', name: 'Fixture chair', imageUrl: '/photo.svg', isPending: false } }] : [] })) },
    credits: [{ name: 'Fixture collaborator', role: 'Architecture' }, { name: 'Fixture collaborator', role: 'Architecture' }, { name: '' }, { name: 'Photo studio', url: 'https://example.com' }],
    expandedBlocks: { lead: { title: 'The original fixture headline', deck: 'The original fixture deck' }, introduction: ['The original introduction remains in the publication.'],
      galleryChapters: Array.from({ length: Math.ceil(count / 2) }, (_, i) => ({ id: `room-${i}`, roomId: `room-${i}`, title: `Space ${i}`, imageIds: [`photo-${i * 2}`, `photo-${i * 2 + 1}`], body: [`Original narrative for space ${i}.`], pullQuote: 'An original approved quotation.' })) } };
}
const media = [
  { id: 'film', kind: 'media', title: 'Project film', imageUrl: '/photo.svg', href: '/p/fixture/media/film' },
  { id: 'story', kind: 'media', title: 'An image story', imageUrl: '/photo.svg?i=2', href: '/p/fixture/media/story' },
  { id: 'no-poster', kind: 'media', title: 'Video without a thumbnail', imageUrl: null, href: '/p/fixture/media/film' },
];
const source = `import React from 'react';import {createRoot} from 'react-dom/client';
import {ProjectChannelLanding} from './src/components/story/ProjectChannelLanding';
import {ProjectChannelMedia} from './src/components/story/ProjectChannelMedia';
import {ProjectChannelShareTracking} from './src/components/story/ProjectChannelShareTracking';
import {StoryRenderer} from './src/components/story/StoryRenderer';
import {buildStoryData} from './src/lib/story/buildRoomTiles';
import {StoryViewer} from './src/components/feed/stories/StoryViewer';
import Hero from './src/components/org-profile/OrgProfileHero';
import ProjectFlowMosaic from './src/components/org-profile/feed-layout/ProjectFlowMosaic';
import {defaultOrgAppearance} from './src/lib/org-profile-appearance';
const f=window.fixture;const query=Object.fromEntries(new URLSearchParams(location.search));
window.story=buildStoryData(f.post);
const back=<nav aria-label="Project navigation" className="sticky top-0 z-20 flex min-h-14 items-center bg-[#171715] px-5 text-[#f4efe7]"><a href={'/p/'+f.post.slug} className="inline-flex min-h-11 items-center">← Back to project</a></nav>;
const profile=<main style={{background:'#f4efe7',padding:20}}><Hero org={{id:'fixture',name:'Fixture Design Studio',type:'DESIGN_FIRM',description:'Interiors shaped by light and material.',logo:null}} appearance={defaultOrgAppearance()} cover={{url:f.post.project.images[0]?.url,projectTitle:f.post.project.title}} projectCount={3} year={2026} isAdmin={f.owner} isMember={f.owner}/><ProjectFlowMosaic projects={[{id:'one',title:f.post.project.title,heroImage:f.post.project.images[0]?.url,storyHref:'/p/'+f.post.slug,saveCount:0}]}/></main>;
const viewer=<StoryViewer index={0} onClose={()=>location.assign('/p/fixture')} groups={[{key:'fixture',designer:{id:'designer',name:'Fixture'},project:{id:f.post.projectId,title:'Fixture',slug:'fixture'},cover:null,items:f.assets.map((asset,i)=>({id:String(i),type:'STORY',title:'Image or video story',description:null,publishedAt:new Date(),media:[asset]}))}]}/>;
createRoot(document.getElementById('root')).render(f.mode==='viewer'?viewer:f.mode==='profile'?profile:f.mode==='feature'?<main>{back}<StoryRenderer post={f.post}/></main>:f.mode==='media'?<main className="min-h-screen bg-[#171715] px-5 py-8 text-[#f4efe7]">{back}<h1 className="font-serif text-4xl">Project media</h1><ProjectChannelMedia assets={f.assets} title="Project media"/></main>:<><ProjectChannelShareTracking projectId={f.post.project.id} slug={f.post.slug}/><ProjectChannelLanding post={f.post} media={f.media} ownerView={f.owner} searchParams={query}/></>);`;
async function build() {
  await esbuild.build({ stdin: { contents: source, resolveDir: root, loader: 'tsx' }, outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_FOLIO_EDITORIAL_PROFILE_HERO': '"true"', 'process.env': '{}' },
    plugins: [{ name: 'framework-boundaries', setup(b) {
      b.onResolve({ filter: /^(next\/navigation|next\/link|next\/image)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'jsx', resolveDir: root, contents: args.path === 'next/navigation'
        ? `const router={push:u=>location.assign(u),refresh(){}};export const useRouter=()=>router;export const useSearchParams=()=>new URLSearchParams(location.search);export const usePathname=()=>location.pathname;`
        : args.path === 'next/link' ? `import React from 'react';export default ({href,children,prefetch,scroll,...p})=><a href={href} {...p}>{children}</a>;`
          : `import React from 'react';export default React.forwardRef(({fill,priority,unoptimized,quality,loader,style,...p},ref)=><img ref={ref} {...p} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...style}:style}/>);` }));
    } }],
  });
  const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/@import\s+"([^"]+)";/g, (_, file) => file.startsWith('../styles/') ? fs.readFileSync(path.resolve(root, 'src/app', file), 'utf8') : '');
  const config = require(path.join(root, 'tailwind.config.js'));
  config.content = [path.join(root, 'src/components/story/**/*.tsx'), path.join(root, 'src/components/org-profile/**/*.tsx'), path.join(root, 'src/components/feed/**/*.tsx'), path.join(root, 'src/app/p/**/*.tsx')];
  let css = (await postcss([tailwind(config)]).process(globals, { from: path.join(root, 'src/app/globals.css') })).css;
  let headline, body;
  for (const file of fs.readdirSync(path.join(root, '.next/static/css')).filter(f => f.endsWith('.css'))) {
    for (const face of fs.readFileSync(path.join(root, '.next/static/css', file), 'utf8').match(/@font-face\{[^}]+\}/g) || []) {
      if (!/Cormorant_Garamond|Instrument_Sans|__cormorant_|__instrumentSans_/.test(face)) continue;
      css += face; const family = face.match(/font-family:([^;]+)/)[1];
      if (/Cormorant_Garamond|__cormorant_/.test(face) && !/Fallback/.test(family)) headline = family;
      if (/Instrument_Sans|__instrumentSans_/.test(face) && !/Fallback/.test(family)) body = family;
    }
  }
  assert.ok(headline && body, 'Run typecheck:prepare first for actual Folio fonts');
  fs.writeFileSync(path.join(out, 'globals.css'), css + `:root{--font-headline:${headline};--font-body:${body}}body{font-family:var(--font-body)}`);
}
async function main() {
  await build();
  const analytics = [];
  let playableVideo;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://fixture');
    if (url.pathname === '/api/analytics/event') { let text = ''; for await (const chunk of req) text += chunk; analytics.push(JSON.parse(text)); res.end('{}'); return; }
    if (url.pathname.endsWith('.mp4')) { res.writeHead(404); res.end(); return; }
    if (url.pathname === '/playable.webm') { res.setHeader('Content-Type', 'video/webm'); res.end(playableVideo); return; }
    if (url.pathname === '/photo.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="${Number(url.searchParams.get('i')) % 2 ? '#8d887d' : '#cbc4b7'}"/><rect x="850" y="100" width="450" height="700" fill="#eae4d9"/><path d="M0 850 L1600 650 L1600 1000 L0 1000Z" fill="#6e6659"/></svg>`); return; }
    const files = { '/bundle.js': ['bundle.js', 'text/javascript'], '/bundle.css': ['bundle.css', 'text/css'], '/globals.css': ['globals.css', 'text/css'] };
    if (files[url.pathname]) { const [file, mime] = files[url.pathname]; res.setHeader('Content-Type', mime); res.end(fs.readFileSync(path.join(out, file))); return; }
    if (url.pathname.startsWith('/_next/static/media/')) { res.end(fs.readFileSync(path.join(root, '.next/static/media', path.basename(url.pathname)))); return; }
    if (url.pathname.startsWith('/public-assets/') && process.env.PUBLIC_ASSET_FIXTURES) { res.setHeader('Content-Type', 'image/jpeg'); res.end(fs.readFileSync(path.join(process.env.PUBLIC_ASSET_FIXTURES, path.basename(url.pathname)))); return; }
    const slug = url.pathname.split('/')[2];
    const original = publicPosts.find(p => p.slug === slug);
    const post = original ? publicPost(localize(original)) : fixture(Number(url.searchParams.get('count') || 5));
    const mode = url.pathname.startsWith('/viewer/') ? 'viewer' : url.pathname.endsWith('/feature') ? 'feature' : url.pathname.includes('/media/') ? 'media' : url.pathname === '/profile' ? 'profile' : 'channel';
    const payload = { mode, post, owner: url.searchParams.get('owner') === '1', media: original || url.searchParams.get('photos') === '1' ? [] : media,
      assets: url.pathname.endsWith('/story') ? [{ kind: 'image', url: '/photo.svg', caption: 'An image story', poster: null }] : [{ kind: 'video', url: url.pathname.endsWith('/playable') ? '/playable.webm' : '/missing.mp4', caption: null, poster: null }] };
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/bundle.css"><title>Channel verification fixture</title></head><body><div id="root"></div><script>window.fixture=${JSON.stringify(payload).replaceAll('<', '\\u003c')}</script><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); server.unref();
  const browser = await puppeteer.launch({ executablePath: process.env.CHANNEL_TEST_BROWSER || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const go = async route => { await page.goto(origin + route, { waitUntil: 'networkidle0' }); };
    const button = async text => { await page.evaluate(t => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t); if (!b) throw Error('Missing button ' + t); b.click(); }, text); };
    const overflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No horizontal page overflow');
    const shot = name => page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
    for (const [label, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
      await page.setViewport({ width, height });
      await go('/p/fixture'); await overflow();
      assert.equal(await page.$$eval('a', nodes => nodes.filter(n => n.textContent.includes('Read the Folio Feature')).length), 1);
      assert.equal(await page.$eval('[data-hero-index] img', e => new URL(e.src).searchParams.get('i')), '1');
      assert.equal(await page.$$eval('video', n => n.length), 0);
      assert.equal(await page.$eval('h1', e => getComputedStyle(e).color), 'rgb(244, 239, 231)', 'Hero title retains contrast against the photograph');
      assert.equal(await page.$eval('[data-kind]', e => e.dataset.kind), 'media');
      assert.equal(await page.$$eval('[data-kind]', n => n.findIndex(x => x.dataset.kind === 'feature')), 1);
      assert.equal(await page.$$eval('button', n => n.some(x => /Shop/.test(x.textContent))), false);
      await shot(`channel-${label}`);
      await button('Spaces'); assert.equal(await page.$$eval('[data-kind]', n => n.length), 5); await overflow();
      await button('Media'); assert.equal(await page.$$eval('[data-kind]', n => n.length), 3);
      await button('Credits'); assert.equal(await page.$$eval('[data-kind="credit"]', n => n.length), 2);
      assert.equal(await page.$$eval('[data-kind="credit"]', n => n.every(x => getComputedStyle(x).gridRowEnd === 'span 1')), true, 'Supporting credits never occupy large photo tiles');
      assert.equal(await page.$$eval('a[href="#project-mosaic"][data-kind="credit"]', n => n.length), 0);
      await button('All');
      await page.focus('nav[aria-label="Browse project content"] button:nth-child(2)');
      await page.keyboard.press('Space');
      assert.equal(await page.$eval('nav[aria-label="Browse project content"] button[aria-pressed="true"]', e => e.textContent), 'Spaces');
      await button('All');
      await Promise.all([page.waitForNavigation(), page.click('a[href="/p/fixture/feature"]')]);
      await page.click('[aria-label="Begin Channel fixture"]'); await page.waitForSelector('[data-publication-phase="ready"]');
      await page.click('[aria-label="Read project introduction"]'); assert.match(await page.$eval('body', e => e.innerText), /The original introduction/);
      await shot(`feature-${label}`);
      await Promise.all([page.waitForNavigation(), page.click('nav[aria-label="Project navigation"] a')]);
      await go('/p/fixture/feature?room=room-0&product=chair');
      await page.click('[aria-label="Begin Channel fixture"]'); await page.waitForSelector('[role="dialog"]');
      assert.match(await page.$eval('[role="dialog"]', e => e.innerText), /Fixture chair/);
      await go('/profile?owner=1'); await overflow(); assert.ok(await page.$('[aria-label="Manage profile"]')); await shot(`profile-${label}`);
      console.log(`PASS ${label}: filters, feature prominence, photo order, original reader, product deep link, return link and profile mosaic`);
    }
    await page.setViewport({ width: 390, height: 844 });
    for (const count of [1, 2, 3, 5, 10, 25]) { await go(`/p/fixture?photos=1&count=${count}`); await button('Spaces'); await overflow(); assert.equal(await page.$$eval('[data-kind="space"]', n => n.length), count); await shot(`spaces-${count}`); }
    await go('/p/fixture?owner=1'); await button('Shop Coming Soon'); assert.match(await page.$eval('#channel-tiles', e => e.innerText), /Private designer preview/i); await shot('private-shop-mobile');
    await go('/p/fixture/media/story'); assert.ok(await page.$('img')); assert.equal(await page.$('video'), null);
    await go('/p/fixture/media/film'); assert.equal(await page.$eval('video', e => [e.autoplay, e.preload, e.paused].join(',')), 'false,none,true');
    await page.$eval('video', e => e.load()); await page.waitForFunction(() => document.body.innerText.includes('currently unavailable'));
    playableVideo = Buffer.from(await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 72;
      const context = canvas.getContext('2d'), stream = canvas.captureStream(10), chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      const complete = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.ondataavailable = event => chunks.push(event.data); recorder.start();
      for (let i = 0; i < 10; i++) { context.fillStyle = i % 2 ? '#827967' : '#e1ded8'; context.fillRect(0, 0, 128, 72); await new Promise(r => setTimeout(r, 100)); }
      recorder.stop(); await complete; stream.getTracks().forEach(track => track.stop());
      return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
    }));
    await go('/p/fixture/media/playable');
    assert.equal(await page.$eval('video', e => e.paused && !e.autoplay && e.controls && e.preload === 'none'), true);
    await page.$eval('video', e => e.play());
    await page.waitForFunction(() => document.querySelector('video').currentTime > 0 && document.querySelector('video').videoWidth === 128);
    await go('/viewer/story'); assert.ok(await page.$('img')); assert.equal(await page.$('video'), null);
    await go('/viewer/playable'); assert.equal(await page.$eval('video', e => e.paused && !e.autoplay && e.controls), true);
    await page.$eval('video', e => e.play()); await page.waitForFunction(() => document.querySelector('video').currentTime > 0);
    console.log('PASS sparse/dense photo collections, private preview UI, image stories and unavailable video recovery without autoplay');
    console.log('PASS decoded video after deliberate playback in channel media and legacy feed viewer; image stories use images');

    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await go('/p/fixture?photos=1'); const reducedIndex = await page.$eval('[data-hero-index]', e => e.dataset.heroIndex);
    await new Promise(r => setTimeout(r, 7200)); assert.equal(await page.$eval('[data-hero-index]', e => e.dataset.heroIndex), reducedIndex);
    assert.equal(await page.$eval('[data-hero-index] img', e => getComputedStyle(e).animationName), 'none');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.waitForFunction(() => document.querySelector('[data-hero-index]').dataset.heroIndex !== '0', { timeout: 10000 });
    await button('Pause photographs'); const paused = await page.$eval('[data-hero-index]', e => e.dataset.heroIndex);
    await new Promise(r => setTimeout(r, 7200)); assert.equal(await page.$eval('[data-hero-index]', e => e.dataset.heroIndex), paused);
    await button('Resume photographs');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    const hidden = await page.$eval('[data-hero-index]', e => e.dataset.heroIndex);
    await new Promise(r => setTimeout(r, 7200)); assert.equal(await page.$eval('[data-hero-index]', e => e.dataset.heroIndex), hidden);
    assert.equal(await page.$eval('[data-hero-index] .opacity-100 img', e => getComputedStyle(e).animationPlayState), 'paused');
    console.log('PASS real 7s slide timing, dynamic reduced motion, user pause and visibilitychange pause');
    await go('/p/fixture?utm_source=folio_share&utm_medium=test&utm_campaign=channel');
    await Promise.all([page.waitForNavigation(), page.click('a[href*="/feature?"]')]);
    await page.waitForFunction(() => true); assert.ok(analytics.some(a => a.type === 'project_channel_share_landing'));
    assert.ok(analytics.some(a => a.type === 'article_share_landing' && a.payload.utmCampaign === 'channel'));
    console.log('PASS channel and original publication referral requests reach the existing analytics endpoint');

    for (const original of publicPosts) {
      for (const [label, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
        await page.setViewport({ width, height }); await go(`/p/${original.slug}`); await overflow();
        const hero = original.project.images.find(i => i.id === original.heroAssetId) || original.project.images[0];
        assert.equal(await page.$eval('[data-hero-index] img', e => new URL(e.src).pathname), assets.get(hero.url));
        assert.ok(await page.$(`a[href="/p/${original.slug}/feature"]`));
        await shot(`${original.slug}-${label}`);
        await Promise.all([page.waitForNavigation(), page.click(`a[href="/p/${original.slug}/feature"]`)]);
        await page.click(`[aria-label=${JSON.stringify('Begin ' + original.project.title)}]`); await page.waitForSelector('[data-publication-phase="ready"]');
        assert.equal(await page.evaluate(() => window.fixture.post.id), original.id);
        const originalTitle = original.expandedBlocks.lead?.title || original.expandedBlocks.lead?.kicker;
        if (originalTitle) assert.ok((await page.$eval('body', e => e.textContent)).includes(originalTitle), 'Original published headline');
        const intro = await page.$('[aria-label="Read project introduction"]');
        if (intro) { await intro.click(); await page.waitForSelector('[aria-label="Project introduction"]', {visible:true}); const text = await page.$eval('[aria-label="Project introduction"]', e => e.textContent); const first = original.expandedBlocks.introduction[0]; if (first && !text.includes(first)) fs.writeFileSync(path.join(out, original.slug+'-intro-diff.json'), JSON.stringify({expected:first,actual:text},null,2)); if (first) assert.ok(text.includes(first), `${original.slug}: original introduction`); }
        await shot(`${original.slug}-feature-${label}`);
        const room = await page.evaluate(() => window.story.roomTiles.find(r => r.editorialNarrative && r.products.length) || window.story.roomTiles.find(r => r.editorialNarrative));
        if (room) {
          const product = room.products[0];
          await go(`/p/${original.slug}/feature?room=${encodeURIComponent(room.roomId)}${product ? '&product=' + encodeURIComponent(product.id) : ''}`);
          await page.click(`[aria-label=${JSON.stringify('Begin ' + original.project.title)}]`);
          await page.waitForSelector('[data-publication-reading="true"]');
          const roomText = await page.$eval(`[role="region"][aria-label=${JSON.stringify(room.roomLabel + ' article')}]`, e => e.textContent);
          for (const paragraph of room.editorialParagraphs) assert.ok(roomText.includes(paragraph.slice(1)), `${original.slug}: preserved room narrative`);
          if (room.pullQuote) assert.ok(roomText.includes(room.pullQuote), `${original.slug}: preserved approved quotation`);
          if (product) {
            await page.waitForSelector('[role="dialog"]');
            assert.ok((await page.$eval('[role="dialog"]', e => e.textContent)).includes(product.name), `${original.slug}: original public product sheet`);
          }
          await shot(`${original.slug}-room-${label}`);
        }
      }
      console.log(`PASS public snapshot ${original.slug}: PUBLISHED identity ${original.id}, selected hero, CTA, original headline/introduction, room narrative/quote and available product sheet, desktop/mobile`);
    }
    assert.deepEqual(errors, []);
    console.log(`PASS no browser exceptions; screenshots: ${out}`);
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
