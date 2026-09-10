# Durable spotlight questions and accepted answers — exact review packet

Status: proposal only, 10 September 2026. This is the schema/persistence approval gate requested by the founder. No active schema edit, new installed migration, application database query/write, model call, deployment, grant, backfill or feature activation was performed in preparing it.

## Baseline and scope

Repository: `bprasky/folio-mvp`; working branch at discovery: `codex/spotlight-spec-foundation`; exact HEAD `ac64f260e8a548bc5cfa5a3b9944278bc726c511`. Fetched main is `d5f3dcf10d4acf737ffd5f9dfc86e5e4e2bf55ff`, the merge of PR #766; no incoming main commits. HEAD adds the recorded application completion evidence. An existing user edit to `docs/reviews/SPOTLIGHT_APPLICATION_MIGRATION_COMPLETE.md` was preserved and excluded from this proposal.

Recorded baseline: `SPOTLIGHT_APPLICATION_MIGRATION_RESULTS.json` reports the draft-selection migration completed on Folio / MVP / main production, project `gwdkhgejsyvynqzolyau`, at 2026-09-10 19:48:43.800 UTC. Its checksum is `77fa2afe19f2f1e61d344f54d78381ca18d862b795e48edca9b3101c939291ab`. Postflight at 19:50:12.408 UTC verified 108 applied migrations, zero unresolved failures, two empty spotlight tables, and matching definitions. The established Prisma `postgres` server connection has access; Supabase `service_role` has no table grants. These are recorded results, not fresh database inspection in this proposal turn.

Founder specification revision 1.1 controls the private interview contract. Vercel `git.deploymentEnabled: false` remains in the checkout. Supabase production deployment was saved/reload-verified off in the recorded baseline; no dashboard setting was changed here. No public approval, publication, Shop, collaboration, vendor opportunity or social-media fields are proposed.

**Addition: two tables, two inverse fields, no new column on an existing table.** `SpotlightQuestion` owns an immutable question definition and a mutable lifecycle/current-answer head. `SpotlightAnswerRevision` owns each exact accepted answer and its idempotency receipt. General project/room questions retain their existing identities and persistence; this addition is for the dedicated spotlight lane.

## Identity, snapshots and deliberate reconciliation

A question ID is allocated once by the server (UUID); it is never an EditorialInterviewAnswer row ID. Its immutable `questionVersion` increases within `(spotlightId, kind)`, allocated under the spotlight/project lock. A meaning change creates a **new question ID/version** and retires the previous row. Unchanged meaning finds/reuses the same ID, including after deselection/reselection. The answer's composite FK pins the exact question ID/version. Each immutable question row is itself the versioned definition; a third question-version table is unnecessary.

`meaningKey` is SHA-256 of canonical JSON: meaning-format version, spotlight ID, frozen publishing identity, project ID, product ID, confirmed room ID, canonical normalized variant/finish, question kind, server-owned semantic intent/reconciliation number, and (for a follow-up) the exact parent accepted revision ID. Source-tag/image membership, vendor enrollment, display-name edits, private-note edits, selectionVersion, prompt wording variations and cache timestamps are **excluded**. Prompt/policy versions are stored separately. A policy deployment does not silently remint valid answered questions; unsafe old wording is retired as POLICY_CHANGED and needs deliberate reconciliation to a new semantic intent/version. Never trust a model-generated meaning key.

Check the full tuple against the snapshot when reusing a hash match. Wording is never mutated, even before answering: changed meaning needs a new definition. A scheduling race returns the committed winner's ID and wording. Retrying generation never replaces a committed question.

Relational information: spotlight FK (and through it project/publisher), question ID/version, answer ordinal, actor User FK, current-answer composite FK, follow-up parent accepted revision, optional reused durable revision. No FK points at the ephemeral answer projection. Historical Room, ProductTag, ProjectImage and Product references belong in snapshots; source deletion must not rewrite history.

Immutable JSON contracts, validated by strict server schemas with `snapshotVersion: 1`:

- `contextSnapshot`: projectId; publisher `{kind: PERSONAL|STUDIO, id}`; room `{id, name}`; product `{id, name}`; canonical variant/finish; sorted sourceTagIds and linkedImageIds used to ask; semantic intent/reconciliation number. Room is required at scheduling. Capture private-note steering only if used. No signed URLs, credentials, arbitrary client context or vendor-payment state.
- `acceptanceSnapshot`: current verified scope/publisher/source references; authenticated actor ID and effective authority/capability, membership reference if studio; input references such as retained private audio identity and exact text digest when voice is accepted. The immutable question FK supplies the question definition. Source arrays can differ from the question snapshot after source-only changes. UI live sources come from current authorized tags, not blindly dereferenced historical IDs.
- `reuseSnapshot`: only for confirmed reuse. Source kind (`DURABLE_REVISION` or `LEGACY_PROVENANCE`), project/publishing identity, source question ID, durable revision ID when available, exact source text/digest and confirmation intent. For legacy provenance the digest is its captured version; an ephemeral projection row is never called durable. Actor/time is recorded on the destination revision. An AI covered/morphed verdict is not confirmation.

SQL checks JSON object shape only. Full schemas, same-project consistency, snapshot/hash correspondence, actor authority and honest reuse provenance are server-enforced. Snapshot IDs are historical references, not current access grants.

Accepted text is the exact valid Unicode string received: no trimming, rewriting, punctuation repair, summary replacement or re-transcription. Validate nonblank/size separately (proposed maximum 50,000 Unicode characters); reject NUL; preserve leading/trailing whitespace and line endings. Voice transcription becomes accepted only after explicit designer acceptance. Keep rejected unsaved text for recovery. Audio timings may be captured only when bound to that exact text/audio version; this introduces no new recording system.

## Constraints and deletion contract

SQL adds 31 columns in two tables, six FKs, eleven CHECKs, five ordinary unique secondary indexes, one partial unique secondary index, three nonunique indexes, two PK indexes, two trigger functions and five triggers. No enum type is added.

| Invariant | Enforcement |
|---|---|
| Existing spotlight/actor; exact question version; current pointer belongs to same question | Six FKs, including composite question-version and current-answer references |
| Unique definition per meaning and unique version per spotlight/kind | Unique indexes; server allocates/reuses under locks |
| At most one unretired BASE and one unretired FOLLOW_UP per spotlight | Partial unique `(spotlight_id, kind) WHERE retired_at IS NULL` |
| Every eligible spotlight has a required base; follow-up belongs to its own current base answer | Service coverage/parent checks; uniqueness does not ensure existence or correct parent scope |
| Revisions cannot be overwritten/deleted/truncated; question definition cannot be rewritten | Triggers reject revision UPDATE/DELETE/TRUNCATE and question DELETE/TRUNCATE/immutable-field changes |
| Lifecycle concurrency and monotonic current head | Trigger requires stateVersion +1 and head unchanged or next ordinal; service CAS rejects stale clients |
| Request replay/conflict | Unique `(questionId, answeringUserId, requestKey)`; service compares canonical payload hash and returns original receipt |
| Revision, current pointer and provenance atomic; no orphan accepted revision | Service transaction. Constraints alone can permit an unused revision insert; only acceptance service writes |
| Cross-project/source/room consistency, selected state, publisher and studio role | Server resolver/locks. Existing publisher XOR remains, not an authorization rule |
| Browser access | RLS enabled, no policies/grants. Verify real defaults/roles after apply; existing Prisma path only |

**Deletion restrictions are part of approval.** Once a question exists, its ProductSpotlight cannot be deleted, so existing Project → ProductSpotlight cascade now blocks deletion of that project. Questions, including unanswered/retired definitions, cannot be hard-deleted through ordinary application SQL. Answering users are restricted while referenced; existing publisher/product/selector restrictions continue. Retire/archive instead. A later explicit erasure request requires its own reviewed retention/purge design; this migration adds no bypass. Deletion endpoints must surface this restriction before exposure.

Deleting one photo tag still removes only its ProductSpotlightTag link. Other sources and accepted revisions survive. Deleting the last source preserves the selected draft/history but makes it ineligible; retire active questions as NO_VALID_SOURCE. Room deletion still nulls ProductSpotlight.roomId through its existing FK; historical snapshots keep the old room identity/name. Live requests must reject that mismatch even before reconciliation runs. Product/room renames do not rewrite snapshots. Product/room/variant/finish/publisher changes with history require explicit reconciliation, preferably a new canonical spotlight for a new scope. If the same spotlight is reconciled, retire old definitions and increment semantic reconciliation number.

Triggers protect ordinary DML, including the owner connection. They are not tamper-proof against administrators who disable triggers/drop tables. No new privilege model or service_role grant is introduced.

## Transactional service contract (proposed, not implemented)

Use one server resolver and services under `src/lib/spotlight/` for eligibility, selection, scheduling, acceptance and reconciliation. Request bodies never establish publisher, membership, source validity or selection. Require current project write access plus acting-publisher authority: the personal publisher is the authenticated current designer (owner only when there is no designer); a studio publisher must equal the project's current designerOrgId and the actor must have active membership with `create_and_edit_projects`. A vendor relationship, generic project access, or global-admin status alone does not authorize answering as another publisher. Store the verified authority basis in the acceptance snapshot.

The lock protocol is Project `FOR UPDATE`, relevant user/organization/membership/participant authority rows `FOR SHARE` in deterministic order, affected spotlights `FOR UPDATE` sorted by ID, affected questions sorted by ID, then ProjectPost. Re-read authority and eligibility after locks. Membership/publisher mutations must participate in this protocol; membership updates conflict with the held row lock. All enrolled-project provenance writers use the project mutex. Retry deadlock/serialization failures at most three times with jitter and the original expected versions. Do not call a model inside a transaction. Audit existing authority writers before adopting the protocol: the lock order is a required implementation contract, not an assertion about current code.

