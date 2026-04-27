/**
 * AI Coverage Audit (Step 0 — v3 Publishing scope lock)
 *
 * Read-only audit of aiMaterials / aiColors / aiTags / aiSpaces coverage
 * across published projects. Output feeds the v3 Publishing v1 scope decision:
 * does Material Story / Color Story make the launch enum, slip to v1.5, or
 * ship dark?
 *
 * Usage:
 *   npx tsx src/scripts/audit-ai-coverage.ts
 *
 * Outputs:
 *   - per-project + global summary table to stdout
 *   - JSON dump to tmp/audit-ai-coverage-<timestamp>.json
 */

import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { MATERIAL_KEYWORDS } from '@/lib/search/indexMoment';

const MIN_IMAGES_FOR_STORY = 6;
const GENUINE_RATIO_THRESHOLD = 0.6;
const MIN_OCCURRENCES_FOR_ROOM_SPAN = 3;
const MIN_DISTINCT_ROOMS_FOR_MATERIAL = 2;
const COLORS_SHAPE_PARSER_COVERAGE_THRESHOLD = 0.8;
const PASS_PERCENT_BAR = 70;

const MATERIAL_KEYWORD_SET = new Set(MATERIAL_KEYWORDS.map((k) => k.toLowerCase()));

type AiColorsShape =
  | 'null'
  | 'object_dominant_palette'
  | 'object_other'
  | 'string_hex'
  | 'array_hex'
  | 'array_other'
  | 'other';

function classifyAiColorsShape(value: unknown): AiColorsShape {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') {
    return /^#?[0-9a-f]{3,8}$/i.test(value) ? 'string_hex' : 'other';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array_other';
    const allHex = value.every(
      (v) => typeof v === 'string' && /^#?[0-9a-f]{3,8}$/i.test(v),
    );
    return allHex ? 'array_hex' : 'array_other';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.includes('dominant') && keys.includes('palette')) {
      return 'object_dominant_palette';
    }
    return 'object_other';
  }
  return 'other';
}

function isAiColorsShapeValid(shape: AiColorsShape): boolean {
  return shape !== 'null' && shape !== 'other' && shape !== 'array_other';
}

function pad(s: string, width: number): string {
  if (s.length >= width) return s;
  return s + ' '.repeat(width - s.length);
}

function pct(num: number, denom: number): number {
  if (denom === 0) return 0;
  return Math.round((num / denom) * 100);
}

