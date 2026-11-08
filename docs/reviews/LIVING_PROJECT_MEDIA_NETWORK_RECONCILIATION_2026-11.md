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