| Operation | Atomic behavior and result |
|---|---|
| Explicit selection | Resolve same-project product, confirmed room and valid tag sources, publishing identity and canonical variant/finish scope. Reuse the existing canonical spotlight under its partial unique key; link additional sources. Create selected rows only for an explicit true request, despite the existing database default. Increment selectionVersion for an actual selection/scope transition and reject stale expected versions. Tagging alone does not select. |
| Source-only change | Add/remove source links without changing semantic identity or selectionVersion. Recheck live validity on every request and snapshot current sources at acceptance. With another valid source, preserve question IDs and answers. With no valid source, preserve the selected draft/history but retire active questions as NO_VALID_SOURCE. Restoring valid sources with unchanged meaning reactivates the same definition and advances stateVersion. |
| Shared deselection | Increment selectionVersion; retire active base/follow-up questions and increment each stateVersion; preserve all heads and revisions. Refresh the private eligibility mirror in the same transaction. Reselection of unchanged meaning reactivates the same IDs and answers, subject to current follow-up parent eligibility. |
| Scheduling | Enumerate every selected, authorized, confirmed, valid-source scope. Reuse a matching meaningKey; never regenerate an existing definition merely because caches or wording preferences changed. Generate candidates outside the transaction; reacquire locks, revalidate meaning and parent, then allocate the next questionVersion and insert the winning immutable definition. The uniqueness constraints resolve duplicate schedulers. Missing generation remains visible work until a valid definition commits. |
| Fresh answer acceptance | Require questionId, questionVersion, expected stateVersion, expected current revision number (explicit null if none), expected selectionVersion, request key and exact text. Under locks: authorize, check replay, resolve live eligibility and unchanged meaning, compare all expected versions, insert revision N+1, advance current pointer/stateVersion with CAS, update private provenance and rebuild projection in one transaction. Return the committed receipt only after commit. |
| Re-answer | A new explicitly submitted request key appends a revision even when text is identical. Never edit the prior revision. Retire any follow-up anchored to the previous base revision. Schedule at most one active follow-up for the new accepted base revision; generation cannot erase the previous follow-up/history. |
| Concurrent saves | Different questions serialize at Project, read fresh provenance, and both survive. Same-question stale edits return 409 with current revision metadata; keep the unsaved text locally for explicit recovery. No silent last-write-wins replacement. |
| Save versus deselection | If deselection commits first, a fresh stale save fails eligibility/version checks without consuming its request key. If save commits first, later deselection retains its accepted revision. A replay of an already accepted request is handled before stale/selected checks, after current authorization. |
| Follow-up generation race | Bind candidate to base question ID/version, accepted parent revision, selectionVersion and policy. Revalidate all at commit. Deselection or re-answer winning first discards the candidate; generation winning first leaves a definition that deselection can retire. Voluntary mentions create no eligibility. |
| Room/source reassignment | Lock the project and both affected scopes; require same-project room/tag/image/product associations. Another valid old source preserves the old answer. A genuinely different scope requires deliberate reconciliation, retirement and a new meaning/version; never silently move an answer. Room deletion's existing SET NULL makes the scope immediately ineligible even if asynchronous reconciliation has not yet retired its question. |
| Publisher/role change | Recheck current identity and active capability under authority locks. Revocation winning first rejects a new save; a save winning first retains its historical authority snapshot. A publisher transfer does not relabel an old answer. Explicit reconciliation creates a new scope; reuse requires the new scope's permitted confirmation rules. |

All source/scope mutations and reconciliation must refresh the private eligibility mirror or invalidate its read cache transactionally. Eligibility is still resolved from current relations on reads; the mirror is not authorization. The service must enforce same-project scope, monotonic version allocation, meaningful snapshots, active parent belonging to the same spotlight's current base answer, complete required coverage and insert-plus-head atomicity. The SQL alone cannot prove these. In particular, direct SQL can insert a revision without advancing the head; only the acceptance transaction is a supported writer.

### Idempotency and recovery

The unique namespace is `(questionId, answeringUserId, requestKey)`. Clients generate a UUID request key (maximum 128 characters), retain it with the exact submitted payload until acknowledgement, and retry that payload unchanged. SHA-256 hashes a versioned canonical JSON serialization containing exact text, question ID/version, expected head/state/selection versions, modality, explicit reuse source/digest and any submitted audio reference. Represent absent values explicitly; do not trim, normalize Unicode, or hash a server-generated timestamp/ID or transient live source list. Store source/authority snapshots separately at acceptance.

After current authorization, look up the namespace before eligibility/CAS checks. Equal request hash returns the original immutable receipt: questionId, questionVersion, revisionId, revisionNumber, acceptedText, acceptedAt, acceptedStateVersion and acceptedSelectionVersion. Report any current head separately; do not substitute it into the replay receipt. Different content under the same key returns 409 IDEMPOTENCY_CONFLICT. The unique index arbitrates competing inserts; an aborted transaction consumes no key. Do not log raw answers or request keys. Local drafts are scoped to actor/project/question, retained on network failure or 409, and cleared on explicit discard, confirmed acceptance or sign-out; resume must offer recovery rather than overwrite the newer server revision.

### Explicit confirmed reuse

Initial scope is reuse within the same project and publishing identity only. A source may be an authorized durable revision or an existing legacy provenance answer, identified by its stable source question key plus an exact-text digest. Never use a reminted EditorialInterviewAnswer ID as the source identity. Show exact source text and source/destination context, then require explicit confirmation with a token bound to those identities, destination version and source digest. Re-read the source and permissions under the project lock. Changed legacy text or destination scope returns a conflict requiring a new preview/confirmation.

Confirmation appends a new destination revision with the exact copied text, confirming actor/time, acceptanceMode CONFIRMED_REUSE and an immutable reuseSnapshot. Use reusedFromRevisionId only for an actual durable source; legacy source identity/digest is captured in the snapshot. Ordinary AUTHORED revisions have neither reuse field. AI coverage or similarity may suggest a preview but never creates an accepted revision or a current pointer. Cross-project/cross-publisher reuse is rejected in this milestone. This is a concrete proposed limit for approval, not an unspecified future decision.

## Resolve provenance and projection explicitly

These are the targeted existing writers inspected for this proposal:

| Existing path | Current behavior that the implementation must address |
|---|---|
| `src/app/api/posting/project/[projectId]/interview/route.ts` | Trims/normalizes answers, reads and replaces provenance, then projects separately. Durable acceptance bypasses trimming and delegates to the atomic service. Legacy normal questions retain their contract. |
| `src/lib/editorial/syncInterviewAnswers.ts::rebuildAnswerProjection` | Deletes and recreates EditorialInterviewAnswer rows with random IDs. Accept a transaction client; read and rebuild within the acceptance transaction from fresh authoritative state. Durable IDs must not be projection-row IDs. |
| `src/lib/interview/saveInterviewAnswer.ts` | Updates existing projection answers, including a unique-conflict winner. It cannot be the durable acceptance writer. |
| `src/lib/editorial/syncEditorialAnswersToProvenance.ts` | Reverse-synchronizes whole answer/follow-up arrays from projections. Exclude durable question IDs and restore their private mirror from authoritative revisions; never infer a new revision from a projection. |
| `src/app/api/interview/realtime/convert/route.ts` | Replaces projection rows and writes provenance separately. Delegate explicitly confirmed spotlight acceptance; unassigned extracted transcript is private draft material, not an accepted answer. |
| `src/lib/editorial/getInterviewQuestions.ts` | Applies optional question caps and writes questionSet/factDigest in provenance. Required spotlight scheduling is a separate uncapped lane; these writers must preserve the private subtree under the same project mutex. |
| `src/lib/posting/loadInterviewAnswers.ts` | Merges projection/provenance and uses text/context deduplication. Private durable resume reads by question and revision identity; public consumers exclude draft spotlight questions until a separately approved publication path exists. |

Durable revisions plus the question current pointer are authoritative for spotlight answers. Existing provenance remains authoritative for ordinary legacy answers; EditorialInterviewAnswer remains a derived projection. Use a private `ProjectPost.provenanceJson.interview.spotlightDrafts` subtree with `schemaVersion: 1`, `answersByQuestion` and `eligibilityByQuestion`. Each current answer mirror contains questionId/version, revisionId/number, exact answer, immutable prompt, roomId, linkedProductId, sourceTagIds, linkedImageIds, answeringUserId and acceptedAt. Retirement updates eligibility without erasing the answer mirror. Full historical versions remain in the durable tables. Do not put raw spotlight answers in legacy public editorial arrays.

Introduce one transaction-aware `mutateProjectInterview(tx, projectId, mutation)` for enrolled projects: acquire the project mutex before reading ProjectPost; apply keyed mutations to fresh JSON, preserving all unrelated fields, ordinary answers/followups/audio and publication metadata. Create a missing DRAFT ProjectPost only when private persistence needs it, under that lock. Tagging does not create a post; existing post status, slug and publishedAt never change as an answer side effect.

Rebuild the projection within that same transaction from fresh ordinary provenance and durable current heads. Keep durable question IDs in questionId, classify base/follow-up through questionSource, and join current eligibility for the private interview. Projection IDs may be reminted; no durable FK or reuse source points to them. Projection failure rolls back revision, head and provenance together. Rebuild and reverse sync must never insert durable revisions. Legacy whole-array input for an enrolled project must become a normal-question delta with expected version; durable IDs delegate to the new service or return UPGRADE_REQUIRED. Omission is never a durable delete.

