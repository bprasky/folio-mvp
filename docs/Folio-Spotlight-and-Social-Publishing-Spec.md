# Product Spotlights and Social Publishing — founder specification

Adopted for implementation on 9 September 2026. Source: founder-supplied revision 1.1 dated 8 September 2026. The text below is preserved verbatim from its title onward; its original status and audit statements describe the source document, not implementation completion. This decision supersedes conflicting older canon only within its stated scope. Implementation baseline and discovery: [foundation audit](SPOTLIGHT_FOUNDATION_AUDIT_2026-09-09.md).

---

Folio: Product Spotlights and Social Publishing
Product specification and targeted implementation audit — 8 September 2026

Revision 1.1 — vendor independence, accumulated vendor evidence, and coordinated outreach.

Status: proposed implementation specification grounded in the founder's decisions in this conversation. No application changes, repository writes, vendor messages, or publishing actions performed. Source review covers selected files on main; it is not a runtime or exhaustive repository audit.

1. Product decision
Folio turns completed projects into media that helps designers gain attention, followers, inquiries, and product interest. Every externally exportable social piece must first exist as a published Folio piece, supplying both native feed content and a relevant destination for incoming visitors.

Product spotlights are explicit designer choices. A tag provides attribution. A spotlight adds the designer's explanation and connects the project to Social Studio, the designer's Shop, product-page testimonials, and optional vendor collaboration. Vendor payment never decides which products the designer is asked to discuss.

Binding requirements
Offer “Spotlight this piece” during tagging and when editing an existing tag.

Explain the interview, Shop, media, and optional collaboration benefits before selection.

Ask a specific interview question for every selected spotlight. Never automatically ask product-specific questions about non-spotlit products, even if their vendors subscribe or a model considers them interesting.

Keep normal project and room interviews. They may discuss space, atmosphere, layout, and the overall palette, but must not disguise an unselected-product question as a descriptor question.

Permit approved spotlight content in the designated room's article chapter. Do not require every spotlight to become an article paragraph.

Every completed, published spotlight must be available to Social Studio and the designer's Shop. Product-page use of the approved designer excerpt must retain attribution and its source project.

Ask who to invite to contribute the vendor's side. Saving a contact or selecting a spotlight does not send an invitation.

Require publication of the social piece itself, as well as its parent project, before delivering external export assets.

Publishing establishes eligibility for discovery; earned featuring remains separate from publishing and paid boosts.

Vendor membership, payment, response, and collaboration acceptance are never prerequisites for publishing the designer’s project or spotlight, activating its Shop entry, or publishing/exporting its social pieces. Only a joint collaboration piece waits for the vendor’s contribution and both parties’ approval.

Accumulate public, attributable evidence of vendor product use before enrollment, and coordinate outreach by verified vendor identity without expanding a designer’s send authorization.

Recommended defaults
These resolve implementation details without changing the requirements: spotlight selection is off by default; one base question per distinct spotlight with at most one optional clarifying follow-up; no silent spotlight cap; incomplete spotlights remain drafts; collaboration is optional; the parent project can publish while incomplete spotlight drafts are explicitly deferred.

2. Tagging experience
After product identification and room confirmation, show:

Spotlight this piece

“We'll ask you a specific question about this piece in your interview. After you approve your write-up and publish, it will appear in your Shop and be available for social stories. You can also invite the vendor to contribute.”

Secondary explanation: “Your approved words can appear on the product's Folio page, credited to you and linked to this project.”

Do not require a quote at tagging time. Allow an optional private note such as “Ask me about the custom finish” to steer the later question. Keep ordinary tag creation quick.

The tagging review shows selected pieces grouped by confirmed room, their linked photos, and their interview status. A designer can remove a spotlight without removing the underlying tag. Display the number of additional spotlight questions before starting the interview.

Identity and room placement
Use a canonical spotlight record, not independent booleans on every photo tag. Recommended scope: designer publishing identity + project + product + confirmed room. Multiple image tags for the same piece in the same room attach to one spotlight and create one base question. A use in another room can have another room-specific spotlight. Preserve product variant/finish information where it distinguishes the actual piece.

