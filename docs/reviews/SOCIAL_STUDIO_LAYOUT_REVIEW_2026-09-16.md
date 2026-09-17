# Social Studio: layout review and proposed landing experience

Status: review and proposed UX specification, not implemented. Scope is the published-project social entry and the supplied project's Instagram editor. This supports Folio's core value by turning approved project knowledge into reusable designer media. Follow `docs/Folio-Spotlight-and-Social-Publishing-Spec.md` revision 1.1 for source and publication rules.

## Evidence and limits

Both supplied URLs are identical and open `/designer/projects/a00c6aee-0730-474e-b55b-abd6d3f9bdc7/instagram`. Browser navigation reached sign-in; the only available browser is signed out. Production visual inspection and the actual two originating clicks remain unverified. The following findings are from the current local source, not claims about a deployed revision.

| Finding | Evidence | Recommended correction |
| --- | --- | --- |
| Developer comments become visible text | `InstagramExportEditor.tsx:281` and seven occurrences in `SlidePreview.tsx:89–162` place `/* folio-design-system: off-scale */` in JSX text. | Use JSX comment syntax; verify all slide types and the header contain no annotation text. Check exported assets separately because their renderer differs. |
| Workspace is left-heavy and cannot adapt to narrow screens | Editor lines 351–384 put a 340px preview, 48px gap and 380px controls in a 1280px container, with no centering or stacking breakpoint. Room buttons also lack wrapping/scroll handling. | Use a centered responsive workspace; stack preview and controls on small screens; make room navigation scroll within its own row. |
| Format control misrepresents the preview | `SlidePreview.tsx:190` fixes the canvas to 340×425; the editor does not pass the chosen aspect ratio. | Drive both preview geometry and export from the chosen ratio; verify square, portrait and story, including crop and safe areas. |
| Campaign and carousel have inconsistent navigation | `PublishedProjectHome.tsx:145–146` links the carousel to a page but opens `CampaignWizard` for campaign. `ProjectHero.tsx` has the same distinction. | One named Studio entry; stable destinations inside it. Verify deployed behavior before attributing the reported duplicate destination to these handlers. |
| Campaign can exceed short viewports | `CampaignWizard.tsx:202–203` centers a content-height modal with no maximum height or vertical scrolling. | Prefer a campaign page; if retained temporarily, bound the dialog height and scroll the body while preserving actions. |
| Browsing the editor triggers generation | Editor mount invokes headline and bio generation; selecting a headline triggers caption generation. | Studio landing loads existing work and source readiness. Generation follows an explicit story choice/action. |

Also cover in the cleanup: slide index becomes invalid when the slide list shrinks; returning from a room to Full Project does not restore project image selection; regenerated room headlines do not replace an already selected headline. These are source-observed state risks requiring interaction tests, not live reproductions.

## Organization revision — 17 September 2026

The founder clarified that Studio is a practice-wide destination merging the dropdown's Editorial Queue with posts and campaigns. Project entry points open filtered views of that same destination. The project-only landing proposal below is superseded by this organization. No screenshot was attached to the follow-up; navigation and queue findings come from local code.

### One hub, two ways in

Founder-approved menu name: **Publishing Studio**, with supporting copy “Your editorial stories, social posts, and campaigns.”

- Dropdown → `/designer/studio`: overview across all accessible work in the active personal/studio publishing identity. Default to all projects on entry from the global menu, not the last project's filter.
- Published project → **View campaigns** → `/designer/studio?view=campaigns&project=<id>`: campaigns involving that project, with its filter chip visibly selected and an **All projects** escape.
- Optional **Create a post** shortcut → the same Studio creation flow with that project's sources preselected.
- `/designer/queue` → Studio's Editorial view; preserve existing notifications and bookmarks. Existing specific Instagram links retain their carousel workflow rather than losing their intent.

Project pages remain convenient context, but are never a prerequisite for creating or finding posts. Preserve view/filter context when returning from editing. Use “Project” consistently with the existing product; job means the same filter, not a second entity.

