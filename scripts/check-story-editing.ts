/**
 * Guards the consolidation of editing into the story preview.
 *
 * `StoryRenderer` serves two surfaces from one component tree: the LIVE
 * published article at /p/[slug], and the owner's draft in the staging panel.
 * Editing was moved into that tree, which means the read-only surface is now one
 * stray provider away from shipping edit controls to the public.
 *
 * These checks assert the isolation, and the two prop-level hazards the
 * isolation does not cover.
 *
 * Run: npm run check:story-editing
 */
import { readdirSync, readFileSync } from 'fs';

let failures = 0;
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};
const tsxFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? tsxFiles(`${directory}/${entry.name}`)
    : entry.name.endsWith('.tsx') ? [`${directory}/${entry.name}`] : []);
const sourceFiles = tsxFiles('src');
const grepFiles = (pattern: string) => sourceFiles.filter(file => readFileSync(file, 'utf8').includes(pattern));

console.log('\n1. The published article stays read-only');
const publicPage = readFileSync('src/app/p/[slug]/page.tsx', 'utf8');
check('the public article route mounts NO edit provider',
  !/StoryEditProvider/.test(publicPage));
const providerMounts = grepFiles('<StoryEditProvider');
check('the provider is mounted in exactly one place (the staging panel)',
  providerMounts.length === 1 && providerMounts[0].includes('StagingPublishPanel'),
  providerMounts.join(', '));
// The whole isolation rests on this: no provider => null => read-only markup.
const ctx = readFileSync('src/components/story/StoryEditContext.tsx', 'utf8');
check('useStoryEdit returns null when no provider is mounted',
  /createContext<StoryEditValue \| null>\(null\)/.test(ctx));

console.log('\n2. Editing cannot be silently keyed to the wrong room');
// Tiles are filtered (a chapter with no usable image is dropped), so tile
// position and chapter index diverge. Editing by tile position would write a
// designer's edit into a different room.
const tiles = readFileSync('src/lib/story/buildRoomTiles.ts', 'utf8');
check('a tile carries the CHAPTER index, not its own position',
  /chapterIndex: chapter\.index,/.test(tiles) && !/chapterIndex: idx/.test(tiles));
check('the tile carries paragraphs, so per-paragraph overrides can address them',
  /editorialParagraphs: chapter\.bodyParagraphs/.test(tiles));
const chapters = readFileSync('src/lib/editorial/buildEditorialChapters.ts', 'utf8');
check('chapters expose paragraphs for editing', /bodyParagraphs,/.test(chapters));
// The reading path must be untouched by an editing concern: `body` is what the
// published article renders, so it keeps its original join rather than being
// recomputed from the new paragraph array.
check('the published body string is still built the original way',
  /let bodyText = ch\.body \?\? ch\.narrative \?\? null;/.test(chapters)
  && /bodyText = bodyText\.join\('\\n\\n'\);/.test(chapters));
check('the published intro string is still built the original way',
  /Array\.isArray\(blocks\?\.introduction\)\s*\n\s*\? blocks\.introduction\.join\("\\n\\n"\)/.test(tiles));

console.log('\n3. Every layout that shows a narrative can edit it');
// QuoteTile only becomes editable when it is given a chapterIndex. A layout that
// renders the narrative but forgets that prop would show the designer their
// prose with no way to change it — the exact silent gap the toggle removal
// must not reintroduce.
const pair = readFileSync('src/components/story/RoomTilePair.tsx', 'utf8');
const narrativeSites = (pair.match(/editorialNarrative=\{room\.editorialNarrative\}/g) ?? []).length;
const keyedSites = (pair.match(/chapterIndex=\{room\.chapterIndex\}/g) ?? []).length;
check('every narrative-bearing tile is also given its chapter index',
  narrativeSites > 0 && narrativeSites === keyedSites,
  `${narrativeSites} narrative sites vs ${keyedSites} keyed`);
const tile = readFileSync('src/components/story/QuoteTile.tsx', 'utf8');
check('a tile is editable only when it actually has a chapter index',
  /const editable = !!edit && typeof chapterIndex === "number"/.test(tile));

console.log('\n4. Editing does not fight the tile it lives in');
check('an editable tile drops its expand click handler',
  /onClick=\{editable \? undefined : onClick\}/.test(tile));
check('an editable tile is not announced as a button',
  /role=\{editable \? undefined : "button"\}/.test(tile));
check('the owner sees the narrative without expanding anything',
  /const showNarrative = editable \? !!editorialNarrative/.test(tile));
check('edit regions stop clicks reaching a clickable ancestor',
  /onClick=\{\(e\) => e\.stopPropagation\(\)\}/.test(ctx));

console.log('\n5. One editing surface and a clean reader preview');
check('the old form-based article editor is gone',
  grepFiles('EditableArticle').every(f => !f.endsWith('EditableArticle.tsx')));
