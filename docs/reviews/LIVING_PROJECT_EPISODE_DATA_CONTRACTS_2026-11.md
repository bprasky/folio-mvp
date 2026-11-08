# Folio Living Projects — Data Contracts & Phased Implementation Proposal

**Status:** Proposed architecture, not approved migrations or shipped behavior. **Date:** 2026-11-08.
**Parent:** [Living Project & Media Network Reconciliation](LIVING_PROJECT_MEDIA_NETWORK_RECONCILIATION_2026-11.md)

## Founder-confirmed product invariants

1. **Folio turns documentation into storytelling.** The project is the permanent source of context; media-native episodes mix video, photographs, interview answers and text.
2. Folio can prepare drafts and story opportunities automatically, but **designer approval is required to publish an episode and to change the project anchor**.
3. Free vendors can submit verified factual context and corrections; independent branded publications and commercial use are paid capabilities.
4. Project stories remain available as a permanent archive, with access and publication permissions preserved.
5. Pilot invitations are not automatically sent; contributor participation is opt-in and editorial/public rights are distinct.
6. Do not manufacture conflict, infer blame as fact, or expose private setbacks without approval.

## Existing schema and constraints (verified in `prisma/schema.prisma`)

- `Project` has one `ProjectPost?`, many `ProjectModule[]`, `Story[]`, `Media[]`, `ProjectFile[]`, `ProjectParticipant[]`, `Contribution[]`, `DesignerDecision[]`, and `SelectionHistory[]`.
- `ProjectPost.projectId @unique` makes it the primary editorial, not a repeating episode record.
- `ProjectModule` is multi-instance, supports STORY, SHORT_VIDEO, LONG_VIDEO, ARTICLE, GALLERY and TIMELINE, with flexible `media Json` and `publishedAt`; it does **not** store ordered episode composition, source rights, or version approvals.
- `EditorialStoryRevision` supports approved/published versions, with `EditorialStorySource` currently pointing only to `ProjectPost`. `storyContext` currently limits sources to public published projects.
- `Story` is video-only and has nullable `expiresAt`; the story-circle feed currently uses `ProjectModule` instead.
- `SelectionHistory` records changes, reasons, source and timestamps; `DesignerDecision` records alternatives, tradeoffs and outcomes. Both can inform project intelligence but neither is a universal event ledger.
- `StoryThread` holds potential narrative angles and scoring but has a default three-contributor readiness threshold. That threshold must not become a universal gate.

## Contract 1 — ProjectEvent (proposed)

An event represents **what happened**, not a public story. It can be derived from an authorized source or explicitly recorded by a contributor.

| Field | Semantics |
| --- | --- |
| `id, projectId, eventType` | Stable identity; eventType e.g. decision, issue, delay, milestone, resolution, change, observation |
| `occurredAt, occurredAtPrecision, recordedAt` | Distinguish real event time from ingestion; permit uncertain dates |
| `summary, claims, confidence, verificationStatus` | Evidence-backed facts vs inferred possibilities; never silently promote inference to fact |
| `roomId?, contributorId?, organizationId?` | Optional contextual relationships |
| `parentEventId?, issueState?` | Connect issue → follow-up → resolution, with open/closed/unknown states |
| `sourceRefs[]` | Typed source IDs, immutable digest/version, quote/timecode/page/asset segment |
| `visibility, consentStatus` | Private by default; never inherit public access from a related project automatically |

**Ingestion:** project files, project images, interviews, selection changes and decisions can propose events; do not migrate historical rows destructively. Use idempotent provenance keys and retain source records. AI suggestions need evidence, confidence and an explicit uncertainty label.

## Contract 2 — StoryOpportunity (proposed)

An opportunity is a **private editorial proposal**, not an episode or publication.

- `id, projectId, proposedTitle, thesis, narrativeArc, evidenceRefs, openQuestions, missingMediaSuggestions`.
- `opportunityStatus`: proposed / developing / ready_for_review / dismissed / converted.
- `sourceSnapshotDigest`, `generatedAt`, `generationVersion`; regenerate safely when sources change.
- Each missing piece identifies the **specific** reason it matters, who could supply it, and a low-effort prompt (e.g. same-angle walkthrough).
- No minimum contributor count. Do not force generic drama; strong craftsmanship, transformation and design reasoning qualify.
- Private project events may inform private suggestions. They do not become public merely because the opportunity is ready.
- Existing `StoryThread` scoring can inform discovery but must not be treated as the sole source of truth.

## Contract 3 — Episode (proposed editorial publication)

An episode is a **media-native chapter**, not necessarily a video. It belongs to one Project and can link to milestones, rooms, contributors and products.

- Stable `episodeId`, `projectId`, `seriesOrder`, `title`, `summary`, `coverAsset`, `estimatedDuration`.
- `revisionNumber`, `status` (draft/review/published/withdrawn), `approvedBy`, `approvedAt`, `publishedAt`, `sourceSnapshotDigest`.
- Ordered `blocks[]` with typed video/image/text/audio/interview blocks; source references and contributor attribution per block.
- `rightsEligibility` evaluated at publication; fail closed for unknown or revoked public rights.
- Designer can approve a new revision without erasing a previously published version. Publish pointer changes atomically.
- **Architecture preference:** reuse existing EditorialStory revision/approval patterns and ProjectModule projection where practical; do not assume current EditorialStory formats already support episodes. Confirm implementation feasibility before migrations.
- An episode may remain developing while an issue is unresolved. Folio should propose a follow-up rather than inventing resolution.