Resolve canonical room IDs. Do not rely on matching room display names or optional design-board Selection backfills. If a room is unresolved, ask the designer to assign it before scheduling its question or placing its article content.

Custom, vintage, discontinued, and unclaimed-vendor products remain eligible. Show honest availability or inquiry actions; do not invent a purchase link. A material or fabricated element can use the same spotlight flow once represented as an identified tagged item.

3. Interview contract
Two question lanes
Room/project lane: retain the existing project overview and room structure. Ask about spatial relationships, intent, use, composition, and overall atmosphere. Non-spotlit products remain visible in photographs and attribution, but are excluded from product-question candidates.

Spotlight lane: the server schedules one base question for each selected spotlight in its confirmed room. The model writes the question; it does not select which products deserve questions. Each question persists spotlightId, roomId, productId, sourceTagIds, linkedImageIds, questionKind, promptVersion, and stable questionId.

Do not let the room model also ask the same spotlight question. Product-specific topics belong to the dedicated lane, interleaved naturally within the room interview.

Shared prompt addition
Compose this policy through the existing canonical persona/rules modules. Do not create another interviewer persona.

Product questions are permitted only for the server-provided eligible spotlight IDs. For each scheduled spotlight, ask one grounded, single-topic question about the designer's choice or its role in the confirmed room. Use the identified product name when known regardless of vendor subscription. Do not presume praise, technical performance, or intent. Never ask about a non-spotlit product by name, brand, category, position, or visual descriptor. General room questions must remain about the room rather than a particular unselected object. If an answer mentions an unselected piece, preserve the answer but do not pursue that piece. A product-specific follow-up must retain the same eligible spotlight ID. Do not create testimonials from editorial prose.

Example with a selected pendant: “What made [pendant name] the right choice for this dining room?”

Example optional follow-up after the designer describes its scale: “Where did that scale make the biggest difference?”

With an unselected pendant, both “Why this pendant?” and “Why the brass fixture above the table?” are disallowed. “How did you want the dining room to relate to the kitchen?” remains allowed.

Guaranteed coverage and exclusion
Build the eligible set from current persisted state, never client-supplied lists. Allocate spotlight questions outside the general room budget. Existing question caps may reduce optional room questions, but may not silently remove selected spotlights. For large selections, batch and paginate generation while showing remaining work.

Validate structured output for exact spotlight membership, room association, missing coverage, duplicates, and valid source IDs. Also check question text for unselected-product targets: ID checks alone cannot catch a model asking about another object while returning an eligible ID. If validation fails, retry within a bounded budget, then use a safe deterministic question about the selected piece. For uncertain general-room questions, fall back to room-level wording. No prompt alone is a guarantee.

If the designer already answered a spotlight elsewhere, offer the existing answer for confirmation rather than asking twice. An AI “covered” or “morphed” decision cannot silently remove a required spotlight question. Record confirmed answer reuse against the spotlight ID.

Follow-ups, cache, and edits
Apply the same policy to single, batch, legacy reachable, resumed, regenerated, and background question paths. A non-spotlit product mentioned voluntarily may trigger a separate UI suggestion to spotlight it; it must not trigger another product question without selection.

Include spotlight IDs, room/product assignments, selected state, and policy version in persisted question signatures and follow-up cache keys. Preserve existing answered question IDs. Reconcile changed spotlights incrementally: add new required questions, retire deselected questions from the active plan, keep historical answers, and never erase unrelated work.

Resolve eligibility again when accepting follow-up requests. Reject stale product questions after deselection. Parent question scope and linked IDs are server-owned. One room's failure must not masquerade as completed spotlight coverage.

4. Answer approval and publication
Save the raw answer unchanged. Generate a concise proposed write-up and optional verbatim excerpt, each linked to answer ID/version. The designer reviews the exact public wording. Editorial paraphrases remain editorial text; only exact source spans appear as quotations. Spoken subtitles reflect actual audio if audio exists.

