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

console.log('\n2. "My bio" means the firm\'s bio on a firm\'s project');
check('the org bio is selected alongside the org name',
  /bioInterview: \{\s*\n\s*select: \{ fullBio: true, shortBio: true, philosophyStatement: true \}/.test(route));
check('an org-owned project prefers the org bio',
  /const orgBio = projectData\.designerOrg\?\.bioInterview/.test(route));
check('and falls back to the individual\'s bio',
  /orgBioText \|\| projectData\.designer\?\.bio \|\| undefined/.test(route));
check('unchecking it still yields nothing',
  /} else \{\s*\n\s*designerBio = undefined;/.test(route));

console.log('\n3. "My other projects" follows the firm too');
check('sibling projects include the whole org when one owns the project',
  /designerOrgId: orgId/.test(route) && /OR: \[\{ designerOrgId: orgId \}, \{ designerId: projectData\.designerId \}\]/.test(route));
check('a personal project still filters by the person',
  /: \{ designerId: projectData\.designerId \}/.test(route));
check('only published work is referenced', /isPublic: true/.test(route));
check('the project being written is excluded from its own history',
  /id: \{ not: projectId \}/.test(route));

console.log('\n4. The bio checkbox governs everything bio-shaped');
// The voice profile enters the prompt beside the bio, under "Designer Voice &
// Philosophy". Leaving it ungated made the checkbox a partial truth.
check('the Atelier voice profile is gated by the bio checkbox',
  /if \(includeBio && projectData\.designerId\)/.test(route));
check('and it is what the prompt labels as profile-derived voice',
  /Designer Voice & Philosophy \(from their Folio profile/.test(draft));

console.log('\n5. The options are asked where the run is started');
// They used to live only on the Publish tab, as a permanent checkbox row. That
// tab cannot influence the draft it is already showing: the FIRST generation
// happens on Story, and it sent neither flag, so it always ran with both on.
const story = readFileSync('src/app/project/[id]/StoryInterviewPanel.tsx', 'utf8');
check('the first draft sends both flags',
  /includeBio,\s*\n\s*includeProjectHistory,/.test(story));
check('the Story tab offers the choice next to Generate',
  /My bio and design philosophy/.test(story) && /My other published projects/.test(story));
// A useCallback that closes over state without declaring it keeps the value
// from first render — the checkbox would move and the request would not.
check('the generate callback depends on them, so a change is not stale',
  /\}, \[projectId, writeUpRoomIds, router, includeBio, includeProjectHistory\]\)/.test(story));

const panel = readFileSync('src/app/project/[id]/StagingPublishPanel.tsx', 'utf8');
check('the permanent checkbox row is gone from the Publish page',
  !/EDITORIAL CONTEXT TOGGLES/.test(panel));
check('the options are asked inside the regenerate dialog instead',
  panel.indexOf("setContextToggle('includeBio'") > panel.indexOf('Regenerate Article'));
check('the regenerate call still sends them',
  /includeBio: contextToggles\.includeBio/.test(readFileSync('src/hooks/usePublishFlow.ts', 'utf8')));

console.log('\n6. The stepper is the only navigation in the publishing flow');
const tabs = readFileSync('src/app/project/[id]/ProjectTabs.tsx', 'utf8');
check('Story and Publish drop out of the tab strip when the stepper is shown',
  /const ownedByStepper = inPublishingFlow && stepperVisible/.test(tabs));
check('an empty strip renders nothing rather than an empty rule',
  /if \(tabs\.length === 0\) return null/.test(tabs));
// Without the stepper these tabs are the only route to either surface.
check('they come back when the stepper is absent',
  /stepperVisible = false/.test(tabs));
check('the page tells the strip whether the stepper is there',
  /stepperVisible=\{!!trackerState\}/.test(readFileSync('src/app/project/[id]/page.tsx', 'utf8')));

console.log(failures === 0
  ? '\nAll generation-context checks passed.\n'
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