function topN<T>(counts: Map<T, number>, n: number): Array<[T, number]> {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

async function main() {
  console.log('🔍 AI Coverage Audit — Folio v3 Publishing v1 scope lock\n');

  const projects = await prisma.project.findMany({
    where: {
      isPublic: true,
      publishedAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      designer: { select: { name: true } },
      owner: { select: { name: true } },
      post: { select: { slug: true } },
      images: {
        select: {
          id: true,
          room: true,
          aiTags: true,
          aiSpaces: true,
          aiMaterials: true,
          aiColors: true,
        },
      },
    },
    orderBy: { publishedAt: 'desc' },
  });

  if (projects.length === 0) {
    console.log('No published projects found. Nothing to audit.');
    return;
  }

  console.log(`Published projects: ${projects.length}\n`);

  // -------- Pre-step: aiColors shape sample --------
  const allImagesWithColors = projects.flatMap((p) =>
    p.images.filter((img) => img.aiColors !== null && img.aiColors !== undefined),
  );

  console.log('📦 aiColors shape pre-check (5 random samples):');
  const sampleSize = Math.min(5, allImagesWithColors.length);
  for (let i = 0; i < sampleSize; i++) {
    const idx = Math.floor(Math.random() * allImagesWithColors.length);
    const img = allImagesWithColors[idx];
    const shape = classifyAiColorsShape(img.aiColors);
    const preview = JSON.stringify(img.aiColors).slice(0, 120);
    console.error(`  [${shape}] image=${img.id.slice(0, 8)} sample=${preview}`);
  }
  console.log('');

  // -------- Per-project metrics --------
  type ProjectRow = {
    slug: string;
    title: string;
    designer: string;
    images: number;
    matCovered: number;
    matCoveragePct: number;
    colCoveredShapeValid: number;
    colCoveragePct: number;
    tagsCovered: number;
    spacesCovered: number;
    genuineRatio: number;
    topMaterial: string | null;
    topMaterialRoomSpan: number;
    topMaterialOccurrences: number;
    topMaterials: Array<[string, number]>;
    topColors: Array<[string, number]>;
    materialStoryPass: boolean;
    colorStoryPass: boolean;
    aiColorsShapeCounts: Record<string, number>;
  };

  const rows: ProjectRow[] = [];

  // Corpus-wide aggregates
  const corpusMaterialCounts = new Map<string, number>();
  const corpusColorCounts = new Map<string, number>();
  const corpusAiColorsShapeCounts: Record<string, number> = {};
  let corpusEmptyMaterialsProjects = 0;
  const matTaggedHistogram = new Map<number, number>(); // bucket -> count of projects
  const roomSpanHistogram = new Map<number, number>(); // span -> count of materials

  for (const project of projects) {
    const images = project.images;
    const imageCount = images.length;

    const matCovered = images.filter((i) => (i.aiMaterials || []).length > 0).length;
    const tagsCovered = images.filter((i) => (i.aiTags || []).length > 0).length;
    const spacesCovered = images.filter((i) => (i.aiSpaces || []).length > 0).length;

    let colCoveredShapeValid = 0;
    const projectShapeCounts: Record<string, number> = {};
    for (const img of images) {
      const shape = classifyAiColorsShape(img.aiColors);
      projectShapeCounts[shape] = (projectShapeCounts[shape] || 0) + 1;
      corpusAiColorsShapeCounts[shape] = (corpusAiColorsShapeCounts[shape] || 0) + 1;
      if (isAiColorsShapeValid(shape)) colCoveredShapeValid++;
    }

    // Per-project material counts + room-span analysis
    const projectMaterialCounts = new Map<string, number>();
    const projectMaterialRooms = new Map<string, Set<string>>();
    for (const img of images) {
      const mats = (img.aiMaterials || []).map((m) => m.toLowerCase().trim()).filter(Boolean);
      const room = img.room?.trim() || null;
      const seen = new Set<string>();
      for (const m of mats) {
        if (seen.has(m)) continue; // count once per image
        seen.add(m);
        projectMaterialCounts.set(m, (projectMaterialCounts.get(m) || 0) + 1);
        corpusMaterialCounts.set(m, (corpusMaterialCounts.get(m) || 0) + 1);
        if (room) {
          if (!projectMaterialRooms.has(m)) projectMaterialRooms.set(m, new Set());
          projectMaterialRooms.get(m)!.add(room);
        }
      }
    }

    // Color counts (best-effort, only for object_dominant_palette/string/array)
    for (const img of images) {
      const value = img.aiColors;
      const shape = classifyAiColorsShape(value);
      if (shape === 'object_dominant_palette') {
        const obj = value as { dominant?: unknown; palette?: unknown };
        if (typeof obj.dominant === 'string') {
          corpusColorCounts.set(obj.dominant, (corpusColorCounts.get(obj.dominant) || 0) + 1);
        }
        if (Array.isArray(obj.palette)) {
          for (const c of obj.palette) {
            if (typeof c === 'string') {
              corpusColorCounts.set(c, (corpusColorCounts.get(c) || 0) + 1);
            }
          }
        }
      } else if (shape === 'array_hex' && Array.isArray(value)) {
        for (const c of value) {
          if (typeof c === 'string') {
            corpusColorCounts.set(c, (corpusColorCounts.get(c) || 0) + 1);
          }
        }
      } else if (shape === 'string_hex' && typeof value === 'string') {
        corpusColorCounts.set(value, (corpusColorCounts.get(value) || 0) + 1);
      }
    }

    // Genuine-material ratio over UNIQUE values
    const uniqueMaterials = Array.from(projectMaterialCounts.keys());
    const genuineCount = uniqueMaterials.filter((m) => MATERIAL_KEYWORD_SET.has(m)).length;
    const genuineRatio = uniqueMaterials.length === 0 ? 0 : genuineCount / uniqueMaterials.length;

    // Top material on the project + its room span
    const topMatEntries = topN(projectMaterialCounts, 1);
    const topMaterial = topMatEntries[0]?.[0] || null;
    const topMaterialOccurrences = topMatEntries[0]?.[1] || 0;
    const topMaterialRoomSpan = topMaterial
      ? projectMaterialRooms.get(topMaterial)?.size || 0
      : 0;

    // Room-span histogram contribution: every material with ≥3 occurrences
    projectMaterialCounts.forEach((count, mat) => {
      if (count >= MIN_OCCURRENCES_FOR_ROOM_SPAN) {
        const span = projectMaterialRooms.get(mat)?.size || 0;
        roomSpanHistogram.set(span, (roomSpanHistogram.get(span) || 0) + 1);
      }
    });

    if (matCovered === 0) corpusEmptyMaterialsProjects++;

    // Material-tagged histogram bucket (count by exact image count, capped at 20)
    const bucket = Math.min(matCovered, 20);
    matTaggedHistogram.set(bucket, (matTaggedHistogram.get(bucket) || 0) + 1);

    const materialStoryPass =
      matCovered >= MIN_IMAGES_FOR_STORY &&
      topMaterialRoomSpan >= MIN_DISTINCT_ROOMS_FOR_MATERIAL &&
      genuineRatio >= GENUINE_RATIO_THRESHOLD;

    const colorStoryPass = colCoveredShapeValid >= MIN_IMAGES_FOR_STORY;

    rows.push({
      slug: project.post?.slug || project.id.slice(0, 8),
      title: project.title || '(untitled)',
      designer: project.designer?.name || project.owner?.name || '—',
      images: imageCount,
      matCovered,
      matCoveragePct: pct(matCovered, imageCount),
      colCoveredShapeValid,
      colCoveragePct: pct(colCoveredShapeValid, imageCount),
      tagsCovered,
      spacesCovered,
      genuineRatio,
      topMaterial,
      topMaterialRoomSpan,
      topMaterialOccurrences,
      topMaterials: topN(projectMaterialCounts, 5),
      topColors: [],
      materialStoryPass,
      colorStoryPass,
      aiColorsShapeCounts: projectShapeCounts,
    });
  }

  // -------- Stdout: per-project rows --------
  console.log('Per-project coverage:\n');
  console.log(
    pad('slug', 30),
    pad('designer', 22),
    pad('imgs', 6),
    pad('mat', 14),
    pad('col', 14),
    pad('genuine', 9),
    'top_mat (rooms)',
  );
  console.log('-'.repeat(120));
  for (const r of rows) {
    const matStr = `${r.matCovered}/${r.images} (${r.matCoveragePct}%)`;
    const colStr = `${r.colCoveredShapeValid}/${r.images} (${r.colCoveragePct}%)`;
    const genuineStr = `${Math.round(r.genuineRatio * 100)}%`;
    const topMatStr = r.topMaterial
      ? `${r.topMaterial} (${r.topMaterialOccurrences} imgs / ${r.topMaterialRoomSpan} rooms)`
      : '—';
    const flag = r.materialStoryPass ? '✅' : '  ';
    console.log(
      flag,
      pad(r.slug.slice(0, 28), 30),
      pad(r.designer.slice(0, 20), 22),
      pad(String(r.images), 6),
      pad(matStr, 14),
      pad(colStr, 14),
      pad(genuineStr, 9),
      topMatStr,
    );
  }

  // -------- Global summary --------
  const matStoryPassed = rows.filter((r) => r.materialStoryPass).length;
  const colStoryPassed = rows.filter((r) => r.colorStoryPass).length;
  const totalImages = rows.reduce((sum, r) => sum + r.images, 0);
  const avgImages = projects.length === 0 ? 0 : Math.round(totalImages / projects.length);

  // aiColors shape coverage check (corpus-wide): does dominant shape cover ≥80%?
  const totalShapeCount = Object.values(corpusAiColorsShapeCounts).reduce((s, n) => s + n, 0);
  const validShapeCount = Object.entries(corpusAiColorsShapeCounts)
    .filter(([k]) => isAiColorsShapeValid(k as AiColorsShape))
    .reduce((s, [, n]) => s + n, 0);
  const dominantShapeEntry = Object.entries(corpusAiColorsShapeCounts).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const dominantShapeCoverage =
    totalShapeCount === 0 ? 0 : (dominantShapeEntry?.[1] || 0) / totalShapeCount;
  const colorsShapeIsConsistent =
    dominantShapeCoverage >= COLORS_SHAPE_PARSER_COVERAGE_THRESHOLD &&
    isAiColorsShapeValid(dominantShapeEntry?.[0] as AiColorsShape);

  console.log('\n' + '='.repeat(120));
  console.log('📊 GLOBAL SUMMARY\n');
  console.log(`Published projects:        ${projects.length}`);
  console.log(`Total images:              ${totalImages}`);
  console.log(`Avg images/project:        ${avgImages}`);
  console.log('');
  console.log(
    `Material Story v1 bar (≥${MIN_IMAGES_FOR_STORY} mat-tagged imgs, top mat ≥${MIN_DISTINCT_ROOMS_FOR_MATERIAL} rooms, ≥${Math.round(
      GENUINE_RATIO_THRESHOLD * 100,
    )}% genuine):`,
  );
  console.log(
    `  Pass: ${matStoryPassed} (${pct(matStoryPassed, projects.length)}%)   Fail: ${
      projects.length - matStoryPassed
    } (${pct(projects.length - matStoryPassed, projects.length)}%)`,
  );
  console.log(
    `Color Story v1 bar (≥${MIN_IMAGES_FOR_STORY} col-tagged imgs, shape-valid):`,
  );
  console.log(
    `  Pass: ${colStoryPassed} (${pct(colStoryPassed, projects.length)}%)   Fail: ${
      projects.length - colStoryPassed
    } (${pct(projects.length - colStoryPassed, projects.length)}%)`,
  );
  console.log('');
  console.log(`Empty-aiMaterials projects:   ${corpusEmptyMaterialsProjects}`);
  console.log(
    `Top materials across corpus:  ${topN(corpusMaterialCounts, 10)
      .map(([m, c]) => `${m}(${c})`)
      .join(', ')}`,
  );
  console.log(
    `Top colors across corpus:     ${topN(corpusColorCounts, 10)
      .map(([c, n]) => `${c}(${n})`)
      .join(', ') || '(none parseable)'}`,
  );
  console.log('');

  console.log('Material-tagged image distribution (bucket → projects):');
  const sortedBuckets = Array.from(matTaggedHistogram.entries()).sort((a, b) => a[0] - b[0]);
  for (const [bucket, count] of sortedBuckets) {
    const label = bucket === 20 ? '≥20' : String(bucket);
    console.log(`  ${pad(label, 4)} mat-imgs:  ${'█'.repeat(count)} ${count}`);
  }
  console.log('');

  console.log(
    `Room-span distribution (materials with ≥${MIN_OCCURRENCES_FOR_ROOM_SPAN} occurrences on a project):`,
  );
  const sortedSpans = Array.from(roomSpanHistogram.entries()).sort((a, b) => a[0] - b[0]);
  if (sortedSpans.length === 0) {
    console.log('  (no materials with ≥3 occurrences)');
  } else {
    for (const [span, count] of sortedSpans) {
      console.log(`  ${pad(String(span), 4)} rooms:    ${'█'.repeat(count)} ${count}`);
    }
  }
  console.log('');

  console.log('Side-findings:');
  console.log(
    '  - Generator at src/lib/instagram/campaign/selectCampaignContent.ts:161 reads aiTags',
  );
  console.log(
    '    instead of aiMaterials. Real material coverage is the mat= column above, not whatever',
  );
  console.log('    the campaign preview is currently emitting.');
  console.log('');
  console.log('  - aiColors shape inventory:');
  for (const [shape, count] of Object.entries(corpusAiColorsShapeCounts).sort(
    (a, b) => b[1] - a[1],
  )) {
    const shapePct = pct(count, totalShapeCount);
    console.log(`      ${pad(shape, 28)} ${count} (${shapePct}%)`);
  }
  console.log(
    `    Dominant shape '${dominantShapeEntry?.[0] || '—'}' covers ${Math.round(
      dominantShapeCoverage * 100,
    )}% of values — ${colorsShapeIsConsistent ? 'consistent' : 'FRAGMENTED'}`,
  );
  if (!colorsShapeIsConsistent) {
    console.log(
      `    Color Story slips regardless of coverage % until a normalizer is in place.`,
    );
  }

  // -------- Decision summary --------
  const matPassPct = pct(matStoryPassed, projects.length);
  const colPassPct = pct(colStoryPassed, projects.length);

  console.log('\n📋 v1 SCOPE INDICATIONS:');
  if (matPassPct >= PASS_PERCENT_BAR) {
    console.log(
      `  Material Story: IN v1 (${matPassPct}% of projects pass the bar — above ${PASS_PERCENT_BAR}%).`,
    );
  } else if (matPassPct >= 30) {
    console.log(
      `  Material Story: enum-only v1, generator v1.5 (${matPassPct}% pass — between 30% and ${PASS_PERCENT_BAR}%).`,
    );
  } else {
    console.log(
      `  Material Story: SLIP to v1.5, omit from v1 enum (${matPassPct}% pass — below 30%).`,
    );
  }

  if (!colorsShapeIsConsistent) {
    console.log(
      `  Color Story:    SLIP to v1.5 (aiColors shape fragmented; ${Math.round(
        dominantShapeCoverage * 100,
      )}% on dominant shape, need ${Math.round(COLORS_SHAPE_PARSER_COVERAGE_THRESHOLD * 100)}%).`,
    );
  } else if (colPassPct >= PASS_PERCENT_BAR) {
    console.log(
      `  Color Story:    IN v1 (${colPassPct}% of projects pass, shape consistent).`,
    );
  } else if (colPassPct >= 30) {
    console.log(
      `  Color Story:    enum-only v1, generator v1.5 (${colPassPct}% pass).`,
    );
  } else {
    console.log(`  Color Story:    SLIP to v1.5 (${colPassPct}% pass).`);
  }

  // -------- JSON dump --------
  const tmpDir = path.resolve(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dumpPath = path.join(tmpDir, `audit-ai-coverage-${stamp}.json`);

  const dump = {
    generatedAt: new Date().toISOString(),
    thresholds: {
      MIN_IMAGES_FOR_STORY,
      GENUINE_RATIO_THRESHOLD,
      MIN_OCCURRENCES_FOR_ROOM_SPAN,
      MIN_DISTINCT_ROOMS_FOR_MATERIAL,
      COLORS_SHAPE_PARSER_COVERAGE_THRESHOLD,
      PASS_PERCENT_BAR,
    },
    summary: {
      publishedProjects: projects.length,
      totalImages,
      avgImages,
      matStoryPassed,
      matStoryPassPct: matPassPct,
      colStoryPassed,
      colStoryPassPct: colPassPct,
      emptyMaterialsProjects: corpusEmptyMaterialsProjects,
      topMaterials: topN(corpusMaterialCounts, 20),
      topColors: topN(corpusColorCounts, 20),
      aiColorsShapeCounts: corpusAiColorsShapeCounts,
      colorsShapeIsConsistent,
      dominantShape: dominantShapeEntry?.[0] || null,
      dominantShapeCoverage,
      validShapeCount,
      matTaggedHistogram: Array.from(matTaggedHistogram.entries()).sort((a, b) => a[0] - b[0]),
      roomSpanHistogram: Array.from(roomSpanHistogram.entries()).sort((a, b) => a[0] - b[0]),
    },
    projects: rows,
  };

  await fs.writeFile(dumpPath, JSON.stringify(dump, null, 2));
  console.log(`\n💾 JSON dump → ${path.relative(process.cwd(), dumpPath)}`);
}

main()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch(async (err) => {
    console.error('Audit failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
