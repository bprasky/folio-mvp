# Required room teasers

Every editorial room with story text now has a selected opening line and prepared choices when generation completes. A direct interview quote is selected when available; Folio editorial text supplies the default otherwise. Both pools are prepared during full generation and section regeneration, with two rooms processed concurrently. There is no Add/Generate/Remove action in the chooser.

When interview quotes are unavailable or the provider fails, the room's actual article wording supplies editorial excerpts. Article evidence is explicit and checked against the current paragraph; these excerpts are never represented as verbatim interview quotes. Editing their source paragraph triggers automatic repair. Legacy drafts prepare missing choices through one authenticated article-level request, with compare-and-swap persistence. Complete drafts do not regenerate on load.

Published room tiles and social exports retain the selected text and its authorship. Folio lines are labeled Written by Folio rather than enclosed in quotation marks or attributed to the designer. Legacy empty selections render an article-backed teaser while draft preparation catches up. Gallery-only chapters are excluded.

## Verification

- 30 source/generator/picker/room-renderer checks.
- 41 actual API-handler scenarios with isolated dependencies, including nonempty selection, article source changes, draft-only automatic preparation, ownership and concurrent edits.
- 11 serialized public-reader privacy scenarios.
- Generation helper and section-save tests cover both pools before persistence, no interview candidates, provider failure, bounded concurrency, existing choices, room-scoped product context and naming/source integrity.
- React draft-load test covers automatic preparation, stale excerpts, multiple rooms in one request and no duplicate request on rerender.
- Social tests execute the actual Sharp compositor and campaign authorization; the resulting slide was visually inspected for full text and correct Folio labeling.
- TypeScript decreases from 904 to 903 diagnostics, with no new fingerprints. Lint has no errors; client-import and migration guards pass.

Review findings around stale article evidence and naming transformations were corrected before delivery. No model/prompt change or live-model evaluation was needed for this follow-up: the existing tested writer/reviewer is now called automatically. This adds model work during article generation; deterministic fallback makes no model calls.

No production deployment, database migration or authenticated production test was performed in this change.
