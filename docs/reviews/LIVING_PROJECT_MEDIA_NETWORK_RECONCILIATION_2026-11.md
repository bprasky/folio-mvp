# Folio — Living Project & Media Network: Architecture Reconciliation

**Status:** Working product direction; documentation audit in progress. **Date:** 2026-11-07.
**Scope:** Product architecture and document delta, not an implementation claim. No production behavior or rollout permissions change.

## North star

**Folio turns documentation into storytelling.**

A Project is the durable source of context, not merely a container for one finished article. Designers and approved collaborators contribute photographs, videos, interviews, updates, selections, decisions, setbacks, resolutions, and milestones. Folio identifies authentic storylines, missing evidence and questions, then proposes episodes and other publications. Public content is approved before publication. Original uploads and project history remain accessible under appropriate permissions.

## Product experience — agreed direction

- **Public project channel:** Preserve the current cinematic, editorial hero as the project's identity and evolving milestone anchor. The anchor is **not** automatically the latest episode. One clear primary action leads a first-time visitor to start watching and a returning viewer to continue the next unwatched episode. Progress is per viewer when available.
- **Stories:** Familiar story-ring affordance on project/contributor identities for new/unwatched updates. Stories do **not expire**; date, contributor, project stage, room and topic support archival navigation.
- **Episodes:** Folio discovers coherent narratives from story dumps, interviews, site footage, renderings and project events. Episodes can be short and amateur; editorial relevance matters more than production polish. They are sequenced for viewing, while original stories remain browsable.
- **Project history:** Distinguish event date from upload/publication date. Chronology and milestones support exploration but do not dictate narrative episode structure.
- **Adaptive depth:** Small projects can remain simple editorial pages; larger projects naturally gain episodes, collaborators, room collections, timeline and deeper directory. No empty tabs or dashboard clutter.
- **Private editorial producer:** Identify compelling arcs, unresolved issues, useful footage, and precise follow-up questions. A designer may be prompted to film a site walkthrough or revisit an earlier decision. Prompts should be selective, not noisy.
- **Truth and consent:** Preserve original evidence, provenance, uncertainty and contributor attribution. Do not invent drama or expose private mistakes. Setbacks can become stories only with suitable approvals.

## Collaboration and growth

- The initial designer interview supplies context for architect, builder, fabricator and vendor questions. Later contributions can generate targeted questions for other relevant parties, creating an evolving conversation rather than disconnected interviews.
- Contributors may supply their own footage, interviews and perspectives. Each contribution can enrich a compiled Super Article and yield separate, approved publications.
- Contributor invitations are **prepared but not automatically sent during pilot**. Sending requires explicit authorization; no automatic reminders at launch.
- Public project identity, contributor profiles and vendor installed-work references should resolve to linked entities, not duplicated product catalogs.

## Commercial architecture — direction, not pricing commitment

- **Free:** Accurate attribution, verified organization profile, limited factual context/corrections and public references.
- **Paid vendor value:** Branded perspectives, installed-work collections, licensed project media, reusable case studies, permissioned analytics, qualified introductions and concierge distribution.
- **Editorial independence:** Do not sell influence over factual compiled narratives. Sponsored distribution and commercial reuse are distinct from editorial credibility.
- **Rights:** A designer's declaration alone does not prove sublicensing rights to professional photography. Capture rights/provenance and use a lightweight permission gate for pilot; detailed licensing marketplace later. Compensate designers and other applicable rights holders for commercial reuse.
- **Intelligence:** Project/people/product/organization relationships can reveal patterns and specification opportunities. Private project information and inferred intent are not unrestricted vendor data; require appropriate privacy and permission controls.
- **Catalogs:** Vendors maintain their own product systems; Folio links real installed applications, contributors, evidence, context and approved media to external products.

## Canonical conceptual relationships (not a schema proposal)

Project ↔ Milestone/Event ↔ Story/Source Asset ↔ Story Opportunity ↔ Episode/Publication.
Cross-links: Room, Contributor, Organization, Installed Product, Interview, Decision/Issue/Resolution, Permission, Distribution and Engagement.

Do not prematurely collapse raw assets, events, story suggestions and approved publications into one database model. Confirm current schema and renderer first.

