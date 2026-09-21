# Editorial readiness evaluation and launch gates

Status: **not evaluated for launch**. The implementation is disabled unless `STUDIO_EDITORIAL_READINESS=true`. Synthetic tests establish structural behavior only. No real project extraction, paid model call, human labeling, or token-cost measurement was performed for this implementation.

Controlled implementation limitation: Quick Finish currently requires an existing quality score of at least 80 plus one to three bounded blockers. The specification's 65-point minimum alone is insufficient because saved answers do not automatically rescore editorial quality. Candidates scoring 65–79 remain Developing; completing a credit cannot falsely promise Ready. Supporting quality reassessment for those candidates is outstanding.

## Offline human benchmark

Use an explicitly prepared, sanitized JSON export containing a candidate array (or `{ "candidates": [...] }`). Include at least **100 distinct candidates from 20 distinct projects**, covering all predicted readiness categories and the specification's strong/weak/sparse/repetitive/already-used scenarios. Keep private evidence and image URLs in an approved local location outside committed fixtures. The script never connects to production or downloads images.

```powershell
node scripts/studio-readiness-benchmark.cjs prepare candidates.json review-directory
```

This creates three new files without overwriting existing reviews. Assign one to the founder and one each to two different designers. Each reviewer supplies their identity, assesses independently before discussion, and changes `independent` to `true` only after doing so. The files hide system readiness, score, dimensions, penalties and reasons. They contain evidence, draft, image references and questions needed for assessment.

For every candidate, reviewers must fill:

- `readiness`: `ready` (publishable now), `quick` (one to three bounded fixes), `developing` (further story development), or `suppressed` (not a viable proposed story).
- `worthPublishing`, `grounded`, `visualSuitable`, and `duplicate`: explicit booleans after reviewing supplied evidence and images.
- `notes`: rationale and specific factual or visual concerns; an empty string is permitted but discouraged.

No field is inferred from the candidate's system score. Missing labels, duplicate candidate rows, changed exports, insufficient dataset size, repeated reviewer identities, or wrong roles block the benchmark gate. Independent review is attested by people; software cannot verify it.

## Approved thresholds

The specification supplies no numeric precision thresholds. Before looking at results, the founder must approve a JSON configuration with `approvedBy`, ISO timestamp `approvedAt`, and these numeric fields:

- `minPairwiseAgreement`, `minQualityPrecision`, `maxReadyFalsePositiveRate`: fractions from 0 to 1.
- `minReadyPredictions`, `minSurfacedPredictions`: positive integer minimum denominators, preventing an abstain-everywhere system from passing.

No defaults or invented approval are supplied. Score the completed reviews:

```powershell
node scripts/studio-readiness-benchmark.cjs score candidates.json review-directory/reviewer-1.json review-directory/reviewer-2.json review-directory/reviewer-3.json --thresholds approved-thresholds.json
```

The JSON report gives pairwise readiness agreement, unanimous agreement, Fleiss' kappa, Ready false-positive count/rate, Ready/Quick quality precision, grounding precision, visual suitability precision, and duplicate rate. Quality precision requires a majority of reviewers to agree within each review that the candidate is worthwhile, grounded, visually suitable, and not a duplicate. Ready false positives are system-Ready candidates without a majority human-Ready label. Zero denominators produce `null`, never a perfect score. Missing thresholds still permits metric reporting for a valid labeled dataset, but returns a blocked gate and nonzero exit code.

## Model and cost evaluation still required

Before enabling the flag beyond controlled evaluation, run old/new prompts on the same 3–5 sanitized representative fixtures, including unsupported claims with valid IDs, semantically repeated decisions with changed wording, weak/repetitive images, and a strong supported story. Record exact model, prompt version, input/output tokens (including image tokens and cache usage where applicable), provider cost, outputs and reviewer judgments. Preserve FOLIO_TONE and the canonical avoidance list verbatim. The evaluator now references both constants and requires extractive claims; readable source IDs do not establish semantic truth.

| Fixture | Old tokens in/out | New tokens in/out | Output diff / quality |
|---|---|---|---|
| Pending authorized evaluation | Not measured | Not measured | No model calls made |

Cost delta: **unknown**. Quality recommendation: **continue controlled evaluation; do not launch**. The human benchmark pass is one necessary gate, not deployment approval. Complete operational access, save/resume/export, event-history and regression checks as well.

## Deterministic checks

`node scripts/check-readiness-engine.cjs` exercises score thresholds, evidence validity, all-slide visual quality, semantic-duplicate suppression persistence, diversity limits, bounded answer transitions and immutable inputs using inert dependencies. `node scripts/check-editorial-queue-readiness.cjs` exercises queue scope, valid tags, materials, structured output and question contracts. Neither measures model quality or human agreement.