### Clarification: project visibility and shared work

The project page retains a useful **Social & campaigns** section showing that project's actual saved social pieces and campaigns, previews, statuses and Continue/View actions. It is not reduced to a link-only card. Include **View all in Publishing Studio** and contextual Create actions. Both surfaces reference the same records, approved versions and shared editing flow; creating or editing from either surface is immediately reflected in the other. Do not build parallel project and Studio workflows or copy records on entry.

An editorial post also has its own associated social campaign. For example, a published material study can have an introduction carousel, detail posts and a Q&A excerpt promoting that specific story. Studio therefore supports project campaigns, post/story campaigns and deliberately composed cross-project campaigns. Keep the source story and its derivative social pieces linked, with source/version and permission checks preserved. A campaign may promote a specific editorial post even when that post draws from several projects; its destination should be the relevant story or piece rather than an arbitrary project's top-level page.

### Cross-project editorial discovery is a core Studio capability

Publishing Studio combines management of existing work with proposed next stories. Give **Suggested stories** a prominent section in Overview and a dedicated ideas filter within Editorial. AI compares the designer's authorized body of work for repeated materials, related room decisions, recurring methods, meaningful contrasts and evolution, then proposes grounded editorial and social ideas. This extends the existing digest → signals → angles → questions foundation, rather than introducing a disconnected recommendation engine.

Each suggestion shows a working title, why Folio sees a story, the supporting project/room/photo references, suggested editorial/social treatment, and whether a short designer answer is needed. Actions: **Develop story**, **Create social draft** when the approved sources support it, or **Dismiss**. A suggested campaign can outline several related pieces without automatically generating or publishing them. Retain dismissed/used ideas so the same recommendation does not repeatedly reappear; refresh deliberately when relevant source work changes, with bounded generation and explicit error handling.