## Existing specifications: preliminary delta

| Existing source | Keep | Reconcile / extend |
| --- | --- | --- |
| `docs/15_SUPER_ARTICLES.md` | Compiled narrative, contributor lenses, product bank, progressive assembly, original interview answers | Subscription-to-have-a-voice and paid editorial prominence are older proposals; distinguish editorial participation from commercial publishing and distribution. |
| `docs/PUBLISHING_STUDIO_PRODUCT_STANDARD.md` | Concierge PR, source-grounded opportunities, readiness, publication history, truthful previews | Add raw media ingestion, episodic narrative discovery, follow-up assignments, collaborator-driven questions and project-channel outputs. |
| `docs/living-project-scaffold.md` and `docs/living-project-implementation-status.md` | Project lifecycle, tagging, dynamic hero experiments, feature gates | Historic timeline enum/field names conflict across documents; validate actual schema. Evolving editorial anchor must not silently overwrite designer-approved editorial. |
| `docs/12_INTELLIGENCE_SYSTEM.md` | Taste/intent signals and vendor insight layers | Permissioned overlap graph, installed-work evidence, demand matching and concierge introductions; distinguish suggestions from actual specifications. |
| `docs/Folio-Spotlight-and-Social-Publishing-Spec.md` | Explicit designer spotlight selection, publish-before-export, vendor independence, authorized invitations | Extend for project episodes and collaborator perspectives without weakening selection or sending rules. |
| `docs/17_IMAGE_PROVENANCE_GATE.md` | Contextual image rights, fail-closed public display, derivative provenance | Separate vendor-reference images from designer/photographer-owned in-situ media; later commercial sublicensing needs its own rights contract. |
| `docs/06_EDITORIAL_SYSTEM.md` | Existing editorial and publishing flows | Reconcile one-project/one-post assumptions with multiple publications per project. |

## Current implementation observations requiring verification

- `src/components/project/CreditsSection.tsx` currently renders linked credits and marks contributor perspective tabs as future work.
- `src/lib/post/getPostBySlug.ts` queries supplemental contributor commentary.
- Publishing Studio contains `story-service.ts`, `opportunities.ts` and `StoryActivity.tsx`; inspect behavior before claiming the new producer workflow exists.
- An older `src/components/projects/ProjectDetailPage.tsx` exists; identify the actual published public renderer before changing the interface.
- Living Project implementation-status documentation is historical and reports partial UI completion; it is not current production verification.

## Explicit non-goals for the next phase

No vendor catalog duplication; no paid product placements in independent editorials; no expiring story archive; no forced documentary length; no unrestricted private demand-data sale; no automatic collaborator outreach during pilot; no complete licensing marketplace; no full video-hosting/recommendation infrastructure in the initial channel rollout.

## Proposed next documentation actions

1. Audit current production renderer, project/post schema, Story Activity and publishing routes against these contracts.
2. Prepare a line-specific conflict table with source precedence, including existing September 2026 Spotlight overrides.
3. Update the appropriate existing specifications, retaining history and supersession notes; do not silently rewrite past decisions.
4. Define public channel states (first visit, return visit, sparse project, active project, completed project), owner publishing flow, and acceptance criteria.
5. Only then propose implementation phases and Codex work packages.

## Open design questions

- Should an episode be primarily a video, or a media-native chapter capable of mixing video, stills, narrative and audio? Proposed default: media-native chapter.
- How much episode assembly and public anchor promotion can occur automatically versus needing designer approval? Proposed default: draft automatically, publish/promote only after approval.
- Should free vendors be able to submit full factual corrections/context without paid branded publication? Proposed default: yes, subject to verification and moderation.

These questions were resolved by the founder decisions below.


## Founder decisions confirmed — 2026-11-07

1. **Episode format:** A media-native chapter combining video, photography, interviews, audio where available, and text. Video is not required to make a coherent episode.
2. **Approval:** Folio can automatically analyze sources, identify storylines and prepare drafts; the designer explicitly approves publication and project-anchor changes.
3. **Vendor boundary:** Free verified factual context and corrections improve the shared project record. Independent branded publications and commercial exploitation are paid capabilities.

