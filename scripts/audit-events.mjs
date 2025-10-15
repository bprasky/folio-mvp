#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

async function readText(file) {
  try { return await fs.readFile(file, 'utf8'); } catch { return null; }
}
async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}
function findMatches(text, regex) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, i) => {
    if (regex.test(line)) hits.push({ lineNo: i + 1, line: line.trim() });
    regex.lastIndex = 0; // reset for global safety
  });
  return hits;
}
async function walk(dir, filterExt = ['.css','.scss','.tsx','.ts']) {
  const out = [];
  async function rec(d) {
    let ents = [];
    try { ents = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await rec(p);
      else if (filterExt.includes(path.extname(p))) out.push(p);
    }
  }
  await rec(dir);
  return out;
}

const files = {
  page: path.join(root, 'src/app/events/page.tsx'),
  carousel: path.join(root, 'src/components/FestivalCarousel.tsx'),
  mosaic: path.join(root, 'src/components/EventMosaic.tsx'),
  fontWoff2: path.join(root, 'public/fonts/Canela-Regular.woff2'),
  fontWoff: path.join(root, 'public/fonts/Canela-Regular.woff'),
};

const now = new Date().toISOString();
const nodev = process.version;

const pageTxt = await readText(files.page);
const carTxt  = await readText(files.carousel);
const mosTxt  = await readText(files.mosaic);

