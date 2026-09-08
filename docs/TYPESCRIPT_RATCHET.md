# TypeScript diagnostic ratchet

Folio keeps historical TypeScript debt visible while rejecting new diagnostics.
No application types, Prisma models, strictness settings, or product behavior were
changed to establish this guard. Editorial consolidation is implementation-complete;
its disposable-DB journey and P0 infrastructure verification remain parked.

## Initial measurement

- Baseline source commit: `b094b5e0a86cfdd258c0fbae2aeee8a0da9313a3`.
- Installed/lockfile compiler: TypeScript **5.9.3**.
- Canonical command: `tsc --noEmit --pretty false --incremental false`.
- Fresh result: **1,006 diagnostics**, represented by **638 distinct fingerprints** across **260 files**.
- Artifact: `tools/typescript-baseline.json`; each row is `[relative file, TS code, normalized message, count]`.
- Local raw measurement: `tasks/typescript-ratchet-before.txt` (uncommitted log).
- The structured compiler API independently measured the same 1,006 errors.
- Two diagnostics belong to generated Next route guards; those are included.

The JSON groups repeated identical errors rather than storing CLI output. It is
sorted deterministically and includes total count, source SHA, compiler version,
and command. Counts by any file/code can be derived directly from its rows.

## Commands

```sh
npm ci
npm run typecheck:prepare
npm run typecheck
npm run typecheck:test
```

Preparation runs Prisma client generation and the installed Next 14.2.33 compiler's
`next build --experimental-build-mode compile`. This produces real Next route types
without running application prerendering. It does not connect to the database or
apply migrations. Compilation still needs normal package/font access. Run preparation
after a fresh checkout and whenever routes, Prisma schema, Next config or dependencies
change; do not run it concurrently with a dev server or another build.

The checker refuses missing generated Next types or a missing/stale generated Prisma
schema. Preparation in CI is always fresh. A local existence check cannot establish
that every generated route is current: developers must prepare after route changes.
This avoids mistaking an absent `.next/types` directory for paid-down debt.

`typecheck:test` separately typechecks the JavaScript guard/tests with `--checkJs`,
then executes Node's test runner. No new test framework or dependency was added.

## Pass/fail policy

The checker reads the actual `tsconfig.json` through the installed TypeScript API,
overriding only `noEmit: true` and `incremental: false`. It collects pre-emit errors
once, without parsing or double-counting CLI wrappers. Config/compiler/setup failures
fail closed rather than being accepted as a zero-error result.

A check passes only when both conditions hold:

1. Total diagnostics are at or below the baseline.
2. Every current fingerprint's occurrence count is at or below its baseline count.

Thus fixing three errors does not create a budget for introducing one different
error. New diagnostics in unchanged consumers also fail. This is stronger than
changed-file-only enforcement and requires no fragile changed-file attribution.

Fingerprints preserve relative file, code and message, while removing line/column
positions, checkout-root paths, path separator differences and message whitespace.
Moving an existing erroneous statement within its file does not create new debt.
Multiple errors with identical fingerprints remain separate occurrences, so adding
another identical error still fails.

File renames and substantive changes in inferred diagnostic text are conservatively
new fingerprints. Compiler upgrades can also change messages. Review these changes
explicitly; there is no automatic reclassification or increase override. Two identical
diagnostics in the same file are indistinguishable beyond their count: replacing one
with an identical error elsewhere in that file is a documented limitation.

Failures print old/current/delta and the first 20 new fingerprints with file and TS
code. Long messages are shortened in console output; the compiler provides full detail.

## CI integration and baseline integrity

The existing `.github/workflows/lint.yml` retains its ESLint job and adds a TypeScript
job. Paths include source, scripts, TS/TSX declarations, tsconfig, Next config, Prisma,
package/lockfile, baseline and workflow changes. No existing check was disabled.

The job installs locked dependencies, tests the guard, prepares generated types and
runs the ratchet. Checkout uses full history. PRs supply their base SHA; main pushes
supply the previous SHA; manual runs use `origin/main`. The checker resolves the merge
base and rejects increases or newly allowed fingerprints in the PR's baseline artifact.
It also rejects uncommitted baseline expansion against HEAD during local checks.

The first rollout has no baseline at the merge base; the new artifact therefore
requires ordinary code review. Once landed, merely editing the JSON upward cannot
make CI pass. Repository administrators still need to configure this job as a required
branch-protection check if that is not already enforced; this task changes workflow
code, not GitHub branch-protection settings.

## Lowering the baseline

After fixing debt and preparing generated types where needed:

```sh
npm run typecheck:baseline:update
git diff -- tools/typescript-baseline.json
```

The command reruns the compiler, refuses increases and new replacement fingerprints,
then records a smaller result and the current source SHA. Equal debt leaves the file
unchanged. Commit the reduced baseline with the fix. Normal checks allow reductions
without rewriting the artifact; reviewers should include the update so removed debt
cannot be reintroduced later. `--init` was used only to establish the first baseline;
it refuses when the working tree or HEAD already contains a baseline.

## Measured debt and future cleanup order

Root causes below are diagnoses of the current messages, not claims that every error
in a code family has the same cause. No historical errors were permanently fixed here.

