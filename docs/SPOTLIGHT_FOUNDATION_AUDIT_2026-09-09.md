# Product spotlights and social publishing: foundation audit

9 September 2026. Delivery sequence step 1 of the [founder specification, revision 1.1](Folio-Spotlight-and-Social-Publishing-Spec.md).

## Outcome and baseline

The founder specification is adopted as the scoped product authority. Conflicting canon is reconciled. Application implementation has not started. This foundation serves the core designer interview → approved project data → published media loop; payments, guaranteed featuring and launch payouts are outside this milestone.

Fresh fetch found PR #765 merged at `8af4ce97`. The previous checkout `b58772bc1a54b7b1c0152d8acf0583c6c9c31c8d` was the merged hardening head. Fast-forward to main changed no tracked file content. Work is on `codex/spotlight-spec-foundation`. Pre-existing untracked local files were preserved.

The [static entry-point inventory](audits/SPOTLIGHT_ENTRY_POINTS_2026-09-09.md) scans all 2,144 TypeScript/TSX files under `src`, groups matching source references and enumerates 103 adjacent route-name candidates. It includes real handlers without known UI callers. This is a static discovery artifact, not proof of every dynamic/external caller or deployed behavior. The concentrated findings below were checked against source. No deletion is authorized by a missing repository caller.

## Canon reconciliation

| Document | Adopted change |
|---|---|
| `05_WORKFLOWS` | Explicit selection, answer approval, spotlight publication, separate social publication/export and invitation send. |
| `06_EDITORIAL_SYSTEM` | Keep the existing article pipeline; add dependent spotlight/social lifecycles and withdrawal. |
| `12_INTELLIGENCE_SYSTEM` | Intelligence can suggest selection, but cannot schedule product questions or authorize contact. |
| `15_SUPER_ARTICLES` | Optional separate joint piece; vendor state cannot control original designer outputs. |
| `16_DESIGNER_SHOP_SYSTEM` | New tags do not activate public Shop/testimonial records; approved published sources do. Preserve legacy public entries. |
| `16_ATTRIBUTION_CONSENT` | Version-specific wording approval and recipient-specific send authority remain distinct. |
| `17_INTERVIEW_PROMPT_CANON` | One shared explicit-selection policy across question lanes, follow-ups, caches and alternate paths. |
| `20_PRODUCT_NAMING_GATE` | Withdraw subscription-selected questions and descriptor loopholes; approved spotlight room prose can name unpaid products. Keep unrelated paid prose policy. |
| `21_ASSET_MATRIX` and delta | Parent plus exact social-piece version publication before full-resolution export; no automatic retirement of old paths. |
| `22_PRODUCT_RECORD` | Public approved spotlight excerpts are independent of vendor claim/payment; commissioned research remains separate. |
| `23_HEADLINE_FRAMES` | Interpret paid naming references through the room-scoped spotlight exception. |

Historical material is explicitly subordinate where it conflicts. These edits describe required behavior, not current enforcement. No runtime prompt was changed during this step.

## Tagging and canonical room identity

Mounted/manual paths include `src/components/AdvancedTagProducts.tsx` via `src/app/designer/project-tagging/page.tsx`, and `src/components/project/ProductTagPicker.tsx` via `src/app/project/[id]/TaggingSection.tsx`. The latter also creates/moves/deletes tags directly. `src/components/ProjectCreationModal.tsx` also writes tags. All must offer or preserve the same selection contract, including edits and existing tag review.

`src/app/api/tag-product-to-image/route.ts` currently creates active ShopProduct records when `addToShop` is submitted, synchronizes quotes through `src/lib/syncTestimonials.ts`, and invokes `createInContextBoostOpportunity`. Its optional Selection backfill finds a room by name. The new draft path must postpone public/notification effects and use confirmed canonical room IDs independently of Selection success.

Automated/import writers include `src/app/api/posting/project/[projectId]/auto-tag/route.ts`, pending-tag placement/verification, extraction confirmation, and room generated-image tagging. They must preserve attribution and finish information without inferring spotlight selection. The inventory lists every text-matched tag writer. `AdvancedTagProducts` references a DELETE URL with a tag-id path, whereas the central handler and TaggingSection use a query-ID URL; verify actual edit/delete behavior during the tagging milestone rather than assuming these are identical paths.