These decisions supersede the three provisional questions above. They do not authorize automatic invitation sending, external publication, paid promotion, or commercial image reuse.

## Source-level documentation audit — second pass

| Source section | Finding | Disposition |
| --- | --- | --- |
| `15_SUPER_ARTICLES.md` lines 21-25, 170-205 | “Only subscribers can have a voice,” boosted vendors receive in-body editorial naming, and monetary tier controls ordering. Conflicts with the confirmed free factual-context boundary and editorial independence. | **Supersede for future design**, preserve historical text and September Spotlight exception. Distinguish factual participation, branded publication, licensed assets and distribution. |
| `15_SUPER_ARTICLES.md` lines 67-108, 206-249 | Compiled article, contributor lenses, product bank, progressive assembly and regenerations are already envisioned. | **Retain**, but make contributor additions create versioned proposed revisions subject to approval rather than silently replacing published work. |
| `15_SUPER_ARTICLES.md` lines 287-320, 347-432 | Role-specific prompts, raw-answer preservation, and multiple media formats anticipated. | **Extend** with event/issue/resolution memory, follow-up prompts across contributors, media-native episodes, source timecodes and story gaps. |
| `PUBLISHING_STUDIO_PRODUCT_STANDARD.md` lines 1-55 | Source-grounded concierge PR, truthful previews, one actionable question, saved publication history and external-post confirmation already required. | **Retain as current UI contract**; extend its opportunity types to episode arcs and missing-footage requests without implying existing support. |
| `06_EDITORIAL_SYSTEM.md` lines 9-80 | Current editorial journey and authority boundaries; project post publication is distinct from drafts and other records. | **Retain** and audit model constraints before specifying multiple episodes per project. |
| `12_INTELLIGENCE_SYSTEM.md` lines 976-1228 | Vendor analytics, content opportunities, interviews and distribution already described. | **Extend** with linked installed-work and permissioned specification intelligence; do not confuse inferred interest with actual specification or consent. |
| `living-project-scaffold.md` lines 8-100, 199-239 | Historical project-intent fields, living flags, and automatic dynamic hero swapping. | **Audit against current Prisma and UI**. Dynamic feed-thumbnail selection must remain separate from designer-approved public editorial anchor. |
| `17_IMAGE_PROVENANCE_GATE.md` lines 15-75, 110-127 | Strong vendor-reference image privacy gate and unknown-source fail-closed policy. | **Preserve**. It is not a complete commercial license for designer/photographer project photography. |
| `Folio-Spotlight-and-Social-Publishing-Spec.md` sections 1-2 | Designer-selected spotlight, publication before export, vendor independence, and explicitly authorized invitations. | **Preserve as higher-priority adopted constraint within its scope**. |

### Required implementation verification before editing normative specs

- Determine actual public project page routing and whether the legacy ProjectDetailPage is used.
- Inspect current Prisma relations and publication storage: `ProjectPost`, `ProjectModule`, studio story/activity models, media and contributor entities.
- Inspect `src/lib/publishing-studio/story-service.ts`, `opportunities.ts`, `StoryActivity.tsx` and associated tests for reuse.
- Establish how to represent watched episode progress, dated archived stories, multi-format episode assets, and milestone anchor approvals without conflating source and output.
- Keep all migration and rollout decisions in a separate implementation plan.

### Precedence

This founder-confirmed product direction governs **future planning** where it conflicts with older unimplemented proposals. Existing production behavior, adopted Spotlight consent rules, security safeguards, and published contract requirements remain binding until explicitly revised and tested.


## Step 1 — Current Prisma relationship audit (read-only, 2026-11-08)

Inspected `prisma/schema.prisma` on main and the current `/p/[slug]` and `/project/[id]` routes. These are schema/code findings, **not** verification of production migration state or deployed behavior.

