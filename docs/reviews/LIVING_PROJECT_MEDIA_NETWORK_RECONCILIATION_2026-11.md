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

These are questions for confirmation, not blockers to further audit.
