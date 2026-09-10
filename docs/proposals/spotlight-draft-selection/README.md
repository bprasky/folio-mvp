# Canonical spotlight draft selection — review proposal

10 September 2026. Continues step 2 of the [foundation audit](../../SPOTLIGHT_FOUNDATION_AUDIT_2026-09-09.md) and [founder specification revision 1.1](../../Folio-Spotlight-and-Social-Publishing-Spec.md).

**Approval requested only for two new draft tables and inverse Prisma relations in six existing models. Nothing has been applied to the active schema or database.** Public approval/publication, social exports, vendor outreach and legacy Shop restoration are not part of this migration.

## Exact review artifacts

- `models.prisma`: the complete two new model blocks.
- `inverse-fields.txt`: all seven relation fields added to User, Organization, Project, Product, Room and ProductTag. These add no columns to existing tables.
- `schema.patch`: the complete minimal proposed diff against the pinned canonical schema, including the full User edit.
- `migration.sql`: the complete additive SQL proposal, intentionally outside `prisma/migrations`.
- `recon-summary.json`: non-personal structural facts and aggregate counts from the audited database. No answers, quotes, contact information, credentials or individual record IDs.

Baseline: main remains `8af4ce97dd6d85345c8e0a926a3c55ac82d4b306`; the foundation branch starts this step at `1e4597d4e49e936c769f786ad023fc5e3b12fd17`. A fresh fetch found no new main commit. Active Prisma schema remains unchanged throughout proposal work.

## Live findings that change implementation planning

Both the configured application connection and direct migration connection report PostgreSQL 17.4, schema public, and the same missing Shop/testimonial tables. The local environment files do not point these connections at different base-file database targets. This verifies the configured database; deployed Vercel environment identity was not separately inspected.

All IDs referenced by this proposal are TEXT, including users, organizations, projects, rooms, products and product_tags. Existing FKs confirm ProductTag → ProjectImage → Project, Room → Project, ProjectImage.roomId → Room, Project owner/designer → User and designerOrgId → Organization. There are no pre-existing spotlight tables in the inspected schema.

| Observed fact | Result and implication |
|---|---|
| Projects | 6; all 6 have designerOrgId and designerId. Personal identity path still needs deterministic tests. |
| Rooms / photos | 36 / 37; 8 photos lack roomId; no photo FK points to another project's room. |
| Photo tags | 59; 17 lack Selection links. Spotlight scheduling cannot depend on Selection. |
| Captured tag finishes | 0 nonblank finish_raw values; do not infer finishes from this absence. |
| Repeated confirmed-room/product/exact-finish tag groups | 0 currently; duplicate grouping must be tested with fixtures rather than claimed from production evidence. |
| Interview data | 81 projection rows; 6 posts have an answer payload path. No answer contents were returned. |
| shop_products / product_testimonials | Both tables absent, not empty. No similarly named public tables found. Counts are unavailable. |
| Migration bookkeeping | 108 records: 107 finished/non-rolled-back, one historical rolled-back attempt, zero unfinished/non-rolled-back. CLI reports all 107 repository migrations up to date. |

The Shop/table absence is outside the four migration-discipline count checks. Declared schema plus absent physical table plus absent matching applied Shop migration is not evidence of a working public surface. The old Shop DDL exists only as grandfathered loose SQL; do not execute it wholesale. A later public-surface milestone needs a separately reviewed table/projection design and environment-specific legacy audit. This draft migration deliberately has no dependency on those tables and performs no inferred Shop/spotlight backfill. Preserve any legacy public records in other verified environments when that rollout occurs.

## Two tables and their boundaries

**ProductSpotlight** is the canonical selected draft. It records publishing identity, project, product, optional confirmed room, distinguishing variant/finish, explicit selection, private steering note, selection actor/time and a revision counter for concurrency. It has no public flag, approved quote, testimonial, vendor requirement or invitation state. Therefore inserting a row can never establish public eligibility.

**ProductSpotlightTag** links one photo tag to at most one current spotlight. The tag ID is the primary key. Multiple tags may point to the same spotlight. Deleting a tag removes its link but retains the spotlight row; removing spotlight selection retains both underlying tags and source links. No Selection FK or optional design-board backfill participates in identity.

Publishing identity is exactly one of publisherUserId/publisherOrgId, enforced by a database XOR check. Server resolution uses Project.designerOrgId when present; otherwise Project.designerId, falling back to Project.ownerId. The acting user is selectedById and must not replace the publisher merely because an assistant or colleague performed tagging. Existing assertProjectWrite permits draft edits; publication later uses assertProjectPublish and its current active-org-role/participant-owner rules. Current project/publisher consistency must be resolved again on every request. Changing project ownership does not silently transfer old selections or public attribution.