Prisma already contains Room and ProjectImage's structured room relation, alongside legacy image room strings. ProductTag belongs to image/product and has finishRaw/finishCanonical/finishConfirmed, plus an optional Selection. ProductTag itself has no canonical spotlight or room FK. ProjectProductTag is a separate historical model with roomName; do not treat it as the same source merely because its name resembles ProductTag.

Recommended direction: a distinct spotlight source record with publishing identity/project/product/confirmed room, explicit state and linked photo tags. The identity must distinguish actual variants/finishes where necessary. An unresolved room remains actionable before question scheduling. Final unique keys, ownership representation and relationship constraints require schema design; no SQL is proposed or applied here.

## Interview graph and source integrity

The current InterviewModal uses `useInterviewQuestions` and `useRoomInterviewQuestions` → posting interview questions route → `src/lib/editorial/getInterviewQuestions.ts` → project and room generation. `generateAllRoomQuestions.ts` still reads room selections and resolves subscription naming. Its nominal total of 20 with minimum room budgets is not a strict maximum. The flattened path slices by maxTotal. Neither mechanism can be used to discard required selected spotlights.

Shared generators are `src/lib/interview/generateProjectQuestions.ts`, `generateAllRoomQuestions.ts` and `generateRoomQuestions.ts`. Persona/rules are already centralized under `src/lib/interview/prompts`; add policy there and enforce eligibility outside the model. No additional persona is needed.

InterviewModal calls all three posting follow-up variants: generic, single and batch. DraftsPanel also calls generic follow-ups. Single follows tagged-product context, supports covered/morphed updates and caches by project/question. Batch consumes caller roomTags and encourages pursuit of mentioned products. Generic has project-scoped fallback caching. All require persisted parent scope, fresh selected-state resolution, source validation and policy-sensitive cache keys. Preserve voluntary answers without pursuing unselected products.

The legacy `/api/interview/start` still delegates into shared generation; respond/complete remain route handlers despite old UI retirement. RealtimeInterviewView calls `/api/interview/realtime/session` and conversion; its session instructions and transcript conversion are a separate enforcement boundary. Recorded media/interview routes, prompted-content questions and biography generators are listed as adjacent lanes to classify carefully: applying a project product-selection rule must not disable unrelated biography or separately commissioned vendor interviews.

Persistence is more than adding IDs to model output. Existing question sets/signatures live in project provenance. `EditorialInterviewAnswer` is a projection with unique `(interviewId, questionId, isFollowUp)` identity, but its row IDs can be rebuilt. A new revision must not reference a reminted projection ID as immutable source history. Define a durable answer-version reference based on the actual provenance lifecycle before designing FKs. Reconciliation must preserve answered IDs, retire deselected active questions and require confirmation for answer reuse. Cached model coverage is not confirmation.

The first end-to-end acceptance milestone is tagging selection → persisted confirmed room/source → exactly one required base question per spotlight, exclusion of every other product, safe failure/fallback, answer/resume/deselection correctness. Approval/publication state must be designed before exposing public surfaces, even though surface synchronization comes next.

## Publication, Shop and testimonials

Existing article transitions converge through `src/lib/editorial/lifecycle.ts`, called by posting status and project actions, with compatibility approval publication routes. `src/app/actions/projects.ts` also supports a project without an article. Preserve both publishing paths and existing role/readiness gates. Neither may silently complete a draft spotlight. Add explicit deferred-draft review and the later spotlight publish action.

ShopProduct has a unique designer/product key, one projectId, one quote and quoteApprovedAt. ProductTestimonial is one-to-one with ShopProduct. These semantics cannot preserve several independent project/room explanations merely by overwriting the current quote. Reuse ShopProduct as a presentation aggregate, backed by separately retained spotlight/revision sources and a lead-source selection. Decide testimonial projection shape without discarding existing rows.

`src/lib/syncTestimonials.ts` selects quoteApprovedAt in the single-sync path but only gates on quote/isActive; batch sync likewise does not establish revision approval. Direct Shop update/delete routes also call it. Public consumers include product testimonials, designer Shop, profile Shop and product testimonial components. A nonempty quote is not approval, and quoteApprovedAt alone cannot identify an immutable approved revision.

Existing public records must stay labeled legacy until explicitly reviewed. Do not backfill selected spotlights from product prominence, paid state or arbitrary tag counts. Draft edits preserve the published revision until approval/publication; withdrawal removes only dependent sources and must not erase another project's spotlight for the same product.

## Native social object and export boundaries