// Patterns
const patterns = {
  page: {
    importsCarousel: /FestivalCarousel/,
    importsMosaic: /EventMosaic/,
    usesFestivalEnum: /EventType\.FESTIVAL/,
    usesGetServerSession: /getServerSession/,
    hasUseClient: /^\s*["']use client["'];?/,
    hasIsApproved: /isApproved/,
    hasIsPublic: /isPublic/,
    usesParentFestivalId: /parentFestivalId/,
  },
  carousel: {
    useClient: /^\s*["']use client["'];?/,
    snap: /snap-/,
    roleList: /role\s*=\s*["']list["']/,
    roleItem: /role\s*=\s*["']listitem["']/,
    image: /<Image\b/,
    sizes: /sizes\s*=\s*["'][^"']+["']/,
  },
  mosaic: {
    useClient: /^\s*["']use client["'];?/,
    columns: /columns-\d/,
    breakInside: /break-inside/,
    image: /<Image\b/,
    sizes: /sizes\s*=\s*["'][^"']+["']/,
    emptyText: /No events to display/i,
  }
};

// Global scans
const allFiles = await walk(root);
const globalTxts = await Promise.all(allFiles.map(f => readText(f)));
function globalSearch(regex) {
  const hits = [];
  for (let i=0;i<allFiles.length;i++){
    const t = globalTxts[i]; if (!t) continue;
    const m = findMatches(t, regex);
    if (m.length) hits.push({ file: path.relative(root, allFiles[i]), matches: m });
  }
  return hits;
}

const selNoneHits = globalSearch(/select-none|user-select\s*:\s*none/i);
const canelaRefs = globalSearch(/Canela-Regular\.(woff2?|otf)/i);
const fontW2Exists = await exists(files.fontWoff2);
const fontWExists  = await exists(files.fontWoff);

function section(title){ console.log(`\n## ${title}\n`); }
function header(){ 
  console.log(`# Events Page Audit`);
  console.log(`- Timestamp: ${now}`);
  console.log(`- Node: ${nodev}`);
  console.log(`- CWD: ${root.replace(/\\\\/g,'/')}`);
}
function passfail(ok){ return ok ? '✅' : '❌'; }
function reportFile(name, ok){ console.log(`**${name}**: ${passfail(ok)} ${ok ? 'present' : 'missing'}`); }
function reportPattern(groupName, txt, pats){
  section(groupName);
  if (!txt){ console.log('_file missing_'); return {}; }
  const results = {};
  for (const [key, rx] of Object.entries(pats)){
    const hits = findMatches(txt, rx);
    results[key] = hits;
    const ok = rx === patterns.page.hasUseClient || rx === patterns.carousel.useClient || rx === patterns.mosaic.useClient
      ? hits.length > 0 // for "use client" presence
      : hits.length > 0;
    const label = key.replace(/([A-Z])/g,' $1');
    console.log(`- ${label}: ${passfail(hits.length>0)} (matches: ${hits.length})`);
    if (hits.length){
      hits.slice(0,10).forEach(h => console.log(`  - L${h.lineNo}: ${h.line}`));
      if (hits.length>10) console.log(`  … +${hits.length-10} more`);
    }
  }
  return results;
}

header();

section('Presence');
reportFile('src/app/events/page.tsx', !!pageTxt);
reportFile('src/components/FestivalCarousel.tsx', !!carTxt);
reportFile('src/components/EventMosaic.tsx', !!mosTxt);

const pageRes = reportPattern('events/page.tsx checks', pageTxt, patterns.page);
const carRes  = reportPattern('FestivalCarousel.tsx checks', carTxt, patterns.carousel);
const mosRes  = reportPattern('EventMosaic.tsx checks', mosTxt, patterns.mosaic);

section('Global scans: select-none / user-select:none');
if (selNoneHits.length){
  console.log(`❌ Found ${selNoneHits.length} files using non-selectable styles:`);
  selNoneHits.forEach(h => {
    console.log(`- ${h.file} (${h.matches.length} lines)`);
    h.matches.slice(0,5).forEach(m => console.log(`  - L${m.lineNo}: ${m.line}`));
    if (h.matches.length>5) console.log(`  … +${h.matches.length-5} more`);
  });
} else {
  console.log('✅ None found');
}

section('Fonts: Canela');
const hasRefs = canelaRefs.length>0;
console.log(`References present: ${passfail(hasRefs)} (files: ${canelaRefs.length})`);
console.log(`public/fonts/Canela-Regular.woff2 exists: ${passfail(fontW2Exists)}`);
console.log(`public/fonts/Canela-Regular.woff exists: ${passfail(fontWExists)}`);
if (hasRefs) {
  canelaRefs.slice(0,5).forEach(h => console.log(`- ${h.file} (${h.matches.length} hits)`));
  if (canelaRefs.length>5) console.log(`… +${canelaRefs.length-5} more`);
}

section('Findings');
const findings = [];
const pageHasUseClient = (pageRes.hasUseClient||[]).length>0;
findings.push(`${passfail(!pageHasUseClient)} events/page.tsx is a Server Component (no "use client")`);
findings.push(`${passfail((pageRes.importsCarousel||[]).length>0)} page imports/uses FestivalCarousel`);
findings.push(`${passfail((pageRes.importsMosaic||[]).length>0)} page imports/uses EventMosaic`);
findings.push(`${passfail((pageRes.usesFestivalEnum||[]).length>0)} uses EventType.FESTIVAL for festivals`);
findings.push(`${passfail((pageRes.usesGetServerSession||[]).length>0)} uses getServerSession for admin gating`);
findings.push(`${passfail((pageRes.hasIsApproved||[]).length>0 && (pageRes.hasIsPublic||[]).length>0)} public filtering by isApproved + isPublic`);
findings.push(`${passfail((pageRes.usesParentFestivalId||[]).length>0)} references parentFestivalId`);

const carOk = !!carTxt;
findings.push(`${passfail(carOk && (carRes.useClient||[]).length>0)} FestivalCarousel is Client Component`);
findings.push(`${passfail(carOk && (carRes.snap||[]).length>0)} FestivalCarousel uses scroll-snap`);
findings.push(`${passfail(carOk && (carRes.roleList||[]).length>0 && (carRes.roleItem||[]).length>0)} ARIA list/listitem present`);
findings.push(`${passfail(carOk && (carRes.image||[]).length>0 && (carRes.sizes||[]).length>0)} FestivalCarousel Image has sizes`);

const mosOk = !!mosTxt;
findings.push(`${passfail(mosOk && (mosRes.useClient||[]).length>0)} EventMosaic is Client Component`);
findings.push(`${passfail(mosOk && (mosRes.columns||[]).length>0)} EventMosaic uses CSS columns`);
findings.push(`${passfail(mosOk && (mosRes.breakInside||[]).length>0)} EventMosaic prevents breaks (break-inside)`);
findings.push(`${passfail(mosOk && (mosRes.image||[]).length>0 && (mosRes.sizes||[]).length>0)} EventMosaic Image has sizes`);
findings.push(`${passfail(mosOk && (mosRes.emptyText||[]).length>0)} EventMosaic has friendly empty state`);

findings.push(`${passfail(selNoneHits.length===0)} No global 'select-none' / 'user-select:none' blocking selection`);
findings.push(`${passfail(!hasRefs || (fontW2Exists||fontWExists))} Font refs resolved (or no refs present)`);

findings.forEach(f => console.log(`- ${f}`));