Spotlight states: SELECTED → ANSWERED → APPROVED → PUBLISHED. WITHDRAWN is a reversible public removal state. “Selected” alone does not publish a Shop entry or testimonial.

At project publishing review, show completed spotlights and unresolved ones. The designer must finish each unresolved spotlight or explicitly defer it as a draft. A deferred spotlight stays out of Shop and product-specific media until completed. An already-published project can receive a later spotlight through its own review/publish action.

Publishing a completed spotlight activates the approved version in Shop, product-page attribution, and Social Studio eligibility. Article inclusion is optional and must target the confirmed room. Allow exact product naming for the spotlight even for an unregistered or nonpaying vendor. Explicitly supersede the older paid naming policy for this case; paid status cannot introduce questions about unselected products.

Use transactional publication state plus idempotent background jobs for derived views. Failed testimonial/media synchronization is visible and retryable; it must not duplicate records or discard answers.

5. Shop, testimonials, and source integrity
Shop presents products with at least one active published spotlight and an approved write-up. Multiple projects or rooms may contribute different explanations to the same designer/product entry. Preserve those source relationships instead of overwriting one quote globally. The designer selects a lead excerpt; visitors can inspect its original room and project.

Product-page testimonials read the same approved version, attributed to the correct designer or studio, with a project link and context image when cleared for that surface. Approval requires an actual recorded approval of that version, not just a nonempty string. Editing creates a draft revision; current approved public words remain until the new version is approved and published.

Withdrawal removes the affected public spotlight and testimonial and disqualifies new exports that rely on it. Do not remove another valid project spotlight for the same product. Parent project unpublishing removes dependent public visibility. Previously downloaded external media cannot be recalled; future generation/downloads must respect current eligibility.

Product-page display within Folio is explained during approval. Paid amplification, external advertising reuse, and a vendor's own quotations are separate actions. A vendor cannot rewrite the designer's words.

6. Collaboration invitation
After approval, ask “Who would you like to invite to add the story behind this piece?” Offer a verified existing vendor contact, a designer-entered representative contact, or “Later.”

Show recipient, product, public spotlight preview, and invitation purpose before the designer sends. A draft project can store the intended contact, but invitations send only after publication and an explicit send action. Never infer permission to contact someone from tagging alone. Do not reuse the existing automatic tag-to-boost notification behavior for this flow.

Invitation states: NOT_REQUESTED, DRAFT, SENT, ACCEPTED, DECLINED, EXPIRED. Prevent duplicate sends across photo tags; rate-limit reminders. Verify the joining vendor's association before granting product or collaboration management access. Acceptance, not sending an email, constitutes enrollment.

The vendor receives a focused question about its contribution: fabrication, material, design intent, or application. Use only the public/on-record designer excerpt, never private notes. Vendor answers undergo their own review. Publication of a collaboration version preserves separate bylines and source links.

Offer boosting as an optional next step after a publishable story exists. Spotlight, collaboration, payment, and earned featuring have distinct states. No payment or guaranteed earnings is needed for launch spotlight value.

Vendor independence and the joint publishing boundary
The designer’s original project, spotlight, Shop entry, testimonial, and eligible social pieces proceed independently. A pending, declined, expired, or unanswered vendor invitation must never pause, hide, downgrade, or invalidate those outputs. Vendor subscription changes likewise do not change their eligibility.

Create a separate collaboration draft linked to the already-published spotlight. That joint piece requires an approved vendor contribution and approval of the assembled joint version by both contributors before publication. A vendor may correct its own contribution, but cannot alter the designer’s original words or control the original spotlight. The joint piece has its own publication/version state; it must not reuse the original spotlight’s published flag. Once published, its social exports obey the same Folio-first rule as all other pieces.

Accumulated vendor opportunity evidence
Maintain a vendor-specific opportunity summary before the vendor enrolls. Derive it from currently public projects and approved published spotlights, with links to the underlying records:

Distinct completed projects, designers/studios, products, and room applications.

Approved designer excerpts and their source project/spotlight revisions.

