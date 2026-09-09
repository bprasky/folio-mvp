# 06 — Editorial and publishing system

## Required spotlight/social extension — 9 September 2026

The [founder specification revision 1.1](Folio-Spotlight-and-Social-Publishing-Spec.md) adds designer-approved spotlights and separately published social pieces attached to the same parent project. It does not create a competing editorial article pipeline. Parent publication requires finishing unresolved spotlights or explicitly deferring them as drafts; a published project may receive a later spotlight through review/publish. Only the completed approved spotlight activates Shop/testimonials/Studio eligibility, independently of vendor state. Social export additionally requires the exact approved social-piece version to be published and render-ready, with live parent visibility and source permissions. Parent/piece withdrawal removes dependent public/feed/export eligibility. Discovery eligibility is distinct from earned featuring and paid boosts. Evaluate ProjectModule reuse before introducing another feed object. The current-implementation description below predates these additions; see the [foundation audit](SPOTLIGHT_FOUNDATION_AUDIT_2026-09-09.md).

Current implementation, audited 2026-09-08. P0 renderer work remains parked.

## Canonical journey

```text
Project (ownership, rooms, photos, tagged products)
  → EditorialInterview / EditorialInterviewAnswer and ProjectPost.provenance
  → /api/posting/project/[projectId]/interview/generate
  → ProjectPost.expandedBlocks, status DRAFT
  → designer self-publish OR submit to REVIEW
  → ADMIN approves → PUBLISHED, or rejects → DRAFT
  → /p/[slug] and published feed queries read that same ProjectPost
```

The generated draft is the ProjectPost itself. There is one post per project.
Review is optional; a designer cannot self-publish a post while it is in REVIEW.
Approval immediately publishes; there is no additional APPROVED state.

## Persistence and authority

| Model / storage | Role |
|---|---|
| ProjectPost | Authoritative article content and DRAFT / REVIEW / PUBLISHED / ARCHIVED lifecycle. publishedAt preserves first-publication history. |
| Project | Authoritative ownership and project data; isPublic/publishedAt/status are synchronized with article transitions in one transaction. A project without a post can still be published without a story. |
| EditorialInterview / EditorialInterviewAnswer | Captured interview source, distinct from publication. Provenance retains interview payload and generation metadata. |
| EditorialDraft | Historical table retained to preserve existing data. No active generator or public reader uses it. Room deletion still removes references from historical rawState. |
| EditorialCategory / EditorialAssignment | Classification and curation scores consumed by public collections, not review approval. |
| EditorialEdition | Curated multi-project collection, with its own edition publication date. |
| ProjectModule | Supporting project media (gallery, film, timeline etc.). |
| DesignerAngle / EditorialQueueItem | Proactive corpus recommendations per docs/17_EDITORIAL_QUEUE.md; a separate product concept, not the removed submission queue. |

The removed legacy submissions API used module arrays and wrote projects.json.
There is no runtime caller or editorial writer left. Other demo/export uses of
project JSON remain outside this workstream.

## Entry points

- `initiateEditorial` in `src/lib/editorial/lifecycle.ts` is the idempotent initializer used by Posting init and `createEditorialDraft`.
- `transitionEditorial` is the transactional mutation shared by the Posting status route, `publishEditorial`, and dashboard publishing when a post exists.
- `/api/posting/project/[projectId]/status` accepts explicit `action`: submit, approve, reject, publish, unpublish, archive. The unconsumed status/to compatibility payloads were removed.
- `/api/admin/editorial-review` lists persisted reviews after session and canonical ADMIN checks.
- `/admin/editorial-review` reviews those records. The designer staging panel offers submission.
- Existing `approvals/draft-editorial` and `approvals/publish-editorial` routes retain real callers and delegate to the shared implementation.

Posting V1's direct publish entry preserves its feature flag, organization gate,
and lead/narrative/gallery/tag prerequisites. The existing project publish action
(Path B) remains available with that flag off. Both use the same persisted
lifecycle and publication permission. These are existing entry-point policies,
not separate stored workflows.

## Transitions

| Action | Actor and authorization | State / effect | Retry and reversibility |
|---|---|---|---|
| Initiate | Session + project write access | Create unique DRAFT if absent | Return existing row; never overwrite |
| Generate | Session + project write; publish capability if currently published | Persist blocks as DRAFT and clear project visibility atomically | REVIEW/ARCHIVED and changed publication state are rejected |
| Submit | Session + project write | DRAFT → REVIEW, private; session submitter in provenance | Repeated submit returns same review |
| Approve | Session ADMIN + database ADMIN | REVIEW → PUBLISHED; project public in same transaction | Same decision is idempotent; may unpublish later |
| Reject | Session ADMIN + database ADMIN, nonempty reason | REVIEW → DRAFT, private | Same decision idempotent; may revise/resubmit |
| Self-publish | Session + project publish capability, entry-point readiness gates | DRAFT → PUBLISHED, project public | Timestamp preserved on retry; REVIEW cannot bypass admin |
| Unpublish | Session + project publish capability | PUBLISHED → DRAFT, project private | Idempotent; retains post publication history |
| Archive | Session + project publish capability | DRAFT/PUBLISHED → ARCHIVED, private | Idempotent, terminal |

Review metadata lives in `ProjectPost.provenance.editorialReview`: submittedBy,
submittedAt, reviewedBy, reviewedAt, decision and optional reason. It records the
latest review, not a parallel approval status. A new submission replaces the prior
review metadata. Identity is never accepted from request fields.

Serializable transactions with bounded retries and conditional status/version
writes prevent contradictory review decisions. Admin requests include the version
shown in the list; edits or another transition invalidate stale decisions.
Gallery and hero references are checked against the target project's images before
submission/publication. Public post readers require PUBLISHED and a public project.

## Curator mappings repaired

The approved mappings now align EditorialCategory, EditorialAssignment and
EditorialEdition with the existing snake_case columns. The regenerated client
successfully reads all three models and runs the magazine category groupBy query
without P2022. The existing unique-index name is preserved. No SQL migration or
database writes were performed. Exact mappings and evidence:
[tasks/editorial-schema-repair.md](../tasks/editorial-schema-repair.md).

The unreachable `curator.ts` cross-hook in-memory score/last-project mechanism was
deleted. Existing assignments and edition scheduling remain. There is no active
automatic assignment generator after this deletion; the deleted module already
had zero callers.

## Verification

Run `node node_modules/tsx/dist/cli.mjs --test scripts/editorial/lifecycle.test.ts`.
Authorization and transition tests run without DB access. The real database
journey additionally requires an existing disposable, schema-compatible database
configured as `EDITORIAL_TEST_DATABASE_URL` and
`EDITORIAL_TEST_DATABASE_DISPOSABLE=1`. It refuses either configured application
database, creates only uniquely identified fixtures, and removes those fixtures.
No infrastructure or schema is provisioned by the test.

The database test calls real route handlers, real project authz and real Prisma
transactions; only session acquisition and external notifications are substituted.
It verifies designer access, duplicate initialization/submission/review, admin
approve/reject, stale and contradictory decisions, independent-client persistence,
public-reader identity and unpublish visibility.

REAL DATABASE TRANSITION JOURNEY — PARKED PENDING DISPOSABLE TEST DB

Current execution results and outstanding gates:
[tasks/editorial-consolidation.md](../tasks/editorial-consolidation.md).