Before implementation is complete, enumerate all ProjectPost provenance writers, including questionSet/factDigest, transcription, room cleanup, prompted content and background/realtime paths. Every enrolled-project full-root writer must use the mutex/fresh-read helper; a separately proven atomic narrow JSON-path update may touch only a disjoint subtree. Add a caller guard and mixed legacy/durable concurrency tests. The targeted table above is not a claim that all writers have already been converted or exhaustively audited.

Public serializers must strip spotlightDrafts; public/editorial loaders that consume EditorialInterviewAnswer must exclude durable question IDs using the authoritative question relation, not merely a caller-supplied source label. Private interview adapters can return the existing UI answer shape joined from durable records. Verify actual public responses and consumer queries before enabling the private cohort. This privacy boundary is required integration, not a public publication model or approval schema.

## Implementation sequence for the complete private milestone

1. **Schema A/B after explicit approval.** Back up the canonical schema, install only the two models/two inverse fields and this SQL in one timestamped migration directory, format/validate/generate, compare the exact hash and run migration guards. Restore the schema backup and stop if those checks fail. Build the isolated PostgreSQL suite below, including repository migration-command/target-binding tests distinct from direct SQL. No application migration is implied by A/B approval.
2. **Server gate and canonical services.** Introduce a server-only default-off `SPOTLIGHT_INTERVIEW_V1` control plus server-managed project AND actor allowlists. All new endpoints require both; client flags/body values cannot enroll a project. Within an enrolled project, every reachable question/answer path uses the same server eligibility resolver, including older clients. Non-enrolled projects retain unrelated existing interview behavior. Kill-switch off stops new-flow writes and generation, retains records and permits only a separately authorized operator recovery path; no automatic data deletion or fallback into an unrestricted legacy product path. Ship no ordinary-user entry point before the entire milestone passes.
3. **Real tagging integration.** Connect `AdvancedTagProducts.tsx`, `src/app/api/tag-product-to-image/route.ts`, editing/deletion and reachable import/pending-tag/auto-tag adapters identified by the existing entry-point audit. The control says “Spotlight this piece,” starts off, and explains the private interview benefit. No legacy Selection backfill is required. Shared controls reflect the canonical ID and selectionVersion. Copy: “This selection is shared by these photos. Turning it off removes this piece from the interview for all of them.” Show the associated photo count and refresh all controls after save. Deleting one tag removes only that source; if others remain valid the spotlight stays selected. The new control must not enter existing Shop, quote, boost or testimonial side-effect branches.
4. **Schedule through canonical prompt policy.** Reuse `src/lib/interview/prompts/index.ts`, persona, SHARED_RULE_BLOCK, INTERVIEW_RULES and existing validation; extend shared scope validation outside the model. Adapt `generateAllRoomQuestions.ts`, room/project generators, `getInterviewQuestions.ts` and `questionsCache.ts`. Required base questions are scheduled for every eligible spotlight outside optional room/project caps; pagination and a proposed generation concurrency of five limit work, never coverage. Vendor membership is irrelevant. Use an initial attempt plus two retries, then a vetted neutral selected-piece fallback; invalid/unresolved scope remains visible remaining work. Persist wording once. Project/room questions remain available, with spatial/process fallbacks when a candidate would target an unselected object.
5. **Atomic acceptance, explicit reuse and resume.** Connect actual forms/hooks/API handlers to durable scheduling and the acceptance transaction, exact text receipts, private provenance adapters and projection rebuilds. Complete source/room/publisher reconciliation and retirement, then reload/restart resume and unsaved-draft recovery. Realtime transcripts require explicit mapped acceptance; no automatic conversion of model extraction into an accepted spotlight answer. Resolve deletion endpoint behavior before exposure.
6. **Close all alternate question paths.** Follow-ups, covered/morphed questions, caches, legacy handlers, background and realtime conversion must resolve eligible durable IDs on the server. Cache signatures include policy, eligible meaning IDs, selection versions, parent revision and source-generation signature. A source change may invalidate generated context without changing question identity. Selected-ID validation alone is insufficient: reject text targeting an unselected product through material, position or other descriptors. A voluntary unselected-product mention authorizes no product follow-up. Do not add a second persona. Complete provenance-writer and public-reader caller audits and guards.
7. **Prove the milestone before exposure.** Run separate SQL, real service/API, browser and semantic/model gates below against synthetic fixtures. Review results and implementation diff. Application migration, merge, deployment, restoration of either deployment hold and cohort exposure remain separately authorized steps; no “A/B passed” result implicitly authorizes them.

## Required acceptance evidence after implementation authorization

All tests in this section are **planned and unrun in this proposal**. An isolated schema validation is not an end-to-end feature result. Test PostgreSQL version must match the supported application version; the connection guard must reject application endpoints, project refs and any non-disposable target before writes. Create only synthetic prerequisite data. No production copies or paid infrastructure.

| Layer | Required execution and pass evidence |
|---|---|
| Disposable SQL/catalog | Install synthetic prerequisites and the reviewed existing draft-selection migration, then this exact SQL. Apply and replay on empty and populated fixtures; compare 31 columns, 6 FKs, 11 CHECKs, 5 ordinary unique secondary indexes, 1 partial unique, 3 nonunique indexes, 2 PK indexes, 2 functions and 5 triggers. Inspect actual function bodies, trigger events/enabled state, RLS on both tables and absence of policies/grants. Replay must preserve IDs, text, heads and row counts. |
| SQL invariants | Reject invalid kinds/versions, blank text, invalid snapshot shapes, malformed hashes, null retirement reason with retirement time, mismatched question version, duplicate active kind/meaning/version/revision/request namespace, cross-question head, null/backward/skipped head movement, and invalid reuse mode/self-reference. Prove immutable definition/revision UPDATE, DELETE and TRUNCATE fail while authorized state transitions and a privileged-server transaction work. Do not claim JSON shape checks prove semantic scope. |
| SQL deletion/rollback | Test source/tag, room, project, product, publisher, selector and answering-user deletion with unanswered, answered and retired histories. Verify RESTRICT and inherited SET NULL/CASCADE behavior exactly. Inject failure after revision insertion and before head/projection completion; verify no partial revision/head/provenance and no consumed request key. Test transaction rollback and migration transaction failure/replay. |
| Repository command/target binding | In verified disposable infrastructure, execute the repository-approved migrate deployment wrapper and status/guard with the same inherited environment; prove conflicting or mismatched application/direct targets fail closed. Check the pending list, checksum/history and postflight. Keep these results separate from direct SQL execution; synthetic prerequisite bookkeeping must never be reused on the application database. |
| Real service/API eligibility | Ten tagged products and two selected confirmed spotlights yield exactly two base product questions. Zero selected yields normal room/project questions and no product questions. Exercise repeated tags, distinct rooms, missing Selection rows, unresolved rooms, vendor/nonvendor equality and selections above optional budgets. Missing/invalid room requires visible resolution, never an inferred answer scope. |
| Real persistence/resume | Save text containing leading/trailing spaces, newlines, punctuation and Unicode; restart the server and reload the browser; compare exact text and stable question/revision IDs. Re-answer produces N+1 with the old version unchanged. Rebuild projections and prove only projection IDs may change. Legacy normal answers and private durable answers survive together. |
| Concurrency | Use two real database connections and explicit barriers, not only mocked promises: different-question saves both survive; mixed normal/durable writers preserve each other; same-question stale CAS returns 409; simultaneous schedulers create one definition. Test save/deselect in both orders, source reconciliation, room deletion, follow-up/base re-answer and membership revocation races. Verify the UI retains unsaved text when a fresh save loses. |
| Idempotency/reuse | Lose the response after commit and retry; return the original receipt without another revision. Replay after deselection and after a later re-answer still returns that receipt if currently authorized. Same key/different payload conflicts. Confirmed reuse requires a preview and explicit confirmation, rejects stale source text/scope and unauthorized source, copies exact text to a new revision, and never accepts AI “covered” status as confirmation. |
| Shared UI and authorization | Real API calls reject cross-project room/tag/image/product IDs, wrong personal/studio identity, inactive or VIEWER studio membership, vendor-only access and spoofed client rollout flags. Multiple photo controls share state; off deselects all; deleting one source does not deselect remaining valid sources. Last-source deletion retains historical answer and shows ineligibility. |
| Browser walkthrough | Run actual Next.js routes, authenticated synthetic actors and disposable persistence. Perform tagging → explicit shared selection → scheduled interview → answer → reload → re-answer → resume → deselect/reselect, including offline/stale recovery and reuse confirmation. Mock only external model calls where deterministic coverage needs them; do not substitute mocked UI state for persistence. |
| Privacy/side effects | Verify default-off/nonallowlisted requests are denied on every new/legacy alternate entry point. Inspect actual public response payloads and underlying consumer queries: no private subtree or durable draft answer leaks. Assert no Shop/testimonial activation, quote/boost path, public media row, publication-state change, vendor message or new role grant. Test with database state assertions and outbound-call spies, not just the absence of a visible UI control. |
| Semantic policy | Curated fixtures cover unselected names, material/position descriptors, selected IDs paired with wrong-target wording, morphed/covered questions, caches, realtime extraction and voluntary unselected mentions. Normal room/project questions remain useful. Deterministic SDK fixtures prove validation/fallback/retry limits; a separate authorized live-model evaluation uses synthetic contexts and a fixed budget, recording model/policy versions and accepted violations. Zero accepted violations on that suite is the exposure gate, not a universal semantic guarantee. |

Real application role checks must later use the actual role/default-grant state, not assume disposable roles are equivalent. Existing recorded application access is through Prisma's authorized server connection; service_role lacks grants and receives none here.

## Rollout, rollback and exact approval gate

