/**
 * Guards what "Include my bio" and "Reference my other projects" actually do.
 *
 * Both are checkboxes that promise the article will draw on something. Nothing
 * downstream fails when the promise is not kept — the prose just comes back a
 * little more generic — so these are exactly the kind of switch that can be
 * wired to nothing for months without anyone noticing.
 *
 * Three things had gone wrong that way:
 *
 *   - On an ORG-owned project, "my bio" read only the individual User.bio. A
 *     studio that wrote a full org bio had it ignored, and a principal with an
 *     empty personal bio contributed nothing at all — on articles CREDITED to
 *     the firm.
 *   - "My other projects" filtered siblings by designerId only, so a studio's
 *     other published work was invisible to every article except the ones that
 *     one person happened to post.
 *   - The Atelier voice profile ignored the bio checkbox entirely, so unchecking
 *     it still sent profile-derived voice data into the prompt.
 *
 * Run: npm run check:generation-context
 */
process.env.ANTHROPIC_API_KEY ||= 'sk-ant-placeholder-for-static-checks';

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

let failures = 0;
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};

const route = readFileSync('src/app/api/posting/project/[projectId]/interview/generate/route.ts', 'utf8');
const draft = readFileSync('src/lib/posting/generateEditorialDraft.ts', 'utf8');

console.log('\n1. The checkboxes reach the prompt at all');
check('the route reads both flags from the request',
  /const includeBio = body\.includeBio !== false/.test(route)
  && /const includeProjectHistory = body\.includeProjectHistory !== false/.test(route));
check('both default to ON when a caller omits them',
  /!== false/.test(route));
check('the bio is passed to the generator', /designerBio,/.test(route));
check('the project history is passed to the generator', /projectHistory,/.test(route));
// A value that reaches GenInput and is never interpolated is the same as no
// value at all, which is the failure mode this whole file exists for.
check('the generator actually interpolates the bio into the prompt',
  /input\.designerBio \? `/.test(draft) && /## Designer Bio/.test(draft));
check('the generator actually interpolates the project history',
  /input\.projectHistory \? `/.test(draft) && /Other Published Projects/.test(draft));

// These rules now live in generationContext.ts, so the checkbox and the run
// cannot disagree about them. Asserted there, and that the route selects the
// fields they need.
const rules = readFileSync('src/lib/posting/generationContext.ts', 'utf8');

