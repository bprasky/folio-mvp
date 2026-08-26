/**
 * Frame selection across real published projects.
 *
 * Answers, per project: which frames are eligible, which angle each takes, and the
 * slot values it would draw from — computed by the SAME functions the regenerate
 * route calls (`resolveHeadlineSlots`, `eligibleFrames`, `selectVerbs`), so the
 * eligibility reported here is the eligibility production sees, not a model of it.
 *
 * WHAT IT DOES NOT DO: generate headlines. The writer prompt is assembled inside the
 * route handler, and `check:regenerate-surfaces` pins seven assertions to its text
 * living there. Copying it into this script would create the second copy that whole
 * effort exists to prevent, and extracting it would mean rewriting that guard. So
 * the model call stays where it is: to see actual headlines, press New options, or
 * drive the endpoint directly.
 *
 * Everything else the deliverable asks for is here, because all of it is decided
 * before the model is called — which is the design.
 *
 * Requires DATABASE_URL. Reports and exits 2 without one rather than inventing
 * projects.
 *
 *   npm run report:headline-samples            # 20 projects
 *   npm run report:headline-samples -- --n 50
 */

import { PrismaClient } from '@prisma/client';
import { resolveHeadlineSlots } from '../src/lib/posting/headlineSlots';
import { eligibleFrames, HEADLINE_FRAMES } from '../src/lib/interview/prompts/headlineFrames';
import { selectVerbs } from '../src/lib/interview/prompts/headlineVerbs';

const prisma = new PrismaClient();

/** The angle each frame takes, mirroring the route. */
const FRAME_ANGLE: Record<string, string> = {
  material: 'first-move',
  'borrowed-fragment': 'client',
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('\nDATABASE_URL is not set. Not inventing projects — run against prod.\n');
    process.exit(2);
  }
  const nFlag = process.argv.indexOf('--n');
  const limit = nFlag >= 0 ? Number(process.argv[nFlag + 1]) || 20 : 20;

  const posts = await prisma.projectPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: {
      projectId: true,
      expandedBlocks: true,
      project: { select: { title: true, city: true, regionState: true } },
    },
  });

  if (posts.length === 0) {
    console.log('\nNo published projects.\n');
    return;
  }

  const tally: Record<string, number> = {};
  let noFrame = 0;

  console.log(`\nHEADLINE FRAME SELECTION — ${posts.length} published projects\n`);

  for (const post of posts) {
    const { slots, materials, fragments, facts, confirmedFinishTags } =
      await resolveHeadlineSlots(post.projectId);
    // This surface has a deck (`blocks.lead.deck`), so deck-requiring frames are
    // eligible here. See docs/23 §5.
    const eligible = eligibleFrames(slots, { hasDeck: true });
    const verbs = selectVerbs(facts);
    const current = ((post.expandedBlocks as any)?.lead?.kicker ?? '') as string;

    for (const f of eligible) tally[f.id] = (tally[f.id] ?? 0) + 1;
    if (eligible.length === 0) noFrame++;

    console.log(`─ ${post.project?.title || post.projectId}`);
    console.log(`    current headline   ${current || '(none)'}`);
    console.log(`    frames eligible    ${eligible.length ? eligible.map((f) => `${f.id} -> ${FRAME_ANGLE[f.id] ?? 'unassigned'}`).join(', ') : 'NONE — batch is unframed'}`);
    console.log(`    frames ineligible  ${HEADLINE_FRAMES.filter((f) => !eligible.includes(f)).map((f) => f.id).join(', ') || '-'}`);
    for (const slot of slots) {
      console.log(`    slot ${slot.name.padEnd(13)} "${slot.value}"   [${slot.source}]`);
    }
    console.log(`    material classes   ${materials.length ? materials.slice(0, 4).map((m) => `${m.value}(${m.roomCount}r/${m.imageCount}i)`).join(', ') : 'none'}`);
    console.log(`    confirmed finishes ${confirmedFinishTags} tag(s)   [the pre-B3 gate, for comparison]`);
    console.log(`    quotable fragments ${fragments.length}${fragments.length ? `   best: “${fragments[0].text}”` : ''}`);
    console.log(`    verbs offered      ${verbs.eligible.length ? verbs.eligible.map((v) => v.headlineForm).join(', ') : 'none — every precondition unknown'}`);
    console.log('');
  }

  console.log('─ SUMMARY');
  for (const frame of HEADLINE_FRAMES) {
    const n = tally[frame.id] ?? 0;
    console.log(`    ${frame.id.padEnd(20)} eligible on ${String(n).padStart(3)} / ${posts.length}   ${((n / posts.length) * 100).toFixed(0)}%`);
  }
  console.log(`    ${'(no frame at all)'.padEnd(20)}          ${String(noFrame).padStart(3)} / ${posts.length}   ${((noFrame / posts.length) * 100).toFixed(0)}%`);
  console.log('');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
