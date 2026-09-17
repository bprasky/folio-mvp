# Story activities: implementation and database review

Status: reviewable component prototype and interview rules implemented; **not connected to production persistence or the live Studio**. No schema edit, migration application, application-row writes or model calls occurred. This branch stacks on the unmerged Studio polish PR #785.

## What the designer does

1. Choose the designer, the firm, or a published project. A project can use the whole project or one verified room.
2. Choose 20 Questions with Folio, Q&A, material story, method, or firm history. Name the material for a material story. Optionally narrow the angle.
3. Choose intended outputs: Folio, Instagram and/or LinkedIn. These are draft destinations, not social-account connections or publishing consent.
4. Answer one question at a time. The twenty-question sets differ for designer, firm and project. The shorter activities have five questions each. Missing answers remain missing. All prompts pass the canonical arrivals gate; no grievance, fabricated premise or claimed testimony is inserted.
5. Save and return; reopen at the first unanswered question. A save failure retains the text and prevents a save-and-exit action from discarding it.
6. Review the complete answers. Unanswered questions block draft preparation. A short answer to the example question gets a gentle specificity nudge, not a word-count claim of quality. Human review is required. Editing an answer clears that review and the derived draft.
7. Prepare an exact-answer Q&A and selectable social excerpts. Original wording is retained without paraphrasing or automatic first-person invention. Longer answers are not silently truncated. This is the first drafting pass, not a claim that a material study has already been editorially rewritten.

Profile suggestions come from explicit absence of an introduction or point-of-view field; this is not an AI judgment that a designer is lacking. The production context adapter must supply these facts from the authorized profile. The prototype uses synthetic data only.

Default for review: typed answers. A preference question about reusing voice was left open; there is no new recording pipeline. Voice transcription, when added, must enter the same editable answer buffer and require review. It must not auto-complete an activity or publish a quote.

## Exact database addition for approval

The existing queue stores suggested prompts, not authored answers. The recorded-interview tables serve an audio/provenance pipeline and are not repurposed. This uses the editorial half of the earlier eight-table native publishing proposal:

| New table | Purpose |
| --- | --- |
| `editorial_stories` | Owner/workspace, optional originating queue item, identity and published revision pointer |
| `editorial_story_revisions` | Draft/approved content, frozen activity brief and prompts, review timestamp and edit version |
| `editorial_story_answers` | Original question and answer, author and time, independently of edited output |
| `editorial_story_sources` | Complete links to source project posts and their snapshot digests |

Exact model blocks and inverse-only additions are in **schema.prisma.txt**. Exact proposed SQL is in **migration.sql**. The additions to User are only:

```prisma
studioStories EditorialStory[] @relation("StudioStoryOwner")
studioStoryApprovals EditorialStoryRevision[] @relation("StudioStoryApprover")
studioStoryAnswers EditorialStoryAnswer[] @relation("StudioStoryAnswerer")
```

Organization, EditorialQueueItem and ProjectPost each gain one inverse relation. No existing scalar field, unique key or history row changes. Native social/campaign tables remain separately scoped.

Changes from the previous reviewed design: a revision now carries `interview` (versioned brief/question definitions only), `editVersion` for optimistic concurrency, and `answersReviewedAt` distinct from publication approval. Raw answers remain separate rows. The interview definition is generated server-side from the validated brief, never accepted as authoritative from the browser.

SQL comes from Prisma's local schema diff, with guarded table/index/constraint creation, approval/state CHECKs, and RLS enabled on every new table. No public or authenticated-client policies are granted. Future server routes must enforce authorization; RLS is not a substitute for those checks. Existing source/owner deletions can encounter restrictive FKs once records exist; production integration must handle those conflicts deliberately.

Fresh read-only metadata recon, 17 September 2026: none of these four tables exists; referenced IDs remain text; migration bookkeeping reports110 recorded,109 applied,0 unfinished. This is not a claim of zero drift. The proposed schema including all inverse additions validates under Prisma6.18.0 in an isolated temporary copy. Production schema is untouched; SQL has not been applied or exercised against a disposable PostgreSQL database yet.

## Persistence and release contract

The component consumes `ActivityPersistence.create/save`. The local preview implements memory storage and explicitly labels its limitations. Production wiring must satisfy these requirements after schema approval:

- Resolve session and active workspace on every request. Verify designer-tool eligibility, current organization membership/capability and ownership. An account switching workspaces must not see a previous workspace's private answers.
- `POST /api/publishing-studio/stories` accepts a bounded brief and a creation idempotency key. Read projects/rooms from the authorized workspace; validate all project sources and current publication. Create story, first revision, frozen interview definition and source rows in one transaction. Do not create a fake project for a firm story.
- `GET /api/publishing-studio/stories/:id` returns only an authorized owner's draft/current revision. List in-progress activities on the Studio with answered/total and Resume interview, separate from ready-to-polish cards. No GET writes or paid generation.
- `PATCH /api/publishing-studio/stories/:id` locks the revision and checks expected editVersion and ownership. Accept answer text keyed only by known question ID. The server supplies question text/actor/time and upserts original answers. Increment editVersion; invalidate reviewed/generated state on answer changes. A concurrent stale write returns409 without replacing the newer draft.
- Answer review and draft preparation are explicit commands, not browser-authoritative `reviewed` or `draft` payloads. The server reruns completeness, binds review to the exact editVersion, and derives output from persisted answers. Reject invented question IDs and client-supplied editorial blocks.
- Approved revisions are immutable. Further edits clone into the next numbered draft; answers/source links copy with provenance. All child writers and approvals lock the same revision row.
- Public reading, version approval and publication remain separate endpoints under the earlier native publishing contract. Preparing an interview draft never sets a public pointer, publishes a ProjectPost or grants feed/social consent. Cross-project campaigns and trend discovery are not implied by these four tables.
- Before production enablement: apply approved schema through the migration runbook; verify migrate status; implement/test the Prisma adapter and routes; exercise access, concurrency, source withdrawal and immutable revisions on real PostgreSQL; wire Studio entry/resume; verify a real designer's save/reopen flow. Keep the feature unexposed until all those steps pass.

## Review validation

Run `node scripts/check-story-activities.cjs` and `node scripts/check-story-activity-ui.cjs`. They verify all three twenty-question sets, canonical prompt checks, project/room scope, missing/reviewed answer boundaries, exact wording, failure retention, save-before-exit, resume and review invalidation. These are not database integration tests.

Run `node scripts/preview-story-activities.cjs` for the local prototype at port4183. It never calls an external model or saves designer data to production. Desktop/mobile review and schema validation accompany the PR; live persistence remains the explicit approval-dependent next step.