Observed product/spotlight views, saves, sourcing actions, and attributable inquiries where collected.

Existing collaboration invitations and their status, without exposing private contact information.

Separate ordinary tagged appearances from explicit spotlights. Deduplicate repeated image tags, alternate aspect ratios, and export retries. Show measurement windows and distinguish event counts from unique visitors; never infer purchases from clicks, external posting from downloads, or revenue from engagement. If a metric is not instrumented, omit it or label it unavailable. Do not present projections as observed demand.

The summary is an internal acquisition resource until vendor identity and access are verified. A recipient preview may include only the public evidence and aggregate activity cleared for that recipient; never private boards, unpublished answers, lead identities, or other designers’ contact details. Withdrawn content must leave the current opportunity summary. Keep delivery/audit history separately rather than leaving withdrawn excerpts in a live pitch.

Resolve evidence against a canonical vendor/brand identity. Do not merge companies solely because names are similar or domains match. Distinguish manufacturer, showroom/dealer, and sales representative where relevant; record which organization the spotlight concerns and which contact represents it. Unresolved identity can accumulate provisional internal evidence, but cannot trigger outreach or grant access.

Coordinated outreach
Maintain one vendor opportunity record with product/project/spotlight links and separate invitation records. An invitation retains the authorizing designer or studio, exact recipient, approved spotlight versions, and approved message scope. Group multiple authorized spotlight invitations to the same verified vendor and recipient into a coherent outreach package when permitted; never turn one designer’s permission into permission to contact on behalf of other designers.

Adding another tag or spotlight updates the evidence summary without sending a new message. For a vendor/recipient with an active invitation, show its status and offer an explicit update/review action instead of automatically sending a second invitation. Different verified recipients may require separate invitations; flag existing outreach so users can avoid overlap. Serialize send operations or use a uniqueness/idempotency constraint so concurrent publication cannot create duplicate sends. Proposed default: no automatic reminders at launch. Any later reminder policy must honor recorded authorization, declines, and opt-outs.

Vendor decline/opt-out suppresses further unsolicited invitation sends to that recipient, not the designer’s publishing rights. Evidence can continue to reflect legitimately public work. Reopening outreach requires an appropriate explicit action, never a new tag as a workaround.

Implementation additions
Extend the invitation workflow with a VendorOpportunity aggregation keyed to verified vendor identity (or a provisional unresolved identity), evidence references, metric definitions/windows, and last refresh time. Reuse existing vendor/invitation models where possible. Treat this as a derived view over source records rather than a new copy of designer quotes. Collaboration drafts reference the original spotlight and maintain independent contribution, approval, and publication states.

Add event-driven refresh/reconciliation for spotlight publication, revision, withdrawal, project visibility changes, and vendor identity resolution. Evidence aggregation and delivery failures must be retryable and must never block designer publishing or exports. Add the public evidence view and coordinated invitation review before enabling the new collaboration outreach flow.

7. Social Studio and mandatory Folio publishing
User flow
Choose a supported story → choose carousel/video format → generate private draft → edit and preview → Publish to Folio & export.

Supporting copy: “This story will appear on your Folio profile and be eligible for discovery. Publish it here to download it for other platforms.”

Private generation and previews are allowed before publication. The parent project must be published before its social piece can go live. If needed, take the designer through project review first; never silently publish private material.

The social piece is its own public content object attached to the project, not merely a saved ZIP or an export-log row. Its landing page shows the actual carousel or playable video, caption, attribution, linked spotlight products, and project/designer actions. Use a stable deep link to the piece, not just the article top.

Social content contract
The direction stage outputs a versioned story plan: angle, audience goal, ordered frames/scenes, image IDs, approved text references, spotlight IDs, focal regions, durations for video, credits, and destination. Product-focused deep dives use only approved published spotlights. Ordinary tags can remain sourcing links on the parent project without becoming product-feature candidates. General project reveals do not require a spotlight.

Every published spotlight appears in the Studio source library; the designer can generate a standalone piece or combine compatible spotlights. Do not force every spotlight into every export. No minimum of four products for a single-product feature.

