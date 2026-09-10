# Separate review: TypeScript display equivalences

This is a diagnostic-comparison change accompanying PR #766, separate from approval of the two-table migration. No application source, Prisma schema, migration SQL or error-budget entry is changed.

## Finding

The reviewed baseline and installed schema each produce **904 diagnostics at the same source spans in identical source files**, with TypeScript 5.9.3. Captures used `noErrorTruncation: true` so omitted type fields could not conceal differences. Every occurrence was matched once; multiplicities, file, code, start, length and source-content hash match. Generating either client never edited the active schema; the approved client was restored afterward.

Of the **47 changed short fingerprints**, **45** are type-property display-order changes. Two TS2322 errors choose a different incompatible-property witness:

| Existing error location | Before witness | After witness | Verification |
|---|---|---|---|
| ActionItem create `data` in `src/app/api/action-items/route.ts` | `createdById: string` versus `never` | `projectId: string` versus `never` | Complete source type, each target union variant, all source-property types and assignability results, and all missing required target properties are identical |
| EventProductEdge create `data` in `src/app/api/events/[id]/graph/route.ts` | `eventId: string` versus `never` | `productId: any` versus `never` | Same complete assignment checks, not merely equal error counts |

Untruncated text exposes 86 changed full diagnostic renderings overall: 84 compare identically after sorting only unordered, uniquely named property signatures, and the two above have identical complete assignment witnesses. The extra changes were hidden by truncation in the original short messages. No overload, parameter, union-member, index-signature or method order was normalized. The full proof and assignment comparisons are retained in `SPOTLIGHT_TYPESCRIPT_FULL_PROOF.json`.

## Narrow change for review

`tools/typescript-display-equivalences.json` contains exactly the 47 reviewed **file + diagnostic code + complete short-message** before/after pairs, with counts and reasons. The ratchet maps only an exact known alternative rendering to its existing baseline key. It does not strip arbitrary type text, ignore a file/code, loosen assignability, or globally ignore incompatible-property changes. An unreviewed rendering fails as before. The equivalences apply only to the reviewed compiler version; a compiler upgrade uses strict unmatched keys until reviewed.

`scripts/check-typescript-budget.mjs` aggregates multiplicities after equivalence mapping. Both renderings occurring together consume their combined count, so a removed error cannot fund a repeated old error. Total budget remains **904**, and `tools/typescript-baseline.json` is byte-for-byte unchanged. Baseline integrity checks against HEAD and merge base remain enabled. The fixture test asserting the exact 47-entry scope prevents silently growing this list.

This finite list is intentional: a general sort of **truncated** object previews cannot recover omitted members and could conceal a real type change. Future unreviewed display changes still need review. If an underlying error is fixed, its baseline count can be reduced through the existing guarded workflow; the equivalence cannot resurrect a removed baseline allowance.

## Tests actually performed

All seven ratchet test groups passed, including the existing real-compiler and CLI cases. The 47-pair adversarial loop verifies each alternative is accepted but an altered message, new file, different error code, extra occurrence, or simultaneous old/new rendering fails. A same-total substitution using a duplicate equivalent and a changed property type also fail. Existing tests prove a real compiler error increase, removal of debt, line movement, missing generated preparation and attempted manual/committed baseline inflation.

The complete repository ratchet passes: **baseline 904, current 904, delta 0**. No `--update` or `--init` was used on the repository budget. CI also runs this change and the real-compiler tests; its result is recorded separately in the final readiness report.

CI run `34518427882` passed the guard tests, generated route types and baseline-integrity checks, then exhausted Node's default approximately 2 GiB heap during full-project analysis (exit 134). Separate commit `2e1fd318dda9408c76c0f32b1084ec32b291b7d8` sets `NODE_OPTIONS: --max-old-space-size=4096` only on that analysis step. This changes the compiler process's memory ceiling, not diagnostics, the baseline, or failure handling. The subsequent run's actual result is recorded in the readiness report.

Reproduction:

```powershell
node --test scripts/check-typescript-budget.test.mjs
node scripts/check-typescript-budget.mjs
```

For independent full-proof reproduction, keep the active schema fixed. Generate its client; run `node scripts/review-typescript-display.mjs snapshot AFTER.json`. Materialize the baseline schema from commit `a483ec202b66f588ec85cddcc34a745e92af269f` into an isolated local file and generate that client; capture `BEFORE.json`. Restore the approved client in a `finally` block. Run `compare BEFORE.json AFTER.json PROOF.json`, then capture `witnesses PROOF.json WITNESSES.json` under each generated client and compare those two files. These commands do not connect to a database. Use the existing generated Next route types and identical source checkout for both captures.