The proposed SQL is transaction-wrapped and replayable for matching definitions; `IF NOT EXISTS` is not a drift-repair mechanism. Preflight must refuse unexpected objects, failed/divergent history, unexpected pending migrations or a changed reviewed hash. No backfill, new enum, existing-table column change, Shop repair, public approval/publication model, collaboration or social export is included. Start both new tables empty.

Rollback before application execution means discard the proposal/install branch or restore the saved canonical schema. A failed transactional SQL application requires preserving redacted logs and migration history, then investigation; never mark unapplied SQL applied, erase failed bookkeeping or disable history triggers. After successful execution or any accepted data, turn the new flow off and retain durable records. Prefer a separately reviewed forward repair. Dropping even empty tables requires a new explicit rollback review; populated history must not be removed by this runbook. Both existing deployment holds remain intact throughout.

**Approval requested only after review of the full artifacts below:** A authorizes installing exactly the two Prisma models, the two inverse fields and the proposed SQL (two tables, indexes/constraints, two functions/five triggers, RLS, no grants), with backup and static/generator/guard validation. B authorizes execution and adversarial tests in a safely isolated disposable database, including migration-command target binding. Neither authorizes applying to Folio's application database, merging, deploying, changing deployment controls, backfilling or exposing a cohort. Implementation of the specified services/UI and complete acceptance suite is the next separately scoped work item; it has not begun in this proposal. A future application migration needs a fresh recovery point, authoritative target binding, pending-list review, approved exact hash and postflight.

The concrete design decisions submitted with A/B are: (1) hard project/spotlight deletion is blocked as soon as a scheduled question exists, including unanswered/retired questions; (2) initial confirmed reuse stays within one project and publisher; (3) changed meaning creates a new immutable definition/version while source-only changes preserve identity; (4) current draft mirrors use a private provenance subtree excluded from public readers. If any of these choices is rejected, revise the exact artifacts before installation. No additional founder decision is needed to finish this review packet.

The repository's `AGENTS.md` requires “Per-migration and per-model-block approval gates.” This packet is the concrete review stage. The current request explicitly directs stopping here: no active schema/migration installation or database execution has occurred.

## Static validation actually performed

Prisma format and validate passed against `tasks/spotlight-durable-proposed.prisma`, an isolated copy. A database-free `prisma migrate diff --from-schema-datamodel ... --to-schema-datamodel ... --script` succeeded. Static comparison matched all 31 column type/nullability/default tuples, eight Prisma indexes and six FK source/target/action tuples against the handwritten SQL. CHECK expressions, partial uniqueness, trigger behavior and RLS require actual PostgreSQL execution after approval; counts and manual inspection are not execution evidence. The repository guard checks the active repository, so its pass does not execute or prove the proposed migration. UUID defaults are Prisma client defaults; direct SQL fixtures must supply IDs.

```json
{
  "status": "Static proposal validation only; no SQL/runtime execution",
  "baselineHead": "ac64f260e8a548bc5cfa5a3b9944278bc726c511",
  "fetchedMain": "d5f3dcf10d4acf737ffd5f9dfc86e5e4e2bf55ff",
  "prismaVersion": "6.18.0",
  "checks": {
    "isolatedPrismaFormat": "PASS",
    "isolatedPrismaValidate": "PASS",
    "databaseFreePrismaMigrateDiff": "PASS",
    "generatedDdlComparison": "PASS: 31 column type/nullability/default tuples, eight Prisma secondary indexes, six FK source/target/action tuples match",
    "sqlOnlyStaticCounts": "PASS: 11 CHECKs, one extra partial unique index, two functions, five triggers, RLS on two tables; no grant/policy/backfill statement",
    "patchApplyCheck": "PASS",
    "migrationDiscipline": "[phase5e-check] OK — all counts at or below baseline.\n  looseSql=32/32 phantomCalls=0/0 missingSql=0/0 nonIdempotent=0/0",
    "gitDiffCheck": "PASS",
    "activeSchemaUnchanged": "PASS: exact normalized-LF equality with session baseline",
    "existingMigrationHash": "PASS",
    "vercelDeploymentHold": "PASS: git.deploymentEnabled remains false"
  },
  "notExecuted": [
    "SQL parse/application/replay/catalog against PostgreSQL",
    "SQL deletion/concurrency/rollback/RLS runtime tests",
    "Migration command/target-binding runtime suite",
    "Prisma generate for this proposal",
    "TypeScript/build/service/API/browser tests",
    "Live model evaluation",
    "Application database queries or migration",
    "Fresh Supabase deployment-control inspection"
  ],
  "activeSchemaSha256LF": "9e024086632362f69b8922bd9a6d71742a6f5a76d3a0115de37e9752ee8a6e54",
  "installedDraftSelectionMigrationSha256LF": "77fa2afe19f2f1e61d344f54d78381ca18d862b795e48edca9b3101c939291ab",
  "proposedArtifactSha256LF": {
    "models.prisma": "2559d6f6f77ccf819912ee9c372fbde79a508fe2bd5e8702f778fa20066b1cad",
    "inverse-fields.txt": "8c38f1cf724c6644d2c26f3c2aba23a18884eef74a2ba906f7d6da4f4d91d84d",
    "schema.patch": "b4adb1c49440f67777d9298975be3310805189608d2f300760adb130beb6f8b9",
    "migration.sql": "50adeaf12a7b402181769746caed685ba3c0a5b58821528f83cffa397e5e2c10"
  }
}
```

## Complete proposed artifacts

These are complete contents, normalized to LF with no BOM. The patch includes only two inverse additions, their Prisma alignment formatting, and the two new model blocks. No active schema was edited. SQL-only constraints/triggers must be retained when future Prisma migrations are authored.

### models.prisma

```prisma
model SpotlightQuestion {
  id                     String    @id @default(uuid())
  spotlightId            String    @map("spotlight_id")
  kind                   String    @db.VarChar(16)
  questionVersion        Int       @map("question_version")
  meaningKey             String    @map("meaning_key") @db.VarChar(64)
  contextSnapshot        Json      @map("context_snapshot")
  wording                String    @db.Text
  promptVersion          String    @map("prompt_version") @db.VarChar(80)
  policyVersion          String    @map("policy_version") @db.VarChar(80)
  parentAnswerRevisionId String?   @map("parent_answer_revision_id")
  retiredAt              DateTime? @map("retired_at") @db.Timestamp(3)
  retiredReason          String?   @map("retired_reason") @db.VarChar(32)
  stateVersion           Int       @default(0) @map("state_version")
  currentAnswerNumber    Int?      @map("current_answer_number")
  createdAt              DateTime  @default(now()) @map("created_at") @db.Timestamp(3)

  spotlight     ProductSpotlight          @relation(fields: [spotlightId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  answers       SpotlightAnswerRevision[] @relation("SpotlightQuestionAnswers")
  currentAnswer SpotlightAnswerRevision?  @relation("SpotlightCurrentAnswer", fields: [id, currentAnswerNumber], references: [questionId, revisionNumber], onDelete: Restrict, onUpdate: Restrict, map: "spotlight_questions_current_answer_fk")
  parentAnswer  SpotlightAnswerRevision?  @relation("SpotlightFollowupParent", fields: [parentAnswerRevisionId], references: [id], onDelete: Restrict, onUpdate: Restrict)

  @@unique([id, questionVersion], map: "spotlight_questions_id_version_key")
  @@unique([spotlightId, kind, questionVersion], map: "spotlight_questions_version_key")
  @@unique([spotlightId, kind, meaningKey], map: "spotlight_questions_meaning_key")
  @@index([parentAnswerRevisionId], map: "spotlight_questions_parent_idx")
  @@map("spotlight_questions")
}

model SpotlightAnswerRevision {
  id                       String   @id @default(uuid())
  questionId               String   @map("question_id")
  questionVersion          Int      @map("question_version")
  revisionNumber           Int      @map("revision_number")
  answeringUserId          String   @map("answering_user_id")
  acceptedText             String   @map("accepted_text") @db.Text
  acceptanceSnapshot       Json     @map("acceptance_snapshot")
  inputModality            String   @map("input_modality") @db.VarChar(16)
  acceptanceMode           String   @map("acceptance_mode") @db.VarChar(24)
  reusedFromRevisionId     String?  @map("reused_from_revision_id")
  reuseSnapshot            Json?    @map("reuse_snapshot")
  requestKey               String   @map("request_key") @db.VarChar(128)
  requestHash              String   @map("request_hash") @db.VarChar(64)
  acceptedStateVersion     Int      @map("accepted_state_version")
  acceptedSelectionVersion Int      @map("accepted_selection_version")
  acceptedAt               DateTime @default(now()) @map("accepted_at") @db.Timestamp(3)

  question          SpotlightQuestion         @relation("SpotlightQuestionAnswers", fields: [questionId, questionVersion], references: [id, questionVersion], onDelete: Restrict, onUpdate: Restrict, map: "spotlight_answers_question_version_fk")
  answeringUser     User                      @relation("SpotlightAnsweringUser", fields: [answeringUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  currentFor        SpotlightQuestion[]       @relation("SpotlightCurrentAnswer")
  followupQuestions SpotlightQuestion[]       @relation("SpotlightFollowupParent")
  reusedFrom        SpotlightAnswerRevision?  @relation("SpotlightAnswerReuse", fields: [reusedFromRevisionId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  reusedBy          SpotlightAnswerRevision[] @relation("SpotlightAnswerReuse")

  @@unique([questionId, revisionNumber], map: "spotlight_answers_number_key")
  @@unique([questionId, answeringUserId, requestKey], map: "spotlight_answers_request_key")
  @@index([answeringUserId], map: "spotlight_answers_actor_idx")
  @@index([reusedFromRevisionId], map: "spotlight_answers_reuse_idx")
  @@map("spotlight_answer_revisions")
}
```