ProjectModule has project/creator, media JSON, type and publishedAt. It already feeds native modules, making it the preferred object to extend rather than introduce a competing feed model. It currently lacks a stable piece slug, immutable reviewed versions, published-version identity, source revision relations and render manifest/state. InstagramExport records configuration/history and generated/exported status, not native piece publication. Reuse is plausible, but not implementable by interpreting `publishedAt` or `status: generated` as approval.

No direct `projectModule.create/update/upsert/delete` call was found by the source sweep; this does not exclude nested, external or historical writers. Inspect any such producers before changing module semantics. Existing historical modules must not become implicitly approved exports.

| Delivery surface | Source finding / required treatment |
|---|---|
| `/api/instagram/export` | ZIP path uses project-view authorization, accepts selectedQuotes strings, gathers tag products, and supplies products only at four or more. Add publishing-identity authority, exact approved sources/version and one-product support. |
| `/api/instagram/slide` | Same broad view authority and caller quote input; returns downloadable base64. Must share the export resolver. |
| `/api/instagram-export/generate-images` | Checks PUBLISHED parent post and direct owner/designer, accepts caller image URLs/config and returns final base64 while saving InstagramExport. Add current parent visibility, studio permission, source IDs and separately published version. |
| `/api/instagram/campaign/preview`, `/generate` | CampaignWizard is referenced by ProjectHero/ProjectHeader. Preview and generation are real boundaries, not safely deletable legacy files. Classify payload resolution and guard final assets. |
| Client download controls | Old InstagramExportModal fetches individual slide assets; newer editor has separate export controls. UI visibility is not authorization. |
| Future video/job delivery | No complete versioned social video export flow was established by this audit. Enabling a format requires the same gate at completion and signed-link delivery. |
| Other export routes | The inventory includes spec sheets, CSV, tearsheets, account and event exports. Do not indiscriminately apply social-publication rules to private utility exports; classify the actual artifact. |

Define one shared resolver returning PROJECT_NOT_PUBLISHED, SOCIAL_PIECE_NOT_PUBLISHED, REVISION_NOT_PUBLISHED, SOURCE_UNAVAILABLE, RENDER_NOT_READY or FORBIDDEN. Check current publishing authority, parent, piece, requested published version, approved live sources and render readiness again at asset delivery. Use private storage and short-lived authenticated delivery; do not expose full-resolution assets via draft previews. Idempotency must cover publication/feed indexing and retryable rendering without turning retries into new pieces.

## Feed, permissions and source assets

`src/lib/feed/getRecentProjectModules.ts` and `getUpdatesCarousel.ts` are consumed by `src/app/feed/page.tsx`. Both filter module publishedAt but omit parent visibility predicates. `src/lib/modules/getProjectModules.ts` likewise only filters the module and is called by the posting slug API. Add parent and published-version checks at the shared query boundary, not only in components.

Other consumers to reconcile are `src/lib/homepage/getHomepageData.ts`, `src/lib/feed/getPublishedProjectPosts.ts`, homepage/feed APIs, profile/user feed APIs, both org feed API families and profile feed components. Existing profile feeds also combine other content types: inserting piece variants as independent items would duplicate feed presence. Inventory does not imply these queries currently display social pieces. Define a stable landing page displaying the actual media before signup, then profile/feed indexing and diversity limits at piece/project level.

Authority boundaries already include `src/lib/authz/access.ts`, `src/lib/permissions.ts`, `src/lib/orgPermissions.ts`, project publication checks and collaboration-specific auth. `assertProjectView` can admit participants and is not export permission. Direct owner/designer-only checks omit established studio capabilities. Resolve the actual publishing identity and current active role server-side for each mutation/export.

Naming is implemented under `src/lib/naming/resolveProductNaming.ts`, `applyProseNamingGate.ts` and `scrubProse.ts`; generation/regeneration callers are in the inventory. Extend the context by approved source and canonical room, not a global paid/nonpaid switch. Preserve quote provenance and image permissions independently. Retained recorded media is private under the previously approved media contract; it is not automatically social-export licensed. Detailed source-asset storage and preview resolution checks remain required before exporting new formats.

## Vendor opportunity and collaboration reuse

The tag route's boost helper can create notifications and send rep invitations through `src/lib/boost/inContextBoost.ts`. Do not reuse that automatic behavior for spotlight selection. Existing boost business flows remain distinct; separate the new explicit-send path deliberately rather than deleting unrelated functionality.