Use original room photography and permitted product assets. Deterministic rendering controls layout, typography, crops, and animation. Validate product identity and selected finish, photo resolution, text overflow, safe areas, captions, and attribution. Never invent a room view or quote to fill a template.

Server-side export condition
Allow download only when the requester has export permission for the publishing identity, the parent project is currently published, the social piece is currently published, the requested version is its approved published version, all required source permissions remain valid, and final render assets are ready.

All download routes, full-resolution slide endpoints, ZIP creation/delivery, video downloads, old campaign endpoints, and background job completion paths must use one shared eligibility resolver. Hiding a button is insufficient. Do not return full-resolution export assets through a draft-preview endpoint. Previews may use reduced-resolution or marked assets; screenshots cannot technically be prevented.

Recommended response codes: PROJECT_NOT_PUBLISHED, SOCIAL_PIECE_NOT_PUBLISHED, REVISION_NOT_PUBLISHED, SOURCE_UNAVAILABLE, RENDER_NOT_READY, and FORBIDDEN.

Publish only a render-ready piece, commit its version and stable destination, enqueue feed indexing, then return an authenticated download reference. A retry uses the same idempotency key and piece/version; it must not create duplicate feed posts. A failed download retries without republishing. A new crop/text/story revision must be reviewed and published before exporting that revision.

Unpublishing disables new exports and removes native feed eligibility. Recheck state before delivering signed asset links, use short-lived download access, and keep old private assets inaccessible through predictable public paths. Exports already on other platforms remain outside Folio's control.

Feeds and discovery
Published pieces appear on the designer's feed and are eligible for relevant home/discovery feeds. They are not guaranteed featured placement. Group aspect-ratio variants under one piece, and deduplicate alternate renders. Use diversity limits so ten exports from one project cannot flood the home feed. The parent project is checked on every public query, including module feeds.

The landing page offers immediate viewing before signup; saving, following, product exploration, and inquiry supply meaningful next actions. Store piece-level attribution for visits, new users, saves, follows, and inquiries. Future transaction attribution should retain designer/project/spotlight/piece identity without promising launch payouts.

8. Proposed data and service boundaries
Reuse existing models where their semantics fit; these are conceptual changes, not final Prisma migrations.

Record	Required responsibilities
ProductSpotlight	Publishing identity, project, product, room, source tag links, selected status, stable question/answer links, approved version, publication state
SpotlightRevision	Raw answer references, public write-up, verbatim excerpt and source span, approving identity/time, immutable version
ShopProduct	Designer/product presentation backed by one or more published spotlights, chosen lead source
ProductTestimonial	Projection of an approved published spotlight revision with attribution
CollaborationInvitation	Spotlight/version, recipient association, explicit send authorization, delivery and acceptance state
SocialPiece	Parent project, owner/studio, type, stable slug, public state, current published version, linked spotlights
SocialPieceVersion	Source versions, storyboard, reviewed text, render manifest, publication timestamp
ExportJob	Piece/version, format, render/download state, retry and idempotency identifiers
ProjectModule already supports native media and has feed queries. Evaluate extending it to serve as SocialPiece rather than creating a competing feed model. InstagramExport can remain an export-job/history record. Confirm schema constraints and caller coverage before final migration design.

Recommended shared services: resolveSpotlightEligibility, reconcileSpotlightQuestions, publishSpotlight, syncSpotlightSurfaces, sendSpotlightInvitation, publishSocialPiece, assertSocialExportAllowed. Names are proposals. Each mutation validates the actual project and studio role server-side.

9. Targeted repository audit
Source URLs below refer to main as inspected on 8 September 2026. GitHub search results identified commit 05303220a06c3aece2381067d98e0717ee972eda; fetches used main. Pin a fresh commit before implementation.