### inverse-fields.txt

```text
User:
  spotlightAnswerRevisions SpotlightAnswerRevision[] @relation("SpotlightAnsweringUser")

ProductSpotlight:
  questions SpotlightQuestion[]

No other existing model changes. No new columns on existing tables.
```

### schema.patch

```diff
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index 7a5df0b6..a8fe86fe 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -10,9 +10,10 @@ datasource db {
 }

 model User {
+  spotlightAnswerRevisions SpotlightAnswerRevision[] @relation("SpotlightAnsweringUser")
   // Product spotlight draft selection
-  spotlightsAsPublisher ProductSpotlight[] @relation("SpotlightPublisher")
-  selectedSpotlights    ProductSpotlight[] @relation("SpotlightSelector")
+  spotlightsAsPublisher    ProductSpotlight[]        @relation("SpotlightPublisher")
+  selectedSpotlights       ProductSpotlight[]        @relation("SpotlightSelector")

   id                             String                    @id @default(uuid())
   email                          String                    @unique
@@ -7966,21 +7967,22 @@ model LicenseGrant {

 // SQL-only checks and confirmed-room uniqueness are in migration.sql.
 model ProductSpotlight {
-  id               String   @id @default(uuid())
-  projectId        String   @map("project_id")
-  productId        String   @map("product_id")
-  roomId           String?  @map("room_id")
-  publisherUserId  String?  @map("publisher_user_id")
-  publisherOrgId   String?  @map("publisher_org_id")
-  variant          String   @default("") @db.VarChar(160)
-  finish           String   @default("") @db.VarChar(160)
-  isSelected       Boolean  @default(true) @map("is_selected")
-  privateNote      String?  @map("private_note")
-  selectedById     String   @map("selected_by_id")
-  selectedAt       DateTime @default(now()) @map("selected_at")
-  selectionVersion Int      @default(1) @map("selection_version")
-  createdAt        DateTime @default(now()) @map("created_at")
-  updatedAt        DateTime @updatedAt @map("updated_at")
+  questions        SpotlightQuestion[]
+  id               String              @id @default(uuid())
+  projectId        String              @map("project_id")
+  productId        String              @map("product_id")
+  roomId           String?             @map("room_id")
+  publisherUserId  String?             @map("publisher_user_id")
+  publisherOrgId   String?             @map("publisher_org_id")
+  variant          String              @default("") @db.VarChar(160)
+  finish           String              @default("") @db.VarChar(160)
+  isSelected       Boolean             @default(true) @map("is_selected")
+  privateNote      String?             @map("private_note")
+  selectedById     String              @map("selected_by_id")
+  selectedAt       DateTime            @default(now()) @map("selected_at")
+  selectionVersion Int                 @default(1) @map("selection_version")
+  createdAt        DateTime            @default(now()) @map("created_at")
+  updatedAt        DateTime            @updatedAt @map("updated_at")

   project       Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
   product       Product               @relation(fields: [productId], references: [id], onDelete: Restrict)
@@ -8010,3 +8012,64 @@ model ProductSpotlightTag {
   @@index([spotlightId], map: "product_spotlight_tags_spotlight_idx")
   @@map("product_spotlight_tags")
 }
+
+model SpotlightQuestion {
+  id                     String    @id @default(uuid())
+  spotlightId            String    @map("spotlight_id")
+  kind                   String    @db.VarChar(16)
+  questionVersion        Int       @map("question_version")
+  meaningKey             String    @map("meaning_key") @db.VarChar(64)
+  contextSnapshot        Json      @map("context_snapshot")
+  wording                String    @db.Text
+  promptVersion          String    @map("prompt_version") @db.VarChar(80)
+  policyVersion          String    @map("policy_version") @db.VarChar(80)
+  parentAnswerRevisionId String?   @map("parent_answer_revision_id")
+  retiredAt              DateTime? @map("retired_at") @db.Timestamp(3)
+  retiredReason          String?   @map("retired_reason") @db.VarChar(32)
+  stateVersion           Int       @default(0) @map("state_version")
+  currentAnswerNumber    Int?      @map("current_answer_number")
+  createdAt              DateTime  @default(now()) @map("created_at") @db.Timestamp(3)
+
+  spotlight     ProductSpotlight          @relation(fields: [spotlightId], references: [id], onDelete: Restrict, onUpdate: Restrict)
+  answers       SpotlightAnswerRevision[] @relation("SpotlightQuestionAnswers")
+  currentAnswer SpotlightAnswerRevision?  @relation("SpotlightCurrentAnswer", fields: [id, currentAnswerNumber], references: [questionId, revisionNumber], onDelete: Restrict, onUpdate: Restrict, map: "spotlight_questions_current_answer_fk")
+  parentAnswer  SpotlightAnswerRevision?  @relation("SpotlightFollowupParent", fields: [parentAnswerRevisionId], references: [id], onDelete: Restrict, onUpdate: Restrict)
+
+  @@unique([id, questionVersion], map: "spotlight_questions_id_version_key")
+  @@unique([spotlightId, kind, questionVersion], map: "spotlight_questions_version_key")
+  @@unique([spotlightId, kind, meaningKey], map: "spotlight_questions_meaning_key")
+  @@index([parentAnswerRevisionId], map: "spotlight_questions_parent_idx")
+  @@map("spotlight_questions")
+}
+
+model SpotlightAnswerRevision {
+  id                       String   @id @default(uuid())
+  questionId               String   @map("question_id")
+  questionVersion          Int      @map("question_version")
+  revisionNumber           Int      @map("revision_number")
+  answeringUserId          String   @map("answering_user_id")
+  acceptedText             String   @map("accepted_text") @db.Text
+  acceptanceSnapshot       Json     @map("acceptance_snapshot")
+  inputModality            String   @map("input_modality") @db.VarChar(16)
+  acceptanceMode           String   @map("acceptance_mode") @db.VarChar(24)
+  reusedFromRevisionId     String?  @map("reused_from_revision_id")
+  reuseSnapshot            Json?    @map("reuse_snapshot")
+  requestKey               String   @map("request_key") @db.VarChar(128)
+  requestHash              String   @map("request_hash") @db.VarChar(64)
+  acceptedStateVersion     Int      @map("accepted_state_version")
+  acceptedSelectionVersion Int      @map("accepted_selection_version")
+  acceptedAt               DateTime @default(now()) @map("accepted_at") @db.Timestamp(3)
+
+  question          SpotlightQuestion         @relation("SpotlightQuestionAnswers", fields: [questionId, questionVersion], references: [id, questionVersion], onDelete: Restrict, onUpdate: Restrict, map: "spotlight_answers_question_version_fk")
+  answeringUser     User                      @relation("SpotlightAnsweringUser", fields: [answeringUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)
+  currentFor        SpotlightQuestion[]       @relation("SpotlightCurrentAnswer")
+  followupQuestions SpotlightQuestion[]       @relation("SpotlightFollowupParent")
+  reusedFrom        SpotlightAnswerRevision?  @relation("SpotlightAnswerReuse", fields: [reusedFromRevisionId], references: [id], onDelete: Restrict, onUpdate: Restrict)
+  reusedBy          SpotlightAnswerRevision[] @relation("SpotlightAnswerReuse")
+
+  @@unique([questionId, revisionNumber], map: "spotlight_answers_number_key")
+  @@unique([questionId, answeringUserId, requestKey], map: "spotlight_answers_request_key")
+  @@index([answeringUserId], map: "spotlight_answers_actor_idx")
+  @@index([reusedFromRevisionId], map: "spotlight_answers_reuse_idx")
+  @@map("spotlight_answer_revisions")
+}
```

### migration.sql