CollaborationStory already has a slug, vendor organization, designer, round JSON, content and approval-related status. Existing approve/publish handlers and magazine landing page are real reuse candidates. They lack a linked immutable spotlight revision and immutable assembled-version approvals. In particular, the current publish handler treats status/publishedAt as readiness evidence; do not transfer this as proof that both contributors approved the exact new joint version.

CollaborationRequest is a separate commissioned/priced record. Vendor invitation/signal/contact models and recorded InterviewSession/Boost routes have different ownership and authorization semantics. Canonical vendor claim work from the merged baseline remains authoritative: do not create synthetic vendor users or infer organization identity from similar names/domains.

Recommended direction: derived VendorOpportunity references public source records under verified vendor identity, with provisional unresolved internal evidence; separate recipient-specific invitation authorizations and delivery history. Deduplicate tags, projects, contributors, source versions and format retries. Store metric definitions/windows; omit uninstrumented metrics. No counts from this audit establish demand or revenue. Refresh on source/publication/identity changes and remove withdrawn excerpts from live evidence without deleting audit history. Build the cleared public evidence preview and coordinated review before enabling sends. No automatic reminders at launch.

## Ordered implementation and acceptance gates

1. **Foundation (this change):** adopt spec, sync baseline, reconcile canon, inventory paths and record design boundaries.
2. **Canonical draft selection:** perform read-only production column/FK/migration/data recon; print exact proposed schema blocks/SQL for review. Implement identity, room/source links, creation/edit review and legacy-preserving migration behavior only after applicable approval. Before schema edits back up schema; restore and stop on format/validate/generate/migrate-status failure.
3. **First end-to-end milestone:** shared eligibility/scheduling, bounded generation, no silent caps, exclusion checks, policy-aware caches, resumed/legacy/realtime enforcement, answer preservation and confirmed reuse. Demonstrate ten tags/two spotlights, zero spotlights, repeat tags, multiple rooms, missing Selection, unresolved rooms, counts above budget, model failure, voluntary unselected mention and deselection races.
4. **Approved spotlight publication:** immutable source/version approval, Shop and testimonial projections, optional correct-room article inclusion, explicit deferral, revision/withdrawal and idempotent retries. Test absent/unpaid/declined/opted-out vendor across every independent designer output.
5. **Optional collaboration:** evidence aggregation and cleared review, exact recipient/message authorization, verified access, opt-outs/concurrency; separate joint draft/contributions/both-version approvals. Failures never block designer publication.
6. **Native social publication and universal gate:** extend ProjectModule if detailed design confirms viability, add immutable versions/manifest/jobs, stable landing page, publish-before-export across every exposed old/new path. Test parent-only publication failure, stale versions, tampered quotes/assets/studio IDs, retry deduplication and withdrawal at delivery.
7. **Media quality and discovery:** one decision carousel, one single-product layout, then captioned still-photo video, feeds/landing actions and attributable metrics. Visual review on mobile and curated semantic interview evaluations supplement deterministic service tests. Format variants must not multiply feed posts.

These gates map to all section 11 acceptance families. No feature tests, model evaluations or browser/media quality acceptance are claimed by this documentation change. Do not enable new social exports until their gate is universal. Payments and earned featuring remain separate.

## Verification and limits

- Fresh fetch and fast-forward completed; baseline source matches merged main.
- `node scripts/phase5e-check-plan.mjs`: 32 grandfathered loose SQL files, zero phantom delegates, zero empty migration folders, zero recent non-idempotent patterns. No baseline/schema/migration changes.
- `prisma migrate status` after sync: 107 migrations, database schema up to date. Initial sandbox execution returned a schema-engine error; the approved read-only execution succeeded.
- Static inventory source paths and local Markdown links resolve, the supplied specification is preserved verbatim from its title onward, and `git diff --check` passes. Migration discipline CI mode also passes against the existing 32/0/0/0 baseline.
- No application, schema, database data, storage, vendor-contact or publishing mutation. No live model/media calls. A build is not meaningful proof of canon changes and was not rerun.
- Production Upstash deployment proof and live renderer/media feature gates from the hardening work remain separate; this audit neither resolves nor reopens them.
- Before schema authorship, still perform table/column/FK and aggregate legacy-data recon. Before implementation completion, trace dynamic/external entry points, nested writers, source grants, exact studio identity and runtime flows. Static absence is not proof of retirement.
