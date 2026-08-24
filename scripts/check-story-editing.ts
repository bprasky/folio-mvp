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
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

let failures = 0;
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};
const grepFiles = (pattern: string) =>
  execSync(`grep -rl '${pattern}' --include=*.tsx src/ || true`, { encoding: 'utf8' })
    .split('\n').filter(Boolean);

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

console.log('\n5. One editing surface, not two');
check('the old form-based article editor is gone',
  grepFiles('EditableArticle').every(f => !f.endsWith('EditableArticle.tsx')));
const panel = readFileSync('src/app/project/[id]/StagingPublishPanel.tsx', 'utf8');
check('the staging panel has no Edit/Preview view mode', !/viewMode/.test(panel));
// The panel used to print the headline directly above a story that renders its
// own lead, so the article opened with its title twice.
check('the panel does not re-print the headline above the story',
  !/GENERATED STORY TITLE/.test(panel));
check('per-section regenerate survived the move',
  /SectionFeedback/.test(tile));

console.log('\n6. The deck is rendered, and editable');
// The deck (the line under the headline) was generated on every article and
// displayed nowhere: the story format had no slot for it, and consolidating
// editing into the story removed the panel block that used to show it. Its only
// appearance anywhere was as a fallback caption on the hero image.
const intro = readFileSync('src/components/story/StoryIntro.tsx', 'utf8');
check('readers see the deck under the headline',
  /story\.subtitle && \(/.test(intro) && /className=\{deckClass\}/.test(intro));
check('owners can edit it in place',
  /edit\.save\(LEAD, 0, "deck", t\)/.test(intro));
check('it sits between the headline and the byline, where a deck goes',
  intro.indexOf('"deck"') > intro.indexOf('"kicker"')
  && intro.indexOf('"deck"') < intro.indexOf('Designer + room count'));
// It had nowhere else to go before; now it does, so the fallback would print the
// same sentence twice on any article whose hero image has no name.
const renderer = readFileSync('src/components/story/StoryRenderer.tsx', 'utf8');
check('the hero caption no longer falls back to the deck',
  /const captionText = story\.heroImage\?\.name \|\| null;/.test(renderer));

console.log(failures === 0
  ? '\nAll story-editing checks passed.\n'
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