```sql
-- PROPOSAL ONLY. Not installed in prisma/migrations and not approved for execution.
-- Two private durable interview tables. Existing spotlight IDs and user IDs are TEXT.
BEGIN;

CREATE TABLE IF NOT EXISTS public.spotlight_questions (
  id TEXT PRIMARY KEY,
  spotlight_id TEXT NOT NULL REFERENCES public.product_spotlights(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  kind VARCHAR(16) NOT NULL,
  question_version INTEGER NOT NULL,
  meaning_key VARCHAR(64) NOT NULL,
  context_snapshot JSONB NOT NULL,
  wording TEXT NOT NULL,
  prompt_version VARCHAR(80) NOT NULL,
  policy_version VARCHAR(80) NOT NULL,
  parent_answer_revision_id TEXT,
  retired_at TIMESTAMP(3),
  retired_reason VARCHAR(32),
  state_version INTEGER NOT NULL DEFAULT 0,
  current_answer_number INTEGER,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT spotlight_questions_kind_check CHECK (
    (kind = 'BASE' AND parent_answer_revision_id IS NULL) OR
    (kind = 'FOLLOW_UP' AND parent_answer_revision_id IS NOT NULL)
  ),
  CONSTRAINT spotlight_questions_version_check CHECK (
    question_version > 0 AND state_version >= 0 AND
    (current_answer_number IS NULL OR current_answer_number > 0)
  ),
  CONSTRAINT spotlight_questions_text_check CHECK (
    meaning_key ~ '^[0-9a-f]{64}$' AND btrim(wording) <> '' AND
    btrim(prompt_version) <> '' AND btrim(policy_version) <> ''
  ),
  CONSTRAINT spotlight_questions_snapshot_check CHECK (jsonb_typeof(context_snapshot) = 'object'),
  CONSTRAINT spotlight_questions_retirement_check CHECK (
    (retired_at IS NULL AND retired_reason IS NULL) OR
    (retired_at IS NOT NULL AND retired_reason IS NOT NULL AND retired_reason IN ('DESELECTED','NO_VALID_SOURCE','SCOPE_CHANGED','PARENT_REANSWERED','POLICY_CHANGED'))
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS spotlight_questions_id_version_key ON public.spotlight_questions(id, question_version);
CREATE UNIQUE INDEX IF NOT EXISTS spotlight_questions_version_key ON public.spotlight_questions(spotlight_id, kind, question_version);
CREATE UNIQUE INDEX IF NOT EXISTS spotlight_questions_meaning_key ON public.spotlight_questions(spotlight_id, kind, meaning_key);
CREATE UNIQUE INDEX IF NOT EXISTS spotlight_questions_active_kind_key ON public.spotlight_questions(spotlight_id, kind) WHERE retired_at IS NULL;
CREATE INDEX IF NOT EXISTS spotlight_questions_parent_idx ON public.spotlight_questions(parent_answer_revision_id);

CREATE TABLE IF NOT EXISTS public.spotlight_answer_revisions (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  question_version INTEGER NOT NULL,
  revision_number INTEGER NOT NULL,
  answering_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  accepted_text TEXT NOT NULL,
  acceptance_snapshot JSONB NOT NULL,
  input_modality VARCHAR(16) NOT NULL,
  acceptance_mode VARCHAR(24) NOT NULL,
  reused_from_revision_id TEXT REFERENCES public.spotlight_answer_revisions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  reuse_snapshot JSONB,
  request_key VARCHAR(128) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  accepted_state_version INTEGER NOT NULL,
  accepted_selection_version INTEGER NOT NULL,
  accepted_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT spotlight_answers_question_version_fk FOREIGN KEY (question_id, question_version)
    REFERENCES public.spotlight_questions(id, question_version) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT spotlight_answers_numbers_check CHECK (
    revision_number > 0 AND accepted_state_version > 0 AND accepted_selection_version > 0
  ),
  CONSTRAINT spotlight_answers_text_check CHECK (
    btrim(accepted_text) <> '' AND btrim(request_key) <> '' AND request_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT spotlight_answers_snapshot_check CHECK (jsonb_typeof(acceptance_snapshot) = 'object'),
  CONSTRAINT spotlight_answers_modality_check CHECK (input_modality IN ('TEXT','VOICE','MIXED')),
  CONSTRAINT spotlight_answers_reuse_check CHECK (
    (acceptance_mode = 'AUTHORED' AND reused_from_revision_id IS NULL AND reuse_snapshot IS NULL) OR
    (acceptance_mode = 'CONFIRMED_REUSE' AND reuse_snapshot IS NOT NULL AND jsonb_typeof(reuse_snapshot) = 'object')
  ),
  CONSTRAINT spotlight_answers_no_self_reuse CHECK (reused_from_revision_id IS NULL OR reused_from_revision_id <> id)
);
CREATE UNIQUE INDEX IF NOT EXISTS spotlight_answers_number_key ON public.spotlight_answer_revisions(question_id, revision_number);
CREATE UNIQUE INDEX IF NOT EXISTS spotlight_answers_request_key ON public.spotlight_answer_revisions(question_id, answering_user_id, request_key);
CREATE INDEX IF NOT EXISTS spotlight_answers_actor_idx ON public.spotlight_answer_revisions(answering_user_id);
CREATE INDEX IF NOT EXISTS spotlight_answers_reuse_idx ON public.spotlight_answer_revisions(reused_from_revision_id);

-- Cyclic references added after both tables and referenced unique indexes exist.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.spotlight_questions'::regclass AND conname = 'spotlight_questions_current_answer_fk') THEN
    ALTER TABLE public.spotlight_questions ADD CONSTRAINT spotlight_questions_current_answer_fk
      FOREIGN KEY (id, current_answer_number) REFERENCES public.spotlight_answer_revisions(question_id, revision_number)
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.spotlight_questions'::regclass AND conname = 'spotlight_questions_parent_answer_revision_id_fkey') THEN
    ALTER TABLE public.spotlight_questions ADD CONSTRAINT spotlight_questions_parent_answer_revision_id_fkey
      FOREIGN KEY (parent_answer_revision_id) REFERENCES public.spotlight_answer_revisions(id)
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.spotlight_history_no_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Durable spotlight history cannot be updated, deleted or truncated' USING ERRCODE = '23514';
END;
$$;

CREATE OR REPLACE FUNCTION public.spotlight_question_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.state_version <> 0 OR NEW.current_answer_number IS NOT NULL THEN
      RAISE EXCEPTION 'New question must start without an answer at state version zero' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF (to_jsonb(NEW) - ARRAY['retired_at','retired_reason','state_version','current_answer_number'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['retired_at','retired_reason','state_version','current_answer_number']) THEN
      RAISE EXCEPTION 'Question definition is immutable; reconcile a new meaning explicitly' USING ERRCODE = '23514';
    END IF;
    IF NEW.state_version <> OLD.state_version + 1 THEN
      RAISE EXCEPTION 'Question state version must advance exactly once' USING ERRCODE = '23514';
    END IF;
    IF NEW.current_answer_number IS DISTINCT FROM OLD.current_answer_number AND
       (NEW.current_answer_number IS NULL OR NEW.current_answer_number <> coalesce(OLD.current_answer_number, 0) + 1) THEN
      RAISE EXCEPTION 'Current answer must advance to the next revision' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Definition replacement is atomic within this transaction; no trigger-free committed state.
DROP TRIGGER IF EXISTS spotlight_questions_guard ON public.spotlight_questions;
CREATE TRIGGER spotlight_questions_guard BEFORE INSERT OR UPDATE ON public.spotlight_questions
  FOR EACH ROW EXECUTE FUNCTION public.spotlight_question_guard();
DROP TRIGGER IF EXISTS spotlight_questions_no_delete ON public.spotlight_questions;
CREATE TRIGGER spotlight_questions_no_delete BEFORE DELETE ON public.spotlight_questions
  FOR EACH ROW EXECUTE FUNCTION public.spotlight_history_no_mutation();
DROP TRIGGER IF EXISTS spotlight_questions_no_truncate ON public.spotlight_questions;
CREATE TRIGGER spotlight_questions_no_truncate BEFORE TRUNCATE ON public.spotlight_questions
  FOR EACH STATEMENT EXECUTE FUNCTION public.spotlight_history_no_mutation();
DROP TRIGGER IF EXISTS spotlight_answers_no_mutation ON public.spotlight_answer_revisions;
CREATE TRIGGER spotlight_answers_no_mutation BEFORE UPDATE OR DELETE ON public.spotlight_answer_revisions
  FOR EACH ROW EXECUTE FUNCTION public.spotlight_history_no_mutation();
DROP TRIGGER IF EXISTS spotlight_answers_no_truncate ON public.spotlight_answer_revisions;
CREATE TRIGGER spotlight_answers_no_truncate BEFORE TRUNCATE ON public.spotlight_answer_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION public.spotlight_history_no_mutation();

ALTER TABLE public.spotlight_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spotlight_answer_revisions ENABLE ROW LEVEL SECURITY;
-- No policies and no grants, including no service_role grants.
COMMIT;
```

## Existing schema context (baseline; not additional changes)

The following relevant existing model blocks are copied in full from the baseline. The separate User/Project identity extracts show exact existing declarations; unrelated fields are omitted only in these clearly labeled context extracts. All proposed changes are fully present in schema.patch above.

### Existing ProductSpotlight

```prisma
model ProductSpotlight {
  id               String   @id @default(uuid())
  projectId        String   @map("project_id")
  productId        String   @map("product_id")
  roomId           String?  @map("room_id")
  publisherUserId  String?  @map("publisher_user_id")
  publisherOrgId   String?  @map("publisher_org_id")
  variant          String   @default("") @db.VarChar(160)
  finish           String   @default("") @db.VarChar(160)
  isSelected       Boolean  @default(true) @map("is_selected")
  privateNote      String?  @map("private_note")
  selectedById     String   @map("selected_by_id")
  selectedAt       DateTime @default(now()) @map("selected_at")
  selectionVersion Int      @default(1) @map("selection_version")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  project       Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  product       Product               @relation(fields: [productId], references: [id], onDelete: Restrict)
  room          Room?                 @relation(fields: [roomId], references: [id], onDelete: SetNull)
  publisherUser User?                 @relation("SpotlightPublisher", fields: [publisherUserId], references: [id], onDelete: Restrict)
  publisherOrg  Organization?         @relation("SpotlightPublisherOrg", fields: [publisherOrgId], references: [id], onDelete: Restrict)
  selectedBy    User                  @relation("SpotlightSelector", fields: [selectedById], references: [id], onDelete: Restrict)
  sourceTags    ProductSpotlightTag[]

  @@index([projectId, isSelected], map: "product_spotlights_project_selected_idx")
  @@index([productId], map: "product_spotlights_product_idx")
  @@index([roomId], map: "product_spotlights_room_idx")
  @@index([selectedById], map: "product_spotlights_selector_idx")
  @@index([publisherUserId], map: "product_spotlights_publisher_user_idx")
  @@index([publisherOrgId], map: "product_spotlights_publisher_org_idx")
  @@map("product_spotlights")
}
```

### Existing ProductSpotlightTag

```prisma
model ProductSpotlightTag {
  tagId       String   @id @map("tag_id")
  spotlightId String   @map("spotlight_id")
  linkedAt    DateTime @default(now()) @map("linked_at")

  tag       ProductTag       @relation(fields: [tagId], references: [id], onDelete: Cascade)
  spotlight ProductSpotlight @relation(fields: [spotlightId], references: [id], onDelete: Cascade)

  @@index([spotlightId], map: "product_spotlight_tags_spotlight_idx")
  @@map("product_spotlight_tags")
}
```