console.log('\n2. "My bio" means the firm\'s bio on a firm\'s project');
check('the org bio is selected alongside the org name',
  /bioInterview: \{\s*\n\s*select: \{ fullBio: true, shortBio: true, philosophyStatement: true \}/.test(route));
check('an org-owned project prefers the org bio',
  /if \(org\) \{/.test(rules) && /return \{ text, source: 'org' \}/.test(rules));
check('and falls back to the individual\'s bio',
  /return \{ text: personal, source: 'designer' \}/.test(rules));
check('a blank bio counts as no bio, not as an empty one',
  /\.trim\(\)/.test(rules) && /return null;/.test(rules));
check('unchecking it still yields nothing',
  /designerBio = includeBio\s*\n?\s*\? resolveDesignerBio/.test(route) && /: undefined;/.test(route));

console.log('\n3. "My other projects" follows the firm too');
check('sibling projects include the whole org when one owns the project',
  /OR: \[\{ designerOrgId: orgId \}/.test(rules));
check('a personal project still filters by the person',
  /\{ designerId: designerId \?\? undefined \}/.test(rules));
check('only published work is referenced', /isPublic: true/.test(rules));
check('the project being written is excluded from its own history',
  /id: \{ not: projectId \}/.test(rules));

console.log('\n4. The bio checkbox governs everything bio-shaped');
// The voice profile enters the prompt beside the bio, under "Designer Voice &
// Philosophy". Leaving it ungated made the checkbox a partial truth.
check('the Atelier voice profile is gated by the bio checkbox',
  /if \(includeBio && projectData\.designerId\)/.test(route));
check('and it is what the prompt labels as profile-derived voice',
  /Designer Voice & Philosophy \(from their Folio profile/.test(draft));

console.log('\n5. The offer and the run apply the SAME rules');
// Two copies of "which bio wins" or "which projects are siblings" is how a
// checkbox starts promising context the run never finds — silently, because
// nothing errors when a prompt section is simply absent.
const shared = readFileSync('src/lib/posting/generationContext.ts', 'utf8');
check('the rules are pure functions in one module',
  /export function resolveDesignerBio/.test(shared)
  && /export function siblingProjectsWhere/.test(shared));
check('the generate route applies them rather than its own copy',
  /resolveDesignerBio\(\{/.test(route) && /siblingProjectsWhere\(\{/.test(route));
check('and keeps no second implementation of either',
  !/OR: \[\{ designerOrgId: orgId \}/.test(route)
  && !/orgBio\.fullBio, orgBio\.philosophyStatement/.test(route));
check('availability is resolved through the same rules',
  /resolveDesignerBio\(\{/.test(shared) && /siblingProjectsWhere\(\{/.test(shared));

console.log('\n6. An option that cannot change the output is not offered');
// `designerBioMissing` comes back in the generate RESPONSE — after the run it
// was meant to inform. A designer with no bio and no other published projects
// saw two checkboxes that changed nothing and no way to know it.
const options = readFileSync('src/components/posting/GenerationContextOptions.tsx', 'utf8');
check('availability is fetched before generating', /generation-context/.test(options));
check('the bio option renders only when a bio exists',
  /const showBio = availability\.bio\.available/.test(options));
check('the history option renders only when siblings exist',
  /const showHistory = availability\.projectHistory\.available/.test(options));
check('with neither available, no checkbox is drawn',
  /if \(!showBio && !showHistory\)/.test(options));
check('the label names what would actually be pulled in',
  /availability\.projectHistory\.count/.test(options));
check('an org-owned project says "our studio", not "my"',
  /availability\.bio\.source === 'org'/.test(options));
check('a failed probe hides the options rather than guessing',
  /if \(!availability\) return null/.test(options));
check('both surfaces use the one component', (() => {
  const hits = execSync("grep -rl '<GenerationContextOptions' --include=*.tsx src/ || true", { encoding: 'utf8' })
    .split('\n').filter(Boolean);
  return hits.length === 2
    && hits.some(f => f.includes('StoryInterviewPanel'))
    && hits.some(f => f.includes('StagingPublishPanel'));
})());

console.log('\n7. The options are asked where the run is started');
// They used to live only on the Publish tab, as a permanent checkbox row. That
// tab cannot influence the draft it is already showing: the FIRST generation
// happens on Story, and it sent neither flag, so it always ran with both on.
const story = readFileSync('src/app/project/[id]/StoryInterviewPanel.tsx', 'utf8');
check('the first draft sends both flags',
  /includeBio: contextChoice\.includeBio/.test(story)
  && /includeProjectHistory: contextChoice\.includeProjectHistory/.test(story));
check('the Story tab offers the choice next to Generate',
  /<GenerationContextOptions/.test(story));
// A useCallback that closes over state without declaring it keeps the value
// from first render — the checkbox would move and the request would not.
check('the generate callback depends on the choice, so a change is not stale',
  /\}, \[projectId, writeUpRoomIds, router, contextChoice\]\)/.test(story));

const panel = readFileSync('src/app/project/[id]/StagingPublishPanel.tsx', 'utf8');
check('the permanent checkbox row is gone from the Publish page',
  !/EDITORIAL CONTEXT TOGGLES/.test(panel));
check('the options are asked inside the regenerate dialog instead',
  panel.indexOf('<GenerationContextOptions') > panel.indexOf('Regenerate Article'));
check('the regenerate call still sends them',
  /includeBio: contextToggles\.includeBio/.test(readFileSync('src/hooks/usePublishFlow.ts', 'utf8')));

console.log('\n8. The stepper is the only navigation in the publishing flow');
const tabs = readFileSync('src/app/project/[id]/ProjectTabs.tsx', 'utf8');
const page = readFileSync('src/app/project/[id]/page.tsx', 'utf8');
check('Story and Publish always drop out of the tab strip in the publishing flow',
  /const ownedByStepper = inPublishingFlow;/.test(tabs));
check('an empty strip renders nothing rather than an empty rule',
  /if \(tabs\.length === 0\) return null/.test(tabs));
// The strip has no fallback path, so the stepper must never disappear under it.
// It used to return null once every step was complete — which on a fully
// published project would have left no route to Story or Publish at all.
check('no fallback prop remains', !/stepperVisible/.test(tabs) && !/stepperVisible/.test(page));
check('the tracker survives completion in the publishing flow',
  /keepWhenComplete: inPublishingFlow/.test(page));
check('and the early return respects that',
  /every\(Boolean\) && !args\.keepWhenComplete/.test(page));

console.log(failures === 0
  ? '\nAll generation-context checks passed.\n'
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