| Entity | Verified schema facts | Channel implications |
| --- | --- | --- |
| `Project` | Has `timeline ProjectTimeline?`, `post ProjectPost?`, `stories Story[]`, `modules ProjectModule[]`, `participants ProjectParticipant[]`, `media Media[]`, `contributions Contribution[]`, `images`, `rooms`, `projectProductTags`, and design-journey relations. | Strong central project object. Canonical media/episode association remains undecided. |
| `ProjectPost` | `projectId @unique`; status, slug, `heroAssetId`, `expandedBlocks`, provenance and credits; related `SupplementalQuote` and `StoryThread`. | Exactly one primary editorial post per project; don't reuse it as every episode. |
| `ProjectModule` | Many per project, `type` enum `ARTICLE/STORY/SHORT_VIDEO/LONG_VIDEO/GALLERY/BOARD/TIMELINE`; flexible `media Json?`, `pinned`, `isPrimary`, `isAiCompiled`, `publishedAt`. | Candidate output container, but lacks formal ordered episode membership, revision approval and source provenance. |
| `Story` | Video URL, thumbnail, duration, `createdAt`, nullable `expiresAt`, `isPinned`, designer, optional project. | Existing video story is not yet a permanent mixed-media story archive; expiration behavior must be audited in runtime. |
| `Media` | Hosted/external URLs, transcript, quotes, project link, `publishedAt`. | Reusable media building block, but no verified episode assembly or source-timecode relationship. |
| `EditorialStory` / `EditorialStoryRevision` | Owner/org, format, status, published revision; revisions have blocks, interview, approvals, consent scope, sources. `EditorialStorySource` joins revisions to **ProjectPost**, not arbitrary private project media. | Existing versioning and approval should be reused; in-progress project source eligibility needs explicit private access and separate publication gates. |
| `EditorialInterview` | `projectId @unique`; interview answers support follow-ups, product/image/room context and audio timings. | One canonical project editorial interview; multi-contributor interview needs a verified parallel or extended relation. |
| `Contribution` | User, role, topic, optional project/product, content, status, optional published post; unique `[userId, articleTopicId]`. | Useful voice system, not yet a general project event/contributor episode ledger. |
| `ProjectParticipant` | Project, optional org/user, side and role. | Participation is not equivalent to editorial consent, invitation authorization, or rights grants. |
| `SupplementalQuote` | Contributor role/user, question/answer, optional product tag, testimony class VOLUNTEER vs commissioned, linked to ProjectPost. | Supports attributed factual context; paid commissioned testimony already has separate provenance. |
| `StoryThread` | Proposed angle, contributing answers, narrative tension, perspective diversity, specificity and scoring; `readyThresholds` JSON defaults to minimum 3 contributors; optional article post. | Potential story-discovery seed. Its default must not become an episode eligibility requirement; smaller projects need solo stories. |
| `ProjectTimeline` | Actual enum `PAST/PRESENT/FUTURE`. | Supersedes historic scaffold's `ACTIVE` wording; avoid changing schema to match old docs. |

### Routing verification

- Public editorial route `src/app/p/[slug]/page.tsx` loads `getPostBySlug` and renders `StoryRenderer`.
- Authenticated project workspace `src/app/project/[id]/page.tsx` uses its own project header, tabs, publishing panels, media management and published-project home.
- Legacy `src/components/projects/ProjectDetailPage.tsx` must not be assumed to be the current public project-channel target.

### Step 1 implications and proposed next investigation

1. **Do not replace ProjectPost** or collapse episodes into it; keep the existing approved project editorial.
2. **Evaluate ProjectModule vs EditorialStory** as the publication layer; preserve versioned approval, source lineage and designer anchor control.
3. **Audit Story expiration** in queries, routes and UI before promising permanent archive migration.
4. **Audit contribution and participant authorization** before designing contextual invitation flows.
5. **Audit media storage and project visibility** for private in-progress story discovery; no automatic public exposure.
6. **Identify existing watch-state models** before proposing per-viewer continue-watching persistence.

No schema, migration, application, or production changes in this audit.


## Step 1 continuation — module retrieval and authorization risks (2026-11-08)

Read-only inspection of current code:

