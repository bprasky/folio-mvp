/**
 * Finish Schedule VALIDATION HARNESS — persists nothing, changes no schema.
 *
 * Usage:
 *   npx tsx scripts/validate-finish-schedule.ts <file> <projectId> [--mime <mime>]
 *   npx tsx scripts/validate-finish-schedule.ts --parse-only <file> [--mime <mime>]
 *
 * Runs, in order:
 *   D1  parse stage      -> prints { rows, unparsed }
 *   D2  locate wiring     -> prints coordinate JSON (needs projectId + ANTHROPIC_API_KEY)
 *   D3  miss-behavior     -> deliberately locates an absent product and prints the raw return
 *
 * Reads the DB read-only (rooms + photos). Writes nothing to the DB. The only
 * thing it writes to disk is this run's stdout — no app state is touched.
 */

import { parseFinishSchedule } from './finish-schedule/parse';
import { locateFromSchedule } from './finish-schedule/locate';

async function main() {
  const argv = process.argv.slice(2);
  const parseOnly = argv.includes('--parse-only');
  const mimeIdx = argv.indexOf('--mime');
  const mime = mimeIdx >= 0 ? argv[mimeIdx + 1] : undefined;
  const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--mime');

  const filePath = positional[0];
  const projectId = parseOnly ? undefined : positional[1];

  if (!filePath) {
    console.error('Usage: npx tsx scripts/validate-finish-schedule.ts <file> <projectId> [--mime <mime>]');
    console.error('       npx tsx scripts/validate-finish-schedule.ts --parse-only <file> [--mime <mime>]');
    process.exit(1);
  }

  // -------- Deliverable 1: parse --------
  banner('D1 — PARSE STAGE');
  const parsed = await parseFinishSchedule(filePath, mime);
  console.log(`format detected: ${parsed.format}`);
  console.log(`rows parsed:     ${parsed.rows.length}`);
  console.log(`unparsed:        ${parsed.unparsed.length}`);
  console.log('\nrows:');
  console.log(JSON.stringify(parsed.rows, null, 2));
  console.log('\nunparsed:');
  console.log(JSON.stringify(parsed.unparsed, null, 2));

  if (parseOnly) {
    banner('PARSE-ONLY: stopping before locate (no DB / no vision call)');
    return;
  }
  if (!projectId) {
    console.error('\nNo projectId given — skipping locate (D2) and miss-check (D3).');
    return;
  }

  // -------- Deliverable 2: locate --------
  banner('D2 — LOCATE WIRING');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY not set — the vision call will return [] for every photo.');
    console.warn('Room resolution + photo enumeration still run so you can see coverage.\n');
  }
  const located = await locateFromSchedule(projectId, parsed.rows);
  console.log(`rooms matched:            ${located.roomsMatched}`);
  console.log(`unresolved room labels:   ${JSON.stringify(located.unresolvedRoomLabels)}`);
  console.log(`rooms matched w/o photos: ${JSON.stringify(located.roomsWithoutPhotos)}`);
  const locatedCount = located.products.filter((p) => p.located).length;
  console.log(`products located:         ${locatedCount} / ${located.products.length}`);
  console.log('\nlocate result:');
  console.log(JSON.stringify(located.products, null, 2));

  // -------- Deliverable 3: miss-behavior characterization --------
  banner('D3 — MISS-BEHAVIOR CHECK');
  await runMissCheck(projectId);
}

/**
 * Deliberately ask the targeted vision call to locate a product that cannot be
 * present, alongside a generic likely-present hint, and print the raw return.
 * This is the decision input for how `isLocated` keys off the locate result.
 */
async function runMissCheck(projectId: string) {
  const { prisma } = await import('@/lib/prisma');
  const { estimateProductCoordinates } = await import('@/lib/tagging/estimateProductCoordinates');

  const photo = await prisma.projectImage.findFirst({
    where: { project: { id: projectId } },
    select: { id: true, url: true },
  });

  if (!photo) {
    console.warn('No project image found — cannot run the live miss check.');
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY not set — cannot run the live miss check.');
    console.warn('Run this harness in an environment with the key to capture empirical numbers.');
    return;
  }

  const ABSENT = 'vintage red British telephone booth';
  const PRESENT_HINT = 'flooring';
  console.log(`photo: ${photo.id} ${photo.url}`);
  console.log(`absent product (deliberate miss): "${ABSENT}"`);
  console.log(`present hint (likely true hit):    "${PRESENT_HINT}"\n`);

  const detections = await estimateProductCoordinates(photo.url, [ABSENT, PRESENT_HINT]);
  console.log('raw estimateProductCoordinates return:');
  console.log(JSON.stringify(detections, null, 2));

  const absentHit = detections.find((d) => d.description.toLowerCase().includes('telephone') || d.description.toLowerCase().includes('booth'));
  console.log('\n--- interpretation ---');
  console.log(`absent product present in return? ${absentHit ? 'YES (' + JSON.stringify(absentHit) + ')' : 'NO — absent from the array'}`);
  console.log('confidence values observed:', JSON.stringify(detections.map((d) => d.confidence)));
}

function banner(s: string) {
  console.log('\n' + '='.repeat(72));
  console.log(s);
  console.log('='.repeat(72));
}

main()
  .catch((err) => {
    console.error('Harness error:', err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      const { prisma } = await import('@/lib/prisma');
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  });