Source	Observed behavior	Required change
AdvancedTagProducts	Add to my Shop toggle, optional quote, add-later option	Spotlight control, benefit copy, room association, pending interview state
Tag API	Creates active ShopProduct during tagging, syncs quotes, calls boost helper; Selection backfill is optional and matches room name	Persist spotlight draft; postpone public Shop/testimonial and collaboration effects; canonical room resolution
Room orchestration	Reads room selections; resolves subscription naming; nominal 20-question cap with two-question minimum per room; failed rooms return empty questions	Read actual selected spotlights; guaranteed coverage independent of optional selection backfill; explicit failure state and batching. Existing proportional cap is not strictly guaranteed when minimums exceed it
Room generator	Invites subscribed-product questions and some descriptor questions; no explicit designer spotlight IDs	Dedicated eligibility, structured IDs, exclusion validation, guaranteed fallback
Interview orchestration/cache	Project/room phases, persisted signatures, optional flattened cap; signature uses tag-link presence as named/descriptor marker	Add spotlight/policy versions; preserve answers while reconciling; stop cap from removing mandatory spotlight slots
Single follow-ups	Loads tagged-product context, encourages positive-vendor follow-ups, permits question morph/coverage, caches by project/question	Enforce selected spotlight scope, prevent automatic coverage/removal, invalidate stale caches
Batch follow-ups	Chases mentioned products and vendor relationships; incorporates request roomTags and project product context	Resolve eligible room/spotlight context from server; stop non-spotlit pursuit
Naming policy	Paid eligibility governs named questions/prose	Explicit designer spotlight exception and no paid override of question selection
Prompt canon	Shared persona, grounded questions, single ask, verbatim quotes	Add one shared spotlight policy across all reachable generators
Testimonial sync	Copies active Shop quotes; selects quoteApprovedAt but does not enforce it	Require approved published revision and live source; preserve multiple project contexts
Boost helper	Tag-triggered opportunities can notify/invite contacts	Explicit post-publication invitation and separate boost action
Legacy ZIP export and single slide	Use project-view authorization; no route-level published-state check; accept raw selectedQuotes; collect all tags; product rendering supplied only at four or more products	Shared export gate, authorized publisher, approved source IDs, spotlight-only product features, single-piece support
Newer image export	Does require published parent post and designer/owner; returns full-resolution assets and saves InstagramExport	Add native social-piece/version publication requirement; validate source asset IDs; support established studio permissions
Module feed query	Queries published modules of feed media types; no parent-publication condition in this helper	Reuse where appropriate; enforce live parent and piece eligibility, feed deduplication
The quote extractor reviewed earlier protects its own verified-selection path, but the inspected legacy routes also accept caller-provided quote text. End-to-end provenance must therefore be checked at the API boundary, not assumed from one helper.

Remaining implementation discovery
Before coding, enumerate every tagging UI/API, question generator caller, publication mutation, export/download endpoint, and home/profile feed consumer. Confirm which legacy paths remain reachable. Inspect Prisma and current migrations, organization ownership, article composition/naming scrub, asset permissions, existing collaboration models, and ProjectModule public routing. These are explicit follow-on engineering tasks, not claims that this audit covered them.

10. Delivery sequence
Update conflicting canon documents with this founder-directed behavior; inventory entry points and pin baseline. No automatic deletion of old functionality.

Add canonical spotlight records, tagging UX, room links, and draft review. Preserve existing tags/quotes. Migrate legacy Shop items only from explicit designer choices, not inferred product prominence; retain existing public records as labeled legacy until reviewed rather than withdrawing them silently.

Implement shared interview policy, scheduled spotlight questions, follow-up restrictions, persistence reconciliation, and coverage checks. This is the first end-to-end acceptance milestone.

Publish spotlight revisions into Shop/testimonials and optionally the correct article room. Build explicit collaboration invitation review/send and vendor contribution flow.

Build native SocialPiece/version publication using ProjectModule if viable. Enforce one export gate across old and new routes before exposing the new Studio exports.

Deliver one excellent decision carousel and one single-product spotlight layout, then captioned still-photo video. Wire homepage/profile discovery, landing pages, analytics, and withdrawal behavior.

Boost monetization and checkout payouts can follow; neither blocks the above loop. Launch requires the publish-before-export rule for every exposed Studio format, including video when enabled.