- `src/lib/modules/getProjectModules.ts` filters `projectId` and `publishedAt != null`; order is pinned, type, publication date. No explicit project `isPublic`/post-status condition in this helper. Callers must supply the access boundary; audit callers before reuse.
- `src/lib/feed/getRecentProjectModules.ts` and `src/lib/feed/getUpdatesCarousel.ts` query `ProjectModule` with `publishedAt != null` and type filters **without a parent-project visibility filter**. **Potential private-project media exposure**, conditional on whether private projects can have published modules and where those helpers are exposed. Requires focused route/caller and runtime test; not asserted as a proven leak.
- `src/lib/feed/getUpdatesCarousel.ts` already groups project STORY/SHORT_VIDEO modules into story-like circles. This is a useful UI foundation but not proof of durable watched/unwatched progress.
- `src/components/project/ProjectMediaHub.tsx` already renders a primary LONG_VIDEO, existing article, stories rail, galleries, boards and timelines. It is a potential adaptation point; confirm whether it is wired to live public `StoryRenderer`.
- `src/lib/authz/access.ts` resolves owner, designer, admin, firm membership and project participants. Participation confers project access, but is not itself invitation consent or editorial/publication approval. A `.catch(() => null)` fallback on participant lookup could hide schema failures; needs error-reporting review.
- Search found no `watchProgress` identifier. This **does not prove** no watch-state exists under another name; inspect related schema/routes before designing one.
- `Story.expiresAt` is nullable, but current module story rails use `ProjectModule`, a distinct model. Do not conflate them or assume existing `Story` records are publicly expired without inspecting callers.

**Priority:** Before exposing project modules as a permanent public channel, add verified parent-project visibility/authorization conditions at the server query boundary and tests for unpublished/private projects, regardless of module `publishedAt`. This is a security review item, not a production patch in this branch.


## Step 1 — Caller trace: module visibility (2026-11-08)

- `getRecentProjectModules()` is called by `src/app/feed/page.tsx` for the public updates feed. The helper filters module publication/type but **does not filter parent project visibility**.
- `getUpdatesCarousel()` is called by the same public feed page for the featured story-circle carousel. It likewise filters module publication/type but **does not filter parent project visibility**.
- Therefore this is a **confirmed missing authorization predicate on public feed query paths**, not merely an isolated helper concern. Exposure of actual private content remains unproven without a private project + published module fixture and runtime response inspection. Severity: high-priority pre-rollout validation.
- `getProjectModules(projectId)` is used by `src/app/api/posting/[slug]/route.ts`, which explicitly checks `post.status === PUBLISHED` and `post.project.isPublic` before returning the payload; that caller appears to enforce parent publication state. The helper is also used by staging `getPostForStaging`, whose access control must be assessed at its callers.
- `src/components/posting/PostView.tsx` renders `ProjectMediaHub` when modules exist. The current canonical `/p/[slug]` route instead renders `StoryRenderer`; this is a **parallel presentation path**, not proof that the media hub already appears on canonical project editorials.
- The feed's module `publishedAt` must not be treated as permission to reveal a private parent project. Proposed remediation: require `project.isPublic = true` and an eligible published parent post in **public server queries**, plus tests for private/draft parent projects and published child modules. Preserve legitimate staged previews through authenticated paths.

**No application fix has been applied.** Next: inspect the feed's actual access assumptions and route tests, story expiration callers, watch-state candidates, and contributor invitation/approval services.


## Step 1 — follow-up verification: story lifecycle, staging and publishing (2026-11-08)

**Confirmed from code:**
- Public `src/app/feed/page.tsx` uses the unscoped `getRecentProjectModules()` for `/feed?mode=updates` and `getUpdatesCarousel()` for the default featured mode. Neither caller performs an additional access check. **High-priority authorization gap in query construction**, with actual private-data exposure still requiring a fixture and response test.
- `src/app/api/posting/[slug]/route.ts` checks both published post status and `project.isPublic` before calling `getProjectModules`; retain this as a reference for public read gating.
- `src/app/project/[id]/page.tsx` performs `assertProjectView` before rendering `PublishTabContent`, which calls `getPostForStaging`. This **known caller** supplies an authorization boundary even though `getPostForStaging` itself has no user argument. Do not expose staging helper through an unauthenticated route.
- `src/lib/publishing-studio/story-service.ts` sources only published public projects for its Story Activity, and `publicStory` checks the approved published revision and the current visibility of every source project. This is a strong existing source-revocation pattern to reuse.
- `Story.expiresAt` exists in schema but no direct `story.expiresAt` reference was found in indexed source search. This is insufficient to prove expiration is enforced or unused. Existing public update circles are based on `ProjectModule` instead.
- No direct indexed matches for `watchProgress` or `watchHistory`; continue-watching should be treated as **not verified**, not categorically absent.
- `EditorialStoryRevision` already records `approvedById`, `approvedAt`, `publishedAt`, `consentScope`, and source snapshot digests. Good candidate approval mechanics for episode revisions; `ProjectModule` does not have equivalent revision fields.

