// Offline human benchmark only. No database, image downloads, or model calls.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { z } = require('zod');
const labels = ['ready', 'quick', 'developing', 'suppressed'];
const CandidateSchema = z.object({ id: z.string().min(1), projectIds: z.array(z.string().min(1)).min(1), readiness: z.enum(labels),
  thesis: z.string(), claims: z.array(z.unknown()), evidence: z.array(z.unknown()), visuals: z.array(z.unknown()), draft: z.unknown(), blockers: z.array(z.unknown()) }).passthrough();
const ReviewSchema = z.object({ reviewerId: z.string().trim().min(1), role: z.enum(['founder', 'designer']), datasetHash: z.string(),
  independent: z.literal(true), reviews: z.array(z.object({ candidateId: z.string(), readiness: z.enum(labels), worthPublishing: z.boolean(),
    grounded: z.boolean(), visualSuitable: z.boolean(), duplicate: z.boolean(), notes: z.string() })) });
const ThresholdSchema = z.object({ approvedBy: z.string().trim().min(1), approvedAt: z.string().datetime(),
  minPairwiseAgreement: z.number().min(0).max(1), minQualityPrecision: z.number().min(0).max(1),
  maxReadyFalsePositiveRate: z.number().min(0).max(1), minReadyPredictions: z.number().int().min(1), minSurfacedPredictions: z.number().int().min(1) });
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = data => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
function dataset(file) {
  const raw = read(file), candidates = z.array(CandidateSchema).parse(Array.isArray(raw) ? raw : raw.candidates);
  if (new Set(candidates.map(c => c.id)).size !== candidates.length) throw new Error('Duplicate candidate ids in dataset');
  return candidates;
}
function prepare(input, output) {
  const candidates = dataset(input), datasetHash = hash(candidates);
  fs.mkdirSync(output, { recursive: true });
  const blind = candidates.map(c => ({ candidateId: c.id, projectIds: c.projectIds, thesis: c.thesis, claims: c.claims, evidence: c.evidence,
    visuals: c.visuals, draft: c.draft, blockers: c.blockers.map(({ answer, question, options }) => ({ answer, question, options })),
    readiness: null, worthPublishing: null, grounded: null, visualSuitable: null, duplicate: null, notes: '' }));
  for (const [index, role] of ['founder', 'designer', 'designer'].entries()) {
    fs.writeFileSync(path.join(output, `reviewer-${index + 1}.json`), JSON.stringify({ reviewerId: null, role, datasetHash, independent: false, reviews: blind }, null, 2), { flag: 'wx' });
  }
  console.log(`Prepared 3 blinded review files for ${candidates.length} candidates. Fill independently; no labels were inferred.`);
}
const ratio = (n, d) => d ? n / d : null;
function score(input, reviewFiles, thresholdsFile) {
  const candidates = dataset(input), datasetHash = hash(candidates), failures = [];
  const projectCount = new Set(candidates.flatMap(c => c.projectIds)).size;
  if (candidates.length < 100) failures.push('At least 100 distinct candidates required');
  if (projectCount < 20) failures.push('At least 20 distinct projects required');
  if (reviewFiles.length !== 3) failures.push('Exactly three independent reviewers required');
  const reviews = [];
  for (const file of reviewFiles) {
    const parsed = ReviewSchema.safeParse(read(file));
    if (!parsed.success) { failures.push(`${path.basename(file)}: missing or invalid identity, independence attestation, or labels`); continue; }
    reviews.push(parsed.data);
  }
  if (new Set(reviews.map(r => r.reviewerId)).size !== 3 || reviews.filter(r => r.role === 'founder').length !== 1 || reviews.filter(r => r.role === 'designer').length !== 2) {
    failures.push('Require three distinct reviewers: one founder and two designers');
  }
  const ids = new Set(candidates.map(c => c.id));
  for (const review of reviews) {
    if (review.datasetHash !== datasetHash) failures.push(`${review.reviewerId}: dataset changed`);
    if (review.reviews.length !== candidates.length || new Set(review.reviews.map(r => r.candidateId)).size !== candidates.length || review.reviews.some(r => !ids.has(r.candidateId))) {
      failures.push(`${review.reviewerId}: every candidate must be labeled exactly once`);
    }
  }
  const structuralFailures = [...failures];
  let metrics = null;
  if (!structuralFailures.length) {
    const byReviewer = reviews.map(r => new Map(r.reviews.map(row => [row.candidateId, row])));
    let pairAgreements = 0, unanimous = 0, ready = 0, readyFalse = 0, surfaced = 0, quality = 0, grounded = 0, visual = 0, duplicates = 0;
    const labelCounts = Object.fromEntries(labels.map(label => [label, 0]));
    for (const c of candidates) {
      const rows = byReviewer.map(map => map.get(c.id));
      rows.forEach(row => labelCounts[row.readiness]++);
      pairAgreements += Number(rows[0].readiness === rows[1].readiness) + Number(rows[0].readiness === rows[2].readiness) + Number(rows[1].readiness === rows[2].readiness);
      unanimous += Number(rows.every(row => row.readiness === rows[0].readiness));
      if (c.readiness === 'ready') { ready++; readyFalse += Number(rows.filter(row => row.readiness === 'ready').length < 2); }
      if (['ready', 'quick'].includes(c.readiness)) {
        surfaced++;
        quality += Number(rows.filter(row => row.worthPublishing && row.grounded && row.visualSuitable && !row.duplicate).length >= 2);
        grounded += Number(rows.filter(row => row.grounded).length >= 2);
        visual += Number(rows.filter(row => row.visualSuitable).length >= 2);
        duplicates += Number(rows.filter(row => row.duplicate).length >= 2);
      }
    }
    const agreement = pairAgreements / (candidates.length * 3);
    const chance = Object.values(labelCounts).reduce((sum, count) => sum + (count / (candidates.length * 3)) ** 2, 0);
    metrics = { pairwiseAgreement: agreement, unanimousAgreement: unanimous / candidates.length, fleissKappa: chance === 1 ? null : (agreement - chance) / (1 - chance),
      readyPredictions: ready, readyFalsePositives: readyFalse, readyFalsePositiveRate: ratio(readyFalse, ready),
      surfacedPredictions: surfaced, qualityPrecision: ratio(quality, surfaced), groundingPrecision: ratio(grounded, surfaced),
      visualSuitabilityPrecision: ratio(visual, surfaced), duplicateRate: ratio(duplicates, surfaced) };
  }
  let thresholds = null;
  if (thresholdsFile) {
    const result = ThresholdSchema.safeParse(read(thresholdsFile));
    if (result.success) thresholds = result.data; else failures.push('Threshold configuration is incomplete or unapproved');
  } else failures.push('Explicit approved launch thresholds required; no default pass thresholds');
  if (metrics && thresholds) {
    for (const [metric, limit, minimum] of [['pairwiseAgreement', 'minPairwiseAgreement', true], ['qualityPrecision', 'minQualityPrecision', true],
      ['readyFalsePositiveRate', 'maxReadyFalsePositiveRate', false], ['readyPredictions', 'minReadyPredictions', true], ['surfacedPredictions', 'minSurfacedPredictions', true]]) {
      if (metrics[metric] === null || (minimum ? metrics[metric] < thresholds[limit] : metrics[metric] > thresholds[limit])) failures.push(`${metric} does not meet approved threshold`);
    }
  }
  return { datasetHash, candidates: candidates.length, projects: projectCount, reviewers: reviews.map(({ reviewerId, role }) => ({ reviewerId, role })),
    metrics, thresholds, benchmarkGate: failures.length ? 'blocked' : 'passed', failures,
    limitation: 'Human benchmark gate only. This script cannot attest reviewer independence or approve deployment. Prompt quality/token-cost evaluation and operational acceptance remain separate.' };
}
function main() {
  const [command, input, ...args] = process.argv.slice(2);
  if (command === 'prepare' && input && args.length === 1) return prepare(input, args[0]);
  if (command === 'score' && input) {
    const index = args.indexOf('--thresholds'), reviewFiles = index < 0 ? args : args.slice(0, index), thresholds = index < 0 ? undefined : args[index + 1];
    const report = score(input, reviewFiles, thresholds); console.log(JSON.stringify(report, null, 2));
    if (report.benchmarkGate !== 'passed') process.exitCode = 1;
    return;
  }
  throw new Error('Usage: node scripts/studio-readiness-benchmark.cjs prepare candidates.json output-dir | score candidates.json reviewer-1.json reviewer-2.json reviewer-3.json [--thresholds approved-thresholds.json]');
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { score, prepare };