| Code | Count | Dominant examples/domains | Likely root cause | Difficulty | Suggested order |
| --- | ---: | --- | --- | --- | --- |
| TS2339 | 293 | Product page (32), EventFeed (12), admin pending invites (10), consultations and vendor spend | Missing properties; many callers expect relation/payload fields absent from generated result shapes | Medium–high; separate root query errors from genuine removed fields | 4, after repairing select/include roots |
| TS2551 | 183 | Designer recall (16), interview processing (15), recent recall (13), living skeleton (11), product insights (10) | Relation-name/result-shape mismatch; compiler often suggests an ID or differently cased relation | Medium; audit callers against generated Prisma API | 3 |
| TS2322 | 151 | About content (8), insights (7), designer sections and InterviewFlow (5 each) | Mixed assignment/prop/payload incompatibility, including Framer Motion easing widened to string | Medium; split by package/domain | 5 |
| TS2353 | 104 | Premium event audience (6), consultations, project skeleton repair and approvals (4 each) | Unknown select/include/input keys, often Prisma source/API drift; can cascade into missing relation errors | Medium–high; use existing schema, audit ownership and result shape | 2 |
| TS2802 | 59 | Search indexing (8), interview generation (5), editorial questions (5), scan analytics (4) | ES5 target with Map/Set iterators and no downlevelIteration | Low–medium; evaluate supported runtimes before a focused compiler-setting change | 1 |

The remaining 216 diagnostics span other codes. Unsafe-null and implicit-any errors
are not leading families with `strict: false`; their absence here does not establish
type safety. Generated route guards include two TS2344 errors for unsupported extra
route exports (`authOptions` and `listAllContacts`). Third-party prop mismatches are
visible in TS2322. No bulk schema repair is implied by the Prisma-related counts.

### Files with the most diagnostics

| File | Count |
| --- | ---: |
| `src/lib/atelier/__tests__/differentiation.test.ts` | 54 |
| `src/app/product/[productId]/page.tsx` | 43 |
| `src/app/api/consultations/[consultationId]/chat/route.ts` | 19 |
| `src/app/api/interviews/[id]/process/route.ts` | 18 |
| `src/lib/living/skeleton.ts` | 18 |
| `src/app/api/designer/recall/route.ts` | 17 |
| `src/components/EventFeed.tsx` | 15 |
| `src/app/api/designer/recall/recent/route.ts` | 14 |
| `src/app/api/events/[id]/audience/premium/route.ts` | 14 |
| `src/lib/events/inheritance.ts` | 14 |

## Build settings

`typescript.ignoreBuildErrors: KEPT` — 1,006 existing diagnostics would make its
immediate removal block every production build. Remove it once the baseline reaches
zero and CI proves a clean production build with the flag removed.

`eslint.ignoreDuringBuilds: KEPT` — existing ESLint CI remains authoritative. No
change to that separate policy, strict mode, target or other compiler settings.

## Verification record

Controlled proofs ran through the real CLI against the actual repository after
fresh generated-type preparation. Original source and baseline bytes were saved
and restored in a finally block; no artificial mutations remain.

| Proof | Result |
| --- | --- |
| Current baseline | PASS, 1,006 diagnostics, delta 0 |
| Temporary new TS file with one assignment error | FAIL as expected, 1,007, delta +1; identifies src/__typescript_ratchet_probe__.ts TS2322 |
| Add blank lines before an existing erroneous statement | PASS, 1,006; no new fingerprint |
| Temporarily suppress one historical workEmail error in repUtils.ts | PASS, 1,005, delta -1 |
| Baseline update under that reduction | PASS; wrote 1,006 → 1,005, then original artifact restored |
| Isolated compiler/CLI suite | 5 tests pass; includes same-count replacement, duplicate multiplicity, malformed baseline, missing preparation, refused increase/update and committed merge-base inflation |
| Guard/test JavaScript typecheck | PASS, zero errors with --checkJs |
| Focused guard/test lint | PASS, zero errors/warnings |
| CI preparation command | PASS, Prisma generation and Next compile mode |
| Full production build | PASS, exit 0; no editorial P2022 error matches |
| Final CI-style ratchet after full build | PASS, 1,006 diagnostics, delta 0, no new fingerprints |
| Client-import guard | PASS, 2,203 files / 915 client modules |
| IDOR | Unchanged: 0 Critical, 1 existing High, 16 Medium, 19 Low across 558 routes |
| Migration discipline | PASS; no schema/migration changes |

Local proof logs: tasks/typescript-ratchet-proof-{baseline,increase,movement,reduction-update}.txt.
The test suite also creates and deletes isolated temporary Git/compiler fixtures.
Git diff confirms no permanent src/, prisma/, tsconfig.json or next.config.js edits.
CI workflow YAML parses successfully and preserves the existing ESLint job.
GitHub-hosted job execution is not claimed by these local checks.

### Complete diagnostic counts by code

| Code | Count |
| --- | ---: |
| TS2339 | 293 |
| TS2551 | 183 |
| TS2322 | 151 |
| TS2353 | 104 |
| TS2802 | 59 |
| TS2561 | 44 |
| TS2304 | 41 |
| TS2345 | 32 |
| TS2582 | 17 |
| TS2352 | 13 |
| TS2305 | 9 |
| TS2615 | 6 |
| TS2741 | 6 |
| TS2367 | 4 |
| TS2459 | 4 |
| TS2739 | 4 |
| TS18004 | 4 |
| TS2307 | 3 |
| TS2503 | 3 |
| TS1355 | 2 |
| TS2344 | 2 |
| TS2349 | 2 |
| TS2448 | 2 |
| TS2538 | 2 |
| TS2552 | 2 |
| TS2554 | 2 |
| TS2693 | 2 |
| TS2740 | 2 |
| TS2769 | 2 |
| TS1055 | 1 |
| TS1117 | 1 |
| TS2614 | 1 |
| TS2677 | 1 |
| TS2719 | 1 |
| TS2865 | 1 |

Final local logs: `tasks/typescript-ratchet-build.txt` and `tasks/typescript-ratchet-final.txt`. The final check used `TYPESCRIPT_BUDGET_BASE_REF=origin/main` with `npm run typecheck`, matching CI. The baseline remains 1,006; the temporary reduction was restored.

**TYPESCRIPT RATCHET COMPLETE**