## Contract 4 — ProjectAnchor (proposed)

A project anchor is a **designer-approved public editorial identity**, not an automatically promoted latest episode.

- `projectId`, `heroAssetId`, `headline/deck`, `milestoneEventId?`, `featuredEpisodeId?`, `approvedRevision`, `approvedAt`.
- Prior anchor revisions remain retrievable for history.
- Homepage feed thumbnails and automatic media suggestions are independent of the approved project anchor.
- Default public CTA: first unwatched episode when available; if no episodes, appropriate editorial introduction. An anchor can link to an episode without being one.

## Contract 5 — StoryArchive and WatchProgress (proposed)

- Story archive is **permanent unless deliberately deleted or access revoked**; distinguish raw private uploads from approved public story updates.
- Stories may be image, video, audio or text with typed source/asset references and a real event timestamp.
- Unwatched story rings require viewer-specific read markers; for anonymous viewers, a session-local fallback may be used without pretending durable cross-device history.
- Episode progress: `viewerId?, episodeId, positionSeconds?, completedAt?, updatedAt` with server authorization and minimal retention; do not leak private viewing identity to vendors.
- Continue-watching chooses the next **accessible** episode by stable ordering and completion state. A newly published episode does not automatically alter the approved anchor.

## Contract 6 — Contributor participation and vendor context

- Project participation/access, invitation send authorization, interview participation, factual correction approval, episode publishing approval, and commercial media licensing are **separate permissions**.
- During pilot: generate invitations as drafts only. Explicit owner/designer action required to send.
- A vendor may provide verified factual corrections and contextual evidence for free. Payment enables separate branded publication and commercial distribution, **not** control of the compiled factual narrative.
- Public claims must link to their source and applicable permissions. Conflicting contributor accounts remain attributed perspectives until reconciled.

## Read model boundaries

- **Private producer query:** authenticated, project/workspace-scoped, can read authorized unpublished material and evidence; no public publication side effects.
- **Public project channel:** requires `Project.isPublic`, eligible published editorial and individually approved episode/story projections; never return raw private event/source objects.
- **Public feed:** project-level publication gate enforced in the DB query before returning module media (PR #851); also filter each public asset by its own rights and approval status.
- **Vendor analytics:** permissioned/aggregated signals only; private project events and inferred client intent do not become unrestricted vendor access.

## Implementation phases — proposed, not authorized

**Phase A: foundation and security**
- Verify project media storage, public serializers, story expiration paths, contributor permissions, and feed security regression tests.
- Establish source/evidence adapter contracts for existing ProjectImage, ProjectFile, EditorialInterviewAnswer, SelectionHistory, DesignerDecision.
- No automatic public publication or contributor outreach.

**Phase B: project memory and story opportunities**
- Add minimal typed event/provenance persistence only where existing tables cannot serve the contract.
- Build selective issue/resolution follow-ups, opportunity scoring and actionable missing-footage suggestions.
- Evaluate on representative real project timelines, including setbacks, quiet projects and incomplete documentation.

**Phase C: episode drafting and approval**
- Reuse revision/approval service patterns; add multi-asset chapter composition and rights gating.
- Publish approved projections without changing existing ProjectPost or breaking Social Studio/Spotlight.

**Phase D: public channel and progression**
- Evolving approved project hero, familiar story rings, episodes row, first-unwatched/continue-watching, optional directory.
- Support sparse/active/completed projects, mobile-first and anonymous viewers.

**Phase E: collaborator flywheel and commercial features**
- Contextual contribution requests (manual during pilot), multi-perspective stories, commercial branded publications, licensed media reuse and permissioned intelligence.

## Acceptance criteria for initial slice

1. Uploading private evidence cannot cause public media exposure.
2. Folio can identify a supported event/change and generate a source-linked editorial suggestion.
3. A delayed material or installation error remains private until the designer approves a publishable account.
4. An episode draft can mix video, photographs, text and interview excerpts and retains immutable source provenance.
5. Approval publishes one version; later edits do not silently rewrite the public version.
6. A project with no episodes remains an elegant, functional editorial page.
7. A project with episodes offers the next unwatched chapter without making the hero an episode.
8. Free factual vendor contributions do not require a subscription and cannot bypass designer publishing approval.
9. No pilot invitation is sent automatically.
10. Public feed returns no modules from private or unpublished parent projects.

## Explicitly unresolved technical questions

- Whether to extend `EditorialStory` for episode revisions or create a small episode-specific aggregate that reuses its approval service.
- Whether existing `ProjectModule` should be a durable published projection or only a compatibility read model.
- Whether existing Story rows should be migrated or left as legacy video stories with new mixed-media updates modeled separately.
- Rights grant scope for third-party professional photography and video.
- Retention and privacy choices for per-viewer progress.

These require a focused engineering design and tests, not a new high-level founder decision at this stage.
