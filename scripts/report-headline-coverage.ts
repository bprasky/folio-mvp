/**
 * Headline frame coverage.
 *
 * How many published projects can actually FILL a frame. The B1 phase shipped a
 * frame whose eligibility nothing had measured, so "the Material frame is live" and
 * "the Material frame ever fires" were separate unverified claims. This closes that.
 *
 * Every number is a share of PUBLISHED projects (`ProjectPost.status = PUBLISHED`),
 * because an unpublished draft is not a headline this system has to write.
 *
 * Requires DATABASE_URL. Reports and exits 2 without one rather than estimating —
 * an estimated coverage number is worse than none, since it would be quoted back as
 * if it were measured.
 *
 * Run: npm run report:headline-coverage
 */

import { PrismaClient } from '@prisma/client';
import { materialClassOf, MATERIAL_CLASSES } from '../src/lib/editorial-queue/signals';
import { loadInterviewAnswers } from '../src/lib/posting/loadInterviewAnswers';

const prisma = new PrismaClient();

const pct = (n: number, d: number) => (d === 0 ? '  n/a' : `${((n / d) * 100).toFixed(1)}%`);
const row = (label: string, n: number, d: number) =>
  console.log(`  ${label.padEnd(52)} ${String(n).padStart(5)} / ${d}   ${pct(n, d)}`);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('\nDATABASE_URL is not set. Not estimating — run this against prod.\n');
    process.exit(2);
  }

  const posts = await prisma.projectPost.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      projectId: true,
      project: {
        select: {
          id: true, title: true, city: true, regionState: true,
          projectType: true, clientType: true, timeline: true,
          images: {
            select: {
              id: true, roomId: true, room: true,
              tags: {
                select: {
                  finishConfirmed: true, finishRaw: true, finishCanonical: true,
                  selection: { select: { colorFinish: true } },
                  product: { select: { name: true, description: true, category: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const total = posts.length;
  if (total === 0) {
    console.log('\nNo published projects. Nothing to measure.\n');
    return;
  }

  let withClass = 0, withConfirmed = 0, withClassInTwoPlaces = 0;
  let withQuote = 0;
  let locBoth = 0, locCityOnly = 0, locRegionOnly = 0, locNone = 0;
  const classHistogram = new Map<string, number>();
  const typeHistogram = new Map<string, number>();

  for (const post of posts) {
    const p = post.project;
    if (!p) continue;

    // 1 + 3. Material CLASS, derived per tag, keyed to where it appears.
    //
    // Derivation, not a stored column: no material-class field exists anywhere in
    // the schema. `materialClassOf` is reused rather than reimplemented — it is the
    // corpus digest's own vocabulary and is the only class-level list in the repo.
    const classPlaces = new Map<string, { rooms: Set<string>; images: Set<string> }>();
    let confirmedHere = false;

    for (const image of p.images) {
      for (const tag of image.tags) {
        if (tag.finishConfirmed && (tag.finishRaw ?? tag.finishCanonical ?? '').trim()) {
          confirmedHere = true;
        }
        const haystack = `${tag.product?.name ?? ''} ${tag.product?.description ?? ''} ${tag.product?.category ?? ''}`;
        const cls = materialClassOf(
          tag.selection?.colorFinish ?? tag.finishRaw ?? tag.finishCanonical ?? null,
          haystack,
        );
        if (!cls) continue;
        const at = classPlaces.get(cls) ?? { rooms: new Set<string>(), images: new Set<string>() };
        at.images.add(image.id);
        at.rooms.add(image.roomId ?? image.room ?? image.id);
        classPlaces.set(cls, at);
      }
    }

    if (classPlaces.size > 0) {
      withClass++;
      for (const cls of classPlaces.keys()) {
        classHistogram.set(cls, (classHistogram.get(cls) ?? 0) + 1);
      }
    }
    if (confirmedHere) withConfirmed++;
    // Continuity's precondition: the same class in more than one room or image.
    if (Array.from(classPlaces.values()).some((at) => at.rooms.size > 1 || at.images.size > 1)) {
      withClassInTwoPlaces++;
    }

    // 4. Project type. NOTE: none of these encodes new build vs renovation.
    typeHistogram.set(p.projectType, (typeHistogram.get(p.projectType) ?? 0) + 1);

    // 5. A verbatim designer quote, read the way the headline route reads it.
    const answers = await loadInterviewAnswers(p.id);
    if (answers.some((a) => a.answer.trim().length > 0)) withQuote++;

    // 6. Location, and at what specificity.
    const city = (p.city ?? '').trim();
    const region = (p.regionState ?? '').trim();
    if (city && region) locBoth++;
    else if (city) locCityOnly++;
    else if (region) locRegionOnly++;
    else locNone++;
  }

  console.log(`\nHEADLINE FRAME COVERAGE — ${total} published projects\n`);

  console.log('1. Material CLASS resolvable at project level');
  console.log('   source: derived by materialClassOf() over Selection.colorFinish +');
  console.log('           Product.name/description/category. No stored class column exists.');
  row('at least one material class', withClass, total);

  console.log('\n2. The B1 gate, for comparison');
  row('at least one ProductTag.finishConfirmed', withConfirmed, total);
  const gap = withClass - withConfirmed;
  console.log(`   GAP between the shipped gate and the class source: ${gap} project(s)`);

  console.log('\n3. Continuity precondition');
  row('a class in more than one room or image', withClassInTwoPlaces, total);

  console.log('\n4. New build vs renovation');
  console.log('   NO SUCH FIELD EXISTS. ProjectType is a sector taxonomy, ProjectStage a');
  console.log('   workflow stage, ProjectTimeline is PAST/PRESENT/FUTURE, ClientType is');
  console.log('   RESIDENTIAL/COMMERCIAL. The only renovation/new-build strings in the');
  console.log('   schema are User.architectSpecializations / User.builderProjectTypes,');
  console.log('   which describe the practitioner, not the project.');
  row('projects classifiable as new build or renovation', 0, total);
  console.log('   ProjectType distribution (the nearest field, which does not answer it):');
  for (const [t, n] of [...typeHistogram].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(t).padEnd(20)} ${String(n).padStart(5)}   ${pct(n, total)}`);
  }

  console.log('\n5. Verbatim designer quote at headline-generation time');
  console.log('   source: loadInterviewAnswers(), the same read the headline route makes.');
  row('at least one non-empty answer', withQuote, total);

  console.log('\n6. Location, and at what specificity');
  console.log('   NO street or neighborhood column exists on Project.');
  row('city + region', locBoth, total);
  row('city only', locCityOnly, total);
  row('region only', locRegionOnly, total);
  row('neither', locNone, total);

  console.log('\nMaterial classes present, most common first:');
  const top = [...classHistogram].sort((a, b) => b[1] - a[1]);
  for (const [cls, n] of top.slice(0, 20)) {
    console.log(`  ${cls.padEnd(20)} ${String(n).padStart(5)} project(s)   ${pct(n, total)}`);
  }
  const unseen = MATERIAL_CLASSES.filter((f) => !classHistogram.has(f));
  console.log(`\n  vocabulary: ${MATERIAL_CLASSES.length} classes, ${classHistogram.size} seen, ${unseen.length} unseen`);
  if (unseen.length) console.log(`  unseen: ${unseen.join(', ')}`);
  console.log('');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