11. Acceptance criteria
With ten tagged products and two selected spotlights, exactly those two get base product questions; the other eight get none, including descriptors and subscribed brands.

With zero spotlights, project/room interviews still work and produce no product-specific questions.

Repeated tags of one selected piece in one room produce one spotlight/question; distinct confirmed rooms retain the intended separate context.

A selected product with no Selection backfill or vendor account still gets its question. Unresolved room assignment is shown as actionable rather than silently omitted.

Selected count greater than the general room budget schedules all selected questions in batches. Model failure or validation rejection leaves visible remaining work or safe fallback questions.

Voluntary mention of an unselected product triggers no product follow-up. A separate selection action is required before interviewing about it.

Resume, regeneration, cache fallback, and question morphing preserve valid answers and cannot reintroduce deselected product questions.

Vendor subscription changes neither spotlight selection nor required coverage. Approved selected names survive their room's prose gate.

Draft tagging creates no new public Shop entry/testimonial and sends no collaboration invitation. Publishing an approved spotlight activates all required surfaces without waiting for a vendor.

Private or unapproved answer text, raw client quote strings, unrelated assets, and another studio's material cannot enter public exports through API tampering.

A product used across projects retains separate explanations; editing or withdrawing one does not corrupt other active sources.

Publishing a social piece creates one native landing page and profile-feed item, makes it eligible for discovery, and unlocks only the published version's export.

A published parent with an unpublished social piece cannot export. Direct old ZIP, single-slide, and image-export calls cannot bypass this rule.

Retried publication/download creates no duplicate feed entries. Draft edits cannot be exported against the previous version's publication flag.

Parent/piece withdrawal removes native eligibility and blocks new downloads. Failed renders and failed indexing are recoverable with visible state.

Collaboration is optional, explicit, deduplicated, and tied to the correct vendor. Declining or ignoring an invitation never hides the designer's spotlight.

Earned featuring and sponsored amplification are distinct in data and UI; multiple exported aspect ratios do not multiply feed posts.

For an absent, unpaid, nonresponsive, declined, or opted-out vendor, the designer can still publish the project and approved spotlight, activate Shop/testimonial visibility, and publish/export eligible social pieces. No vendor-state branch blocks these actions.

An incomplete joint collaboration cannot publish or export under its parent spotlight’s published state. Completing both contributions and approvals publishes a separate version without modifying the original designer piece.

Before vendor enrollment, the opportunity summary reflects distinct public projects, approved excerpts, and correctly labeled observed activity. Withdrawals and source changes update it; private data and fabricated metrics never appear.

Repeated tags, new spotlights, format variants, and concurrent retries do not send duplicate invitations. Aggregating multiple designers’ evidence does not expand any individual designer’s outreach authorization.

Vendor identity ambiguity blocks outreach and account access, but does not block the designer’s publication. Recipient opt-out suppresses new invitation sends without suppressing the designer’s work.

Evidence aggregation, invitation delivery, or vendor onboarding failure does not affect the independent project/spotlight/social export path.

Use deterministic service/integration tests for these invariants and a small curated interview evaluation set for semantic exclusion, question quality, and source grounding. Review actual media visually on mobile. Do not treat prompt snapshots or export counts as proof of quality.

12. Measurement
Track spotlight selection → answered → approved → published; question coverage and unselected-product violations; Studio draft → publication → external download; self-reported actual posting where available; incoming piece visits → follows/saves/inquiries/new users; vendor invitation → acceptance → contribution → optional boost. Distinguish exports from actual external posts and on-platform engagement from attributable visits. The initial success criterion is usable media and meaningful designer return, followed by repeat project publishing.

Revision 1.1 implementation note
This revision makes vendor independence explicit, adds a separate publication boundary for joint collaborations, and adds pre-enrollment evidence aggregation with coordinated, authorized outreach. It does not relax publish-before-export, grant guaranteed homepage featuring, or introduce launch earnings. The earlier audit remains a targeted source review; implementation still requires the entry-point and schema checks listed in section 9.