const panel = readFileSync('src/app/project/[id]/StagingPublishPanel.tsx', 'utf8');
check('the staging panel offers Edit and Preview',
  /aria-label="Article view"/.test(panel) && /aria-pressed=\{isPreview\}/.test(panel));
check('unsaved edits survive preview because its editor stays mounted and hidden',
  /\{canEdit && <div hidden=\{isPreview\}>\s*<StoryEditProvider/.test(panel));
check('reader preview is outside the edit provider and suppresses owner tools',
  /\{\(!canEdit \|\| isPreview\) && \(\s*<ImmersiveProjectPage[^>]*showOwnerTools=\{false\}[^>]*\/>\s*\)\}/.test(panel));
check('preview covers the workflow header and stepper and has an exit',
  /isPreview \? 'fixed inset-0/.test(panel) && /Back to editing/.test(panel));
check('preview suppresses the staging footer', /\{isOwner && !isPreview && <div className="sticky bottom-0/.test(panel));
// The panel used to print the headline directly above a story that renders its
// own lead, so the article opened with its title twice.
check('the panel does not re-print the headline above the story',
  !/GENERATED STORY TITLE/.test(panel));
check('per-section regenerate survived the move',
  /SectionFeedback/.test(tile));

console.log('\n6. The lead has ONE implementation');
// The failure this exists for: the lead was written twice — StoryIntro for the
// portrait hero, and LandscapeHero inline. Making it editable meant editing
// StoryIntro, so portrait articles got editors and every landscape article — the
// common case — kept a plain <h1> with no controls. Rooms worked, the top of the
// article did not, and nothing failed: the second copy just rendered read-only
// markup. A third hero variant must not be able to reintroduce that.
const lead = readFileSync('src/components/story/StoryLead.tsx', 'utf8');
check('the lead slots live in one module',
  /export function LeadHeadline/.test(lead)
  && /export function LeadDeck/.test(lead)
  && /export function LeadIntro/.test(lead));
check('NOTHING renders a lead field as text outside that module', (() => {
  // A JSX child on its own line — `{story.title}` — is the lead being DISPLAYED.
  // `alt={story.title}` on an <Image> is not, and neither is the unrelated
  // `story` object in CollaborationStoryView, so both stay scoped out.
  const offenders = tsxFiles('src/components/story').filter(file =>
    !file.endsWith('StoryLead.tsx') && /^\s*\{story\.(title|subtitle|introText)\}\s*$/m.test(readFileSync(file, 'utf8')));
  return offenders.length === 0;
})(), 'a story layout renders the lead itself instead of importing StoryLead');
check('the immersive introduction and legacy reusable intro import the shared slots',
  /LeadHeadline/.test(readFileSync('src/components/story/PublicationIntroduction.tsx', 'utf8'))
  && /LeadHeadline/.test(readFileSync('src/components/story/StoryIntro.tsx', 'utf8')));
check('the headline picker rides along with the headline, so it cannot be omitted',
  /<HeadlinePicker/.test(lead)
  && grepFiles('<HeadlinePicker').length === 1);

console.log('\n7. The deck is rendered, and editable');
// The deck (the line under the headline) was generated on every article and
// displayed nowhere: the story format had no slot for it, and consolidating
// editing into the story removed the panel block that used to show it. Its only
// appearance anywhere was as a fallback caption on the hero image.
const intro = readFileSync('src/components/story/StoryIntro.tsx', 'utf8');
check('readers see the deck', /story\.subtitle \? <p/.test(lead));
check('owners can edit it in place', /edit\.save\(LEAD, 0, 'deck', t\)/.test(lead));
check('it sits under the headline in the shared introduction', (() => {
  const renderer = readFileSync('src/components/story/PublicationIntroduction.tsx', 'utf8');
  const after = (src: string) => src.indexOf('LeadDeck') > src.indexOf('LeadHeadline');
  return after(intro) && after(renderer);
})());
// It had nowhere else to go before; now it does, so the fallback would print the
// same sentence twice on any article whose hero image has no name.
const renderer = readFileSync('src/components/story/StoryRenderer.tsx', 'utf8');
check('the renderer only mounts the immersive publication; no legacy hero or intro',
  /<ImmersiveRooms/.test(renderer) && !/StoryHero|StoryIntro|LandscapeHero|<LeadHeadline|<LeadDeck|<LeadIntro/.test(renderer));
check('an absent introduction does not repeat the deck', /story\.introText !== story\.subtitle/.test(lead));
const olderPreview = readFileSync('src/app/designer/projects/[id]/preview/page.tsx', 'utf8');
check('the older preview route cannot switch back to legacy article layouts',
  /<StoryRenderer/.test(olderPreview) && !/PostExpanded|PostCondensed|setView/.test(olderPreview));

console.log(failures === 0
  ? '\nAll story-editing checks passed.\n'
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