### Existing OrganizationUser

```prisma
model OrganizationUser {
  id             String      @id @default(uuid())
  userId         String
  organizationId String
  role           OrgUserRole @default(MEMBER)
  isActive       Boolean     @default(true)
  joinedAt       DateTime    @default(now())
  workEmail      String? // Work email associated with this org membership

  // Phase 2: Display preferences
  showOnProfile Boolean @default(true) // Whether to show this org on user's profile

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Team member quiz for onboarding
  teamMemberQuiz TeamMemberQuiz?

  @@unique([userId, organizationId])
  @@index([userId])
  @@index([organizationId])
  @@map("organization_users")
}
```

### Existing EditorialInterview

```prisma
model EditorialInterview {
  id        String  @id @default(cuid())
  projectId String  @unique @map("project_id")
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  status EditorialInterviewStatus @default(IN_PROGRESS)

  selectedQuestionIds String[] @map("selected_question_ids")

  // Room pacing: tracks per-room interview progress
  roomProgress Json? @map("room_progress")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  answers EditorialInterviewAnswer[]

  // Real-time interview sessions that contributed to this editorial
  realtimeSessions RealtimeInterviewSession[]

  @@map("editorial_interviews")
}
```

### Existing EditorialInterviewAnswer

```prisma
model EditorialInterviewAnswer {
  id          String             @id @default(cuid())
  interviewId String             @map("interview_id")
  interview   EditorialInterview @relation(fields: [interviewId], references: [id], onDelete: Cascade)

  questionId     String  @map("question_id")
  questionText   String? @map("question_text") // The actual question text for editorial generation
  isFollowUp     Boolean @default(false) @map("is_follow_up")
  parentAnswerId String? @map("parent_answer_id") // For follow-ups, links to Layer 1 answer

  answerText    String  @map("answer_text")
  audioUrl      String? @map("audio_url") // Optional: retained audio
  // Whisper word timings for the retained recording: [{ word, start, end }],
  // seconds. First-word start to last-word end resolves any contiguous
  // substring — which is what a pull quote is — to a time span. Projected from
  // provenance.interview.audio, never written directly (spec 21 delta D5a).
  // Deliberate intermediate: promoted to a relational TranscriptWord table when
  // D4's pull-quote model lands to point at it.
  wordTimings   Json?   @map("word_timings")
  inputModality String  @default("text") @map("input_modality") // "text" | "voice" | "mixed"

  // AI-extracted metadata (optional)
  confidenceScore    Float?   @map("confidence_score")
  inferredPriorities String[] @map("inferred_priorities")
  softConstraints    String[] @map("soft_constraints")

  // NEW: Contextual question linking
  linkedImageId             String? @map("linked_image_id")
  linkedProductId           String? @map("linked_product_id")
  questionSource            String? @map("question_source") // 'base_question' | 'ai_classification' | 'follow_up'
  aiClassificationAttribute String? @map("ai_classification_attribute") // e.g., "color:sage green"

  // Room pacing: associates answer with a specific room
  roomId      String? @map("room_id")
  isCrossRoom Boolean @default(false) @map("is_cross_room")

  // The QUESTION CATEGORY the designer answered under — one of the twelve
  // SECTION_ENUM values in @/lib/posting/interviewSchemas ("what", "how",
  // "emotionalCore" …). Orthogonal to `roomId`, which is the room the answer is
  // ABOUT: a "what" question can be asked about the Entry.
  //
  // It exists because the projection had nowhere to put it. Provenance stores it
  // as `section`, loadInterviewAnswers overwrites `section` with the resolved
  // room name for the consumers that match it against a chapter title, and the
  // category was gone with no recovery path. Nullable and never backfilled:
  // rows written before this column keep null, which reads as "unknown" rather
  // than as a wrong value.
  questionCategory String? @map("question_category")

  createdAt DateTime @default(now()) @map("created_at")

  // Relations
  // Removed - AttributeVerification doesn't have interviewAnswerId field

  // The durable identity of an answer WITHIN an interview.
  //
  // `rebuildAnswerProjection` already treats this triple as a key: it builds
  // `idByQuestion` keyed on `rowKey(questionId, isFollowUp)` to re-link a
  // follow-up to its parent inside a single insert
  // (syncInterviewAnswers.ts:65-66, 114-116). Nothing enforced it, so the
  // assumption held by convention only — and two rows sharing the triple would
  // collapse to one entry in that Map and then collide on the primary key at
  // insert. This turns the convention into a constraint.
  //
  // It is also the key a pull quote can point at. Row `id` is re-minted by
  // `randomUUID()` on every sync, so a stored answer id dangles as soon as the
  // designer answers one more question; this triple survives the rebuild.
  //
  // Named explicitly: Prisma's derived name for this triple is 69 characters
  // and Postgres truncates identifiers at 63, so leaving it implicit would make
  // the constraint name depend on a silent truncation.
  @@unique([interviewId, questionId, isFollowUp], map: "editorial_interview_answers_row_key")
  @@index([interviewId])
  @@index([questionId])
  @@index([linkedImageId])
  @@index([roomId])
  @@map("editorial_interview_answers")
}
```

### Existing ProjectPost

```prisma
model ProjectPost {
  id        String  @id @default(cuid())
  projectId String  @unique
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  status      PostStatus  @default(DRAFT)
  variant     PostVariant @default(PROJECT_FEATURE)
  slug        String      @unique
  heroAssetId String?
  excerpt     String?
  keywords    String[]    @default([])

  expandedBlocks Json?
  provenance     Json?
  credits        Json?

  publishedAt          DateTime?
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt
  editorialAssignments EditorialAssignment[]

  // Homepage XL editorial slot (Task 05)
  // When `now()` is in [homepage_xl_starts_at, homepage_xl_ends_at] and status=PUBLISHED,
  // this post is the curated XL hero on `/`. App-level uniqueness — at most one row
  // is in-window at any time. Editorial team enforces in admin form.
  homepageXlStartsAt DateTime? @map("homepage_xl_starts_at")
  homepageXlEndsAt   DateTime? @map("homepage_xl_ends_at")

  // Intelligence System relations
  supplementalQuotes SupplementalQuote[] @relation("PostSupplementalQuotes")

  // In Context Boost System
  inContextBoosts InContextBoost[] @relation("PostInContextBoosts")

  // Homepage Reel Boost System (Task 05)
  homepageReelBoosts HomepageReelBoost[] @relation("PostHomepageReelBoosts")

  // Contributor/Voice System relations
  publishedContributions Contribution[] @relation("PostContributions")
  sourceArticleTopic     ArticleTopic?  @relation("TopicPublishedPost")

  // Prompted Content: Story Threads
  storyThreads StoryThread[]

  // Section editing (Phase C)
  sectionOverrides   Json?   @map("section_overrides")
  sectionHistory     Json?   @map("section_history")
  lastGenerationNote String? @map("last_generation_note") @db.Text

  postSaves PostSave[]

  // Partial index for fast XL window scans on the homepage feed (Task 05).
  @@index([homepageXlStartsAt, homepageXlEndsAt], name: "project_posts_homepage_xl_window_idx")
  @@map("project_posts")
}
```

### Existing User identity/relation context extract