Illustrative proposals (not findings about the user's actual projects): a material study comparing natural stone across three kitchens; a Q&A about recurring approaches to compact rooms; a methods story comparing how two projects balance openness and privacy. Each can become an editorial post, social treatment, or a linked post-and-campaign package. Similarity is evidence for a question, not proof of designer intent or a fabricated quotation. Broad material studies remain distinct from product-specific spotlight testimonials; product-specific prompts and exports must respect the selected/approved spotlight rules.

Proposed lifecycle: evidence-backed idea → optional focused interview → reviewed editorial/social draft → publication → linked social campaign. Reuse existing approved answers where appropriate; ask only for missing perspective. The designer controls development and publication. A new or revised source can trigger renewed suggestions without erasing existing drafts, choices or approvals. Recommendation availability follows the existing corpus-maturity rules until explicitly revised; all other Studio work remains accessible below that threshold.

### Navigation and landing

Use four views: **Overview | Editorial | Posts | Campaigns**. Overview answers “What can I work on now?” with Continue working, Ready for review, and suggested next stories. Show recent work and creation actions for a new user without fabricated counts or empty dashboard widgets.

- **Editorial:** existing Folio recommendations, editorial work in progress and published editorial stories. A recommendation is an idea, not a finished draft. Completing editorial work can lead to **Create social post**, preserving a source relationship.
- **Posts:** individual social pieces across projects, including room stories and product/material spotlights. Carousel/story formats and aspect variants belong to a piece rather than creating disconnected copies in navigation.
- **Campaigns:** named, ordered collections of pieces, with project labels, actual piece counts and progress such as “3 of 5 published.” Create here without visiting a project. A single piece can stand alone or be referenced in a campaign; avoid duplicating its content or approvals.

Common controls: search; **All projects** selector; status filter appropriate to the view; sort by Recently updated, Project A–Z, or Needs attention. Group by project is optional. Keep project, content type and workflow status separate: a campaign is a collection, a material study is a story type, and a draft is a status.

Cross-project editorial pieces display all source project labels and match each applicable project filter, while appearing once in All projects. Practice-level profiles and methods may have no individual project: show **Studio-wide** as a source label/filter. Do not force every editorial item into one arbitrary job. In a filtered campaign list, show a matching multi-project campaign once with its full scope; never silently hide or export only some of its pieces.

### Creation flow

Global **Create** offers Post, Campaign and supported Editorial actions. For a post, choose the source project/room/approved spotlight, then the story and format; for a campaign, choose one or more accessible projects or existing pieces, then assemble the sequence. A project-context entry preselects the source but makes scope clear and editable. Suggested editorial angles may already span several projects and should retain that evidence.

Example: open Publishing Studio from the dropdown, filter to La Gorce and inspect its campaigns. Clear the filter and continue a material study involving La Gorce and a second job. Add eligible pieces from both to a campaign without navigating into either project.

### What the current implementation supports and what is missing

Verified source on 17 September:

- `src/components/navigation/UserMenu.tsx` exposes Editorial Queue at `/designer/queue`.
- `src/app/designer/queue/page.tsx` lists ideas and question previews, but **Answer & launch** only displays a coming-soon toast. Its **Refresh queue** calls the initial unlock path, which returns `already_unlocked` after successful initial generation; it is not a recurring refresh of recommendations.
- `src/app/api/editorial-queue/route.ts` fetches only recommended/in-progress items for `session.user.id`. It does not yet provide project filtering, published history or active-organization scoping.
- `DesignerAngle.evidence` retains source project IDs; `EditorialQueueItem` has status, output linkage and distribution-consent fields. The current queue response omits evidence/project labels. These are foundations to audit and reuse, not proof of a complete publishing flow.
- The three-published-story threshold in `src/lib/editorial-queue/unlock.ts` is for proactive editorial suggestions. It must not lock the central hub, existing work or manual social creation.

Merge the experience first, retaining distinct source records and lifecycles. Do not collapse ideas, published articles, social pieces and campaign exports into one database type just to display them together. Build an authorized aggregate listing with stable IDs, source project relationships, timestamps, honest statuses and supported actions. Scope all lists, search, counts and filters to the active authorized publishing identity; a client-side project filter is not access control. Explicitly audit existing campaign persistence and resume support before promising editable saved campaigns.

Folio publication and social distribution consent remain separate. Do not convert feed-only editorial consent into social permission. Project-derived pieces continue to require their published parent and exact approved piece version. Studio-wide and multi-project editorial derivatives need an explicit source/consent eligibility contract before external export is enabled; do not fabricate a parent project or weaken the existing project gate. Scheduling fields do not prove a working scheduler; omit calendar and automatic-posting claims until those flows are verified.

### Revised delivery sequence

1. Ship the already-identified cleanliness and responsive-layout fixes independently.
2. Introduce global Studio navigation, view routing and project filters; bring the existing queue into Editorial and inventory real saved posts/campaigns. Explain unfinished editorial actions honestly.
3. Complete editorial answer/review/publication and supported saved-post/campaign flows, with proper source and consent links; reuse approved material/product spotlights.
4. Consider calendar, external scheduling and broader distribution only after the core workspace works.

Additional acceptance: global entry shows all authorized projects; project entry lands on that project's campaigns; filter chips and All projects are obvious; creation works from the global hub; multi-project items appear once and match all relevant jobs; studio-wide work is findable; filters survive edit/back navigation; personal/studio switching never leaks content; fewer than three published stories does not block Studio; feed-only editorial consent never unlocks social export.

## Original project-entry proposal (superseded for hub organization)

Published project home has one card: **Social Studio**. Supporting text: “Create stories from your project, rooms, and approved spotlights.” Primary action: **Open Social Studio**. Keep product-list export and project details on the project home as already agreed.

Proposed owner URL: `/designer/projects/[id]/social`. The existing Instagram URL remains a compatible entry into the carousel workflow until existing links and unfinished work are safely accounted for. Do not silently redirect a specific carousel link to a generic landing page.

The Studio landing contains:

1. Compact project header, project thumbnail, and **Back to project**.
2. **Your stories** first when work exists: preview, story title/type, draft or published status, and the appropriate Continue / View / Download action. Group aspect-ratio variants within the same piece.
3. **Create a story**: Project reveal, Room story, and Product or material spotlight. Explain missing source readiness in place, with a link to complete the source. A project reveal works without spotlights.
4. **Build a campaign** as a secondary action: assemble and order several existing or newly prepared stories, review each, and export eligible pieces together. Show actual selected piece count. Suggested pacing is advice, not a scheduling or posting promise.

Story is the content choice; carousel is a format; campaign is an ordered collection of stories. This hierarchy removes the current ambiguity between two apparently equivalent creation links.

## Editor and review

Use one shared editor shell with project/story breadcrumb, save status, centered media preview, adjacent controls and a clear review action. At narrow widths, put the responsive preview above controls. Keep thumbnails bounded and horizontally scrollable. Long room names, studio names and captions must wrap without expanding the page.

Flow: choose source/story → choose supported format → generate private draft → edit and preview → **Publish to Folio & export**. Offer only formats that actually work. Video is a later increment unless an existing usable path is verified. Preview must represent the exported crop, typography and text placement; reuse rendering logic where practical rather than maintaining divergent visual templates.

Returning to the Studio must preserve saved work. Loading, failed rendering, missing sources and retry states must remain visible and recoverable. Existing saved work should not be regenerated merely by opening it. Choose a persistence implementation only after auditing existing social-piece/version storage; this proposal does not authorize a new schema.

## Materials and product spotlights

Use the existing spotlight model and source lifecycle. An identified tagged material or fabricated element can become a spotlight just like furniture or lighting; avoid inventing a separate material approval system. Show the confirmed room, contextual photo, identified material/product and finish, and approved designer explanation.

Every approved published spotlight should be discoverable as a Studio source. A single spotlight is sufficient for a standalone piece. Let designers combine compatible spotlights deliberately. Never promote ordinary tags or infer product testimonials from general article prose. Preserve exact quotations and their attribution; distinguish Folio prose from quoted speech.

Vendor enrollment, payment or response does not block the designer's independent story. Joint vendor collaboration remains separate and waits for its own contributions and approvals. No vendor messages are sent from source selection or Studio browsing.

## Publication contract

Reuse and verify the existing shared eligibility path before wiring final export. Both parent project and the exact approved social-piece version must be published, source permissions valid, and render assets ready. Every legacy/direct export route must obey the same condition. The public destination shows the actual carousel/video and caption with designer, project and spotlight links. Aspect variants do not create duplicate feed pieces. A campaign cannot make an ineligible piece downloadable merely by bundling it.

These are established specification requirements, not assertions that all existing endpoints currently satisfy them. Re-audit implementation before enabling the redesigned flow.

## Delivery order and acceptance

1. Clean visible annotations, responsive geometry, format preview, campaign overflow and related selection state. Verify independently of the larger redesign.
2. Introduce the Studio landing and consistent entry points, reusing existing story storage and supported creation flows. Preserve old deep links. Confirm exact production campaign and carousel clicks.
3. Integrate approved product/material sources and campaign composition into the shared story editor and publication flow. Defer new scheduling, automatic social posting, outreach and video infrastructure.

Acceptance checks: desktop at 1440px and 1024px; mobile at 390px and 320px; short viewport campaign access; no page-level horizontal overflow; no visible developer comments; all three aspect ratios correctly previewed; long labels and missing images handled; room→project reset; slide-count/bio changes preserve a valid selection; navigation and saved-state return; export matches preview; unpublished/stale/withdrawn pieces remain ineligible through direct and campaign routes. Complete a signed-in check of the supplied project before claiming the reported live issue is resolved.

## Review result

Code establishes real cleanup defects and an inconsistent navigation model. The proposed Studio landing coordinates project, room and material stories with the already-adopted source/publication specification. No application code, production data or deployments changed during this review. Exact authenticated visual verification is pending.