The two SQL partial unique indexes cover publisher + project + product + confirmed room + variant + finish, regardless of selected state. A deselected confirmed spotlight is reused on reselection. No vendor ID/payment signal participates. No client-supplied publisher/scope list is authoritative.

Variant and finish are the designer-confirmed distinguishing identity, each up to 160 characters to keep composite index values bounded. Trim outside spaces only; preserve case and wording, do not fuzzy-merge finishes. Unknown values use empty strings and do not pretend to be confirmed. The tag's raw finish is proposed in the selection UI, not silently adopted as designer confirmation. Different known and unknown values remain separate until explicit reconciliation. A selected custom/vintage/unclaimed product works identically because Product is the attribution anchor, not a vendor account.

Unresolved room IDs stay NULL. They are excluded from the unique scope indexes because two unknown-room photo appearances must not be guessed to be the same room. Repeated selection of the same tag remains idempotent through the tag primary key. Once a designer confirms a room, merge into its existing canonical scope transactionally if needed, preserving every source link and private note for review. Never concatenate notes into public copy. Show unresolved drafts separately and do not schedule questions for them; resolve them before presenting the final additional-question count.

## Mutation and deletion contract

Draft selection runs in a serializable transaction with bounded conflict retry. Resolve project write permission, publishing identity, ProductTag → image → project and product association; validate any room belongs to that same project. Read current link and canonical scope, create/reuse the spotlight, attach the tag, and increment selectionVersion with a compare-and-swap check. A unique conflict restarts against the winning row; it is not swallowed as success without reading and validating that row. Never send a notification or create Shop/testimonial content in this transaction.

Database FKs enforce existence, not all cross-row project/product consistency. Server mutations and every eligibility resolver must enforce same-project room/tag/product scope using persisted state. Tests must deliberately attempt mismatched IDs. Prisma does not represent the custom partial unique indexes or CHECK constraints: retain them in hand-reviewed SQL and verify them in migration postflight; never use db push to recreate this contract.

Deselecting increments the version and sets isSelected=false; a repeated identical request returns the existing result. The selectedById/selectedAt fields identify the last explicit selection, not every edit actor. updatedAt/selectionVersion change for other edits. Do not describe this as a complete event audit; approval and invitation audit records come later.

Room deletion uses SET NULL, preserving each now-unresolved draft without uniqueness collision or guessed reassignment. This database FK action does not increment selectionVersion: eligibility/cache signatures must include the actual room and current source IDs, not rely on the counter alone. Tag deletion removes only the link; zero-source spotlights are ineligible. Product and publisher/selector deletion are RESTRICT while referenced, deliberately preventing silent loss/re-attribution; any future deletion UI must report and resolve these dependencies. Project deletion cascades spotlight drafts and their links as part of existing project deletion semantics. Verify these effects with deterministic database fixtures after approval and before exposing selection.

When a tag's product, confirmed room or distinguishing variant/finish changes after its spotlight has an answer, move it to the appropriate new/existing spotlight and retire the old active question if no longer eligible. Do not mutate the meaning behind an answered spotlight ID. Preserve historical answer snapshots. Before any question exists, unresolved placeholder merge may discard only an empty placeholder after moving its links and preserving its private notes for review. If either record already has history, retain both historical identities and request confirmed answer reuse; never delete an answered record to satisfy uniqueness.

Enable RLS on both new tables with no anon/authenticated policies. New data is private/server-mediated through the existing privileged Prisma connection. No browser may read privateNote directly. Service authorization remains mandatory because the privileged connection bypasses RLS. No storage bucket, role grant or access policy on an existing table changes.

## Durable answer and publication design — later implementation, not this migration

The active posting writer saves canonical answers in ProjectPost.provenance.interview.payload. `src/lib/editorial/syncInterviewAnswers.ts` deletes/rebuilds projection rows with fresh IDs. The older respond route also has a row writer, so its reachable save must be reconciled with canonical spotlight persistence. A FK from a spotlight to EditorialInterviewAnswer.id would be unstable and could lose approval provenance during an unrelated answer save.

For the next question milestone, persist a server-owned scheduled question record/snapshot with stable questionId, spotlightId, roomId, productId, sourceTagIds, linkedImageIds, kind and policy/prompt version. Base IDs remain stable for unchanged spotlight context. A changing selectionVersion changes eligibility/cache signatures, not historical question IDs. Deselection retires the active plan without deleting its history. Selection does not create model calls until explicit interview generation.