**Architecture decision deferred pending implementation design:** Use versioned approved editorial revisions as the publication authority and modules as possible project-channel presentation projections; do not automatically create duplicate episode stores. Episodes may include source references to authorized private media, but public projection must never reveal raw private sources unless explicitly approved.

**Next proposed engineering task (separate from this documentation branch):** Add parent-project publication/visibility filtering to both public feed module queries, add negative authorization tests (private parent with published child; unpublished parent with published child), and confirm that legitimate public project updates still render. Treat this as a security fix requiring authorization to implement/merge, not an unreviewed docs change.


## Step 2 — Editorial and episode reuse recommendation (2026-11-08)

**Read-only code basis:** `src/lib/publishing-studio/story-service.ts`, `activities.ts`, `opportunities.ts`, `src/lib/post/getPostBySlug.ts`, `src/app/p/[slug]/page.tsx`, `src/components/posting/PostView.tsx`, `src/components/project/ProjectMediaHub.tsx`, `src/lib/feed/getUpdatesCarousel.ts`.

1. **ProjectPost remains the canonical primary project article**, with its one-to-one project relation, approved hero and editorial blocks. Do not overload it to represent episode N.
2. **EditorialStory + revisions provide a credible approval/versioning backbone**, but Story Activity is currently text/Q&A-oriented and its source join points to `ProjectPost`. This is not yet a native multi-asset episode store. Extend sources to private authorized project media/events with per-source public eligibility rather than changing public story reads to accept private sources indiscriminately.
3. **ProjectModule is an existing multi-output presentation layer**, including stories, short/long video, galleries and timelines. Its `media Json` and published timestamp do not replace a versioned episode composition with source citations, contributor permissions and designer review.
4. **StoryThread already expresses narrative opportunity signals** but its three-contributor readiness default is unsuitable as a universal episode gate. Use optional signals; episodes may have one credible narrator and one compelling event.
5. **Current public project article is `StoryRenderer`**; `PostView/ProjectMediaHub` is a separate route/presentation path. Public channel UX should have one canonical rendering integration and one server-side approved projection, rather than two divergent experiences.
6. **Continue watching is not verified**; it will need explicit stable episode identifiers, ordered chapter list, per-viewer progress, and anonymous fallback without leaking identity.
7. **First milestone should be source-aware story opportunities, not automatic video cutting.** A project event can hold expected outcome, observed change, issue, resolution, time, evidence, participants and permission state. Folio proposes an arc and missing evidence; designer approves any public publication.

**Suggested design layering (subject to implementation spec):** `Project` as authority → project evidence/events and interviews (private by default) → source-backed StoryOpportunity (draft) → versioned Episode/Editorial publication (designer-approved) → ProjectModule/public channel projection (only approved, authorized media). Keep the public project anchor independently approved. Preserve existing Spotlight publish-before-export rules.

**Security branch status:** PR #851 merged as commit `18fd4b9f015af7168f7c15f8bb59e97883805814`; a production deployment was explicitly requested on Vercel, deployment `dpl_DKPedGpdPfAec4spHmWq9dY6jdSN`. Its state was BUILDING at last inspection, not yet READY. Do not claim live deployment until verified.


## Data-contract proposal (2026-11-08)

See [Living Project Episode Data Contracts](LIVING_PROJECT_EPISODE_DATA_CONTRACTS_2026-11.md) for source-backed ProjectEvent, StoryOpportunity, Episode, ProjectAnchor, StoryArchive/WatchProgress and contributor participation contracts, plus phased implementation and acceptance criteria. This is a proposed architecture, **not** an authorized schema migration or implementation. The recommended first slice is private project evidence → grounded event/change → useful story suggestion, preserving existing publishing and approval behavior.