```prisma
model User {
  spotlightsAsPublisher ProductSpotlight[] @relation("SpotlightPublisher")
  selectedSpotlights    ProductSpotlight[] @relation("SpotlightSelector")
  id                             String                    @id @default(uuid())
  rsvps                          EventRSVP[]               @relation("UserRSVPs")
  events                         Event[]                   @relation("EventCreator")
  products                       Product[]                 @relation("VendorProducts")
  designerProjects               Project[]                 @relation("DesignerProjects")
  ownedProjects                  Project[]                 @relation("OwnedProjects")
  vendorQuotes                   Quote[]                   @relation("VendorQuotes")
  vendorSelections               Selection[]               @relation("VendorSelections")
  vendorStories                  Story[]                   @relation("StoryToVendor")
  adminImpersonations            ImpersonationLog[]        @relation("AdminImpersonations")
  userImpersonations             ImpersonationLog[]        @relation("UserImpersonations")
  collaborationStories           CollaborationStory[]      @relation("CollaborationStoryDesigner")
  mintedOrgClaimInvites          OrgClaimInvite[]          @relation("ClaimInviteCreator")
  claimedOrgInvites              OrgClaimInvite[]          @relation("ClaimInviteClaimer")
  operatingAsOrg   Organization? @relation("UserOperatingAs", fields: [operatingAsOrgId], references: [id])
  buyerConsultations    Consultation[]        @relation("BuyerConsultations")
  designerConsultations Consultation[]        @relation("DesignerConsultations")
  boostOpportunities       BoostOpportunity[]       @relation("DesignerBoostOpportunities")
  approvedBoosts           Boost[]                  @relation("UserBoosts")
  inContextBoosts          InContextBoost[]         @relation("DesignerInContextBoosts")
  vendorPosts              VendorPost[]             @relation("UserVendorPosts")
  deletionRequestsMade     ProjectDeletionRequest[] @relation("DeletionRequestsMade")
  deletionRequestsResolved ProjectDeletionRequest[] @relation("DeletionRequestsResolved")
  purchaserOrders          Order[]        @relation("PurchaserOrders")
  attributedDesignerOrders Order[]        @relation("AttributedDesignerOrders")
  attributedRepOrders      Order[]        @relation("AttributedRepOrders")
  collaborationPartner Collaboration[]   @relation("CollaborationPartner")
  invitedTeamMembers TeamMemberInvite[] @relation("InvitedTeamMembers")
  claimedInvites     TeamMemberInvite[] @relation("ClaimedInvites")
  payoutRequests            PayoutRequest[] @relation("UserPayoutRequests")
  likes                  Like[]                  @relation("UserLikes")
  saves                  Save[]                  @relation("UserSaves")
  postSaves              PostSave[]              @relation("UserPostSaves")
  boards                 Board[]                 @relation("UserBoards")
  tasteInferences        TasteInference[]        @relation("UserTasteInferences")
  tasteProfile           UserTasteProfile?       @relation("UserTasteProfile")
  trendInterviewRequests TrendInterviewRequest[] @relation("DesignerTrendInterviews")
  contributions              Contribution[]      @relation("UserContributions")
  contributorBadges          ContributorBadge[]  @relation("UserContributorBadges")
  supplementalQuotes         SupplementalQuote[] @relation("UserSupplementalQuotes")
  shopProducts ShopProduct[] @relation("DesignerShopProducts")
  vendorInvitesClaimed    VendorInvite[]           @relation("VendorInvitesClaimed")
  vendorInvitesAdmin      VendorInvite[]           @relation("VendorInvitesAdmin")
  vendorPresentationViews VendorPresentationView[] @relation("VendorPresentationViews")
  claimedCachedProducts    CachedProduct[]           @relation("ClaimedCachedProducts")
  cachedProductEngagements CachedProductEngagement[] @relation("CachedProductEngagements")
  instagramExports InstagramExport[] @relation("DesignerInstagramExports")
  promptedQuestions PromptedQuestion[] @relation("UserPromptedQuestions")
  promptedAnswers   PromptedAnswer[]   @relation("UserPromptedAnswers")
  initiatedVisits VisitRecord[] @relation("initiatedVisits")
  receivedVisits  VisitRecord[] @relation("receivedVisits")
  territoryAssignments OrgTerritoryAssignment[] @relation("RepTerritoryAssignments")
  followingRelationships UserRelationship[] @relation("Follower")
  followerRelationships  UserRelationship[] @relation("Following")
  initiatedConversations  Conversation[]            @relation("InitiatedConversations")
  receivedConversations   Conversation[]            @relation("ReceivedConversations")
  sourcebookEntries  SourcebookEntry[]   @relation("UserSourcebookEntries")
  directoryBookmarks DirectoryBookmark[] @relation("UserDirectoryBookmarks")
  bookmarkedBy       DirectoryBookmark[] @relation("BookmarkedByUsers")
  pendingActions PendingAction[] @relation("UserPendingActions")
  quotedPricing       ProjectProductPricing[] @relation("QuotedByUser")
  bulkPricingRequests BulkPricingRequest[]    @relation("BulkRequestRep")
  repShadowProfile RepShadowProfile? @relation("RepShadowUser")
  emailThreads            EmailThread[]      @relation("UserEmailThreads")
  designerContacts        DesignerContact[]  @relation("UserDesignerContacts")
  contactImportJobs       ContactImportJob[] @relation("UserContactImportJobs")
  actionItemsAssigned         ActionItem[]            @relation("action_items_assignedToIdTousers")
  actionItemsCreated          ActionItem[]            @relation("action_items_createdByIdTousers")
  recordedVendorInterviews    InterviewSession[]      @relation("RecordedInterviewVendor")
  recordedVendorBoostRequests VendorBoostRequest[]    @relation("RecordedBoostVendor")
  outgoingFollows              Follow[]                      @relation("follows_followerIdTousers")
  incomingFollows              Follow[]                      @relation("follows_followingIdTousers")
  pendingRepInvitesAsDesigner  PendingRepInvite[]            @relation("pending_rep_invites_designerIdTousers")
  pendingRepInvitesAsRep       PendingRepInvite[]            @relation("pending_rep_invites_repUserIdTousers")
  @@map("users")
}
```

### Existing Project identity/relation context extract

```prisma
model Project {
  productSpotlights ProductSpotlight[]
  id                        String                     @id @default(uuid())
  designerId                String?
  ownerId                   String
  designerOrgId             String?
  designer                  User?                      @relation("DesignerProjects", fields: [designerId], references: [id])
  designerOrg               Organization?              @relation("DesignerProjects", fields: [designerOrgId], references: [id])
  owner                     User                       @relation("OwnedProjects", fields: [ownerId], references: [id])
  vendorOrg                 Organization?              @relation("VendorProjects", fields: [vendorOrgId], references: [id])
  attributeVerifications    AttributeVerification[]    @relation("ProjectAttributeVerifications")
  trendInterviewRequests TrendInterviewRequest[] @relation("ProjectTrendInterviews")
  contributions Contribution[] @relation("ProjectContributions")
  shopProducts ShopProduct[] @relation("ProjectShopProducts")
  @@map("projects")
}
```

### Existing Organization identity/relation context extract

```prisma
model Organization {
  spotlightsAsPublisher ProductSpotlight[] @relation("SpotlightPublisherOrg")
  id           String      @id @default(uuid())
  designerProjects     Project[]            @relation("DesignerProjects")
  vendorProjects       Project[]            @relation("VendorProjects")
  collaborationStories CollaborationStory[] @relation("CollaborationStoryVendor")
  usersOperatingAs     User[]               @relation("UserOperatingAs")
  vendorOrders  Order[]              @relation("VendorOrders")
  directoryRanking DirectoryRanking? @relation("DirectoryRanking")
  boostOpportunities BoostOpportunity[] @relation("VendorBoostOpportunities")
  vendorPosts        VendorPost[]       @relation("OrgVendorPosts")
  boosts             Boost[]            @relation("VendorBoosts")
  vendorPartnerships  OrgVendorPartnership[] @relation("DesignFirmPartnerships")
  inboundPartnerships OrgVendorPartnership[] @relation("VendorPartnerships")
  contentOpportunities VendorContentOpportunity[] @relation("VendorContentOpportunities")
  shopBoosts ShopBoost[] @relation("VendorShopBoosts")
  homepageReelBoosts HomepageReelBoost[] @relation("VendorHomepageReelBoosts")
  events Event[] @relation("OrgEvents")
  orgInitiatedVisits VisitRecord[] @relation("orgInitiatedVisits")
  orgReceivedVisits  VisitRecord[] @relation("orgReceivedVisits")
  territoryAssignments       OrgTerritoryAssignment[] @relation("VendorTerritoryAssignments")
  assignedAsTerritoryAccount OrgTerritoryAssignment[] @relation("DesignerTerritoryAssignments")
  orgInitiatedConversations Conversation[] @relation("OrgInitiatedConversations")
  orgReceivedConversations  Conversation[] @relation("OrgReceivedConversations")
  bulkPricingRequests       BulkPricingRequest[] @relation("VendorBulkRequests")
  vendorActionItemSignals   ActionItemSignal[]   @relation("VendorActionSignals")
  designerActionItemSignals ActionItemSignal[]   @relation("DesignerActionSignals")
  vendorShadowProfile VendorShadowProfile? @relation("VendorShadowOrg")
  designerContacts DesignerContact[] @relation("VendorOrgDesignerContacts")
  @@map("organizations")
}
```

### Existing Product identity/relation context extract

```prisma
model Product {
  spotlights ProductSpotlight[]
  id                String             @id @default(uuid())
  vendor            User?              @relation("VendorProducts", fields: [vendorId], references: [id])
  likes                Like[]                     @relation("ProductLikes")
  savesReceived        Save[]                     @relation("ProductSaves")
  contentOpportunities VendorContentOpportunity[] @relation("ProductContentOpportunities")
  contributions Contribution[] @relation("ProductContributions")
  shopProducts ShopProduct[]        @relation("ProductShopProducts")
  testimonials ProductTestimonial[] @relation("ProductTestimonials")
  sourcebookEntries SourcebookEntry[] @relation("ProductSourcebookEntries")
  pendingActions PendingAction[] @relation("ProductPendingActions")
  actionItemSignals ActionItemSignal[]      @relation("ProductActionSignals")
  inContextBoosts InContextBoost[] @relation("ProductInContextBoosts")
  homepageReelBoosts HomepageReelBoost[] @relation("ProductHomepageReelBoosts")
  @@map("products")
}
```

### Existing Room identity/relation context extract

```prisma
model Room {
  productSpotlights ProductSpotlight[]
  id            String         @id @default(uuid())
  projectId     String
  project       Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectImages ProjectImage[] @relation("RoomProjectImages")
  @@map("rooms")
}
```

### Existing ProductTag identity/relation context extract

```prisma
model ProductTag {
  spotlightLink ProductSpotlightTag?
  id         String    @id @default(uuid())
  productId  String
  imageId    String
  image           ProjectImage @relation(fields: [imageId], references: [id], onDelete: Cascade)
  product         Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  supplementalQuotes SupplementalQuote[] @relation("ProductTagQuotes")
  vendorInviteTriggers VendorInvite[] @relation("VendorInviteTriggerTag")
  @@map("product_tags")
}
```

### Existing ProjectImage identity/relation context extract

```prisma
model ProjectImage {
  id           String       @id @default(uuid())
  projectId    String
  project      Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  roomId       String?
  assignedRoom Room?          @relation("RoomProjectImages", fields: [roomId], references: [id], onDelete: SetNull)
  attributeVerifications AttributeVerification[] @relation("ImageAttributeVerifications")
  @@map("project_images")
}
```

## Approval and next action

Review the exact two-model/two-table proposal and the four retention/reuse/identity/privacy choices above. Approval A permits schema/migration file installation and static checks; B permits isolated PostgreSQL and migration-command testing. Service/UI implementation is the subsequent scoped milestone. Application migration, merge, deployment, removing either hold and exposure remain outside those approvals. No SQL execution or runtime feature completion is claimed by this packet.