At spotlight answer acceptance, atomically preserve an append-only answer revision with its own durable ID/version, exact raw text, question snapshot, answering user, canonical source locator and content hash. The source locator is post ID + question ID + base/follow-up kind + answer version, not the transient projection row. A hash alone is not recoverable provenance: retain the exact accepted text. Retain stable private audio asset identity and transcript version/timings when available; never persist an expiring URL as identity. Different raw text always creates a new revision; retrying the same accepted request reuses its idempotency result. Legacy answer reuse requires user confirmation and captures the exact version then confirmed; no automatic upgrade of old text to approved testimony.

Later SpotlightRevision records approved public wording, exact verbatim span(s) and the answer revision(s) it derives from, with the actual approving identity/time. Draft revisions are separate from the current published revision; approval and publication cannot be inferred from nonempty strings or the selected flag. Publishing transitions the approved version transactionally; derived Shop/testimonial/article/Studio synchronization is idempotent, visible and retryable. WITHDRAWN is a reversible public removal state distinct from isSelected=false. Parent visibility is resolved live. These later state/version schemas receive their own exact review; they are not implemented as placeholder JSON or speculative nullable columns here.

The Shop/table restoration and public version model must be ready before the surface milestone. Missing Shop tables do not block private draft selection or question scheduling, but must not be hidden as successful synchronization. Vendor invitation and social publication/version state remain independent later schemas/services. No vendor-state field is needed in this draft schema.

## Validation performed and limits

- Read-only metadata transaction inspected 305 columns and 32 constraints, then aggregate facts above. Structural audit files remain local; only a sanitized summary is committed.
- Read-only verification through both configured connections reproduced the absent Shop/testimonial tables and clean migration bookkeeping. No schema/data mutations or model/media requests occurred.
- Canonical Prisma SHA-256 is recorded locally and checked unchanged. Proposed additions were injected into a separate schema file under tasks, formatted and validated with installed Prisma 6.18 tooling.
- Prisma schema-to-schema diff confirms only two new tables, their indexes and eight FKs; existing relation fields add no existing-table DDL. The hand-reviewed SQL adds XOR/positive-version/trim checks, two partial uniqueness indexes, IF NOT EXISTS guards and new-table RLS beyond that generated diff.
- The SQL has not been executed, even in a rollback transaction. No database migration smoke test or runtime acceptance is claimed. Formatting/validation does not prove transactional behavior, RLS or partial indexes; verify those after approval in an explicitly disposable database before live use.
- No full build or model evaluations for this proposal-only change. Existing migration-discipline CI checks, documentation links and whitespace checks pass. Static structure verification confirms 2 new tables, 8 FKs, 9 indexes, 4 CHECK constraints and 2 RLS enables, with no data mutation/backfill statements or DDL for existing tables. These checks do not substitute for executing the migration and transaction/RLS fixtures.

## Exact approval and apply sequence

Requested scope is a batch review of `models.prisma`, the six existing-model additions in `inverse-fields.txt`/`schema.patch`, and this one `migration.sql`. Approval must name this scope; it does not authorize Shop repair, later answer/publication models, data backfills, a production deploy or external messages.

After approval: fetch/sync/rebaseline; recheck live columns, table absence and migration status; save a checksum-backed canonical schema backup; install exactly the reviewed blocks and one timestamped migration folder; run format/validate/generate and migration guards; exercise the migration twice and its uniqueness/deletion/RLS invariants in an authorized disposable PostgreSQL database; apply through the repository's guarded migration workflow to the audited target; verify constraints/indexes/RLS/zero new rows and migrate status. Do not mark an unapplied migration resolved as applied. If a new target table already exists unexpectedly, stop to compare definitions before any CREATE IF NOT EXISTS rather than treating its name as proof of compatibility.

If format/validate/generate/migrate-status fails before application, restore the canonical schema backup and stop. If application fails inside BEGIN/COMMIT, verify rollback and migration bookkeeping before retrying; do not guess a resolve action. After successful apply, keep additive unused tables on an application rollback. Do not drop tables that may contain designer choices; any destructive rollback requires explicit review. Record applied state before considering a local schema restore—restoring a file does not undo a committed database migration.

Implement the draft-selection routes/UI only after the schema gate. Test same-tag retries, repeated confirmed-room tags, room separation, unresolved-room reconciliation, known/unknown finishes, spoofed identity/product/room IDs, concurrent selection/deselection, no Selection links, legacy preservation, source deletion and zero public/outreach side effects. The next question milestone adds guaranteed coverage and all alternate-path exclusions from the specification.
