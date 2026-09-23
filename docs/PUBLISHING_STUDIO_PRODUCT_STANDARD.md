# Publishing Studio: publication previews

Publishing Studio is a concierge PR experience: Folio prepares opportunities from the designer's work, then asks for the perspective or decisions needed to finish them.

This is the current presentation standard. It supersedes the modal-first browsing pattern documented in the September 2026 window-shopping review. The earlier specifications remain historical context.

## Card contract

`StudioPublicationCard` is the shared presentation boundary. Each content opportunity supplies:

- `preview`: the intended publication, using actual authorized photographs, saved titles and identity assets.
- `benefit`: one specific sentence explaining the reader/designer value.
- `supportingSources`: source identities when applicable.
- `readiness`: prepared, working, saved, published or needs_source, derived from current records.
- `contribution`: the unresolved question, review or decision.
- `actionLabel` and `href`/`onAction`: the actual next step, shared by the preview and primary action.

Do not fabricate answers, quotations, prose, outcomes, client intentions or completion times. Label unfinished editorial covers Working preview. Use Prepared for you only for actual prepared content. Exactly one known unanswered question is required before promising Answer the last question.

## Audience hooks

The preview headline is the proposed public headline, never Folio's private pitch. Project and room names provide attribution. Prepare the hook before the click and carry it into the workspace. Saved titles always win over newly prepared suggestions.

Legacy project/room preparation selects concise, already-published headlines or complete source sentences. Unselected editorial title alternatives are not published evidence. Preserve decimals and attribution when segmenting source prose. A weak or overlong room angle must not become a paragraph on a photograph. Generic activity entry uses an explicit open question; answers are needed before it becomes an authored article.

Readiness evaluation returns a separate concise extractive headline and evidence thesis. Editing the headline does not change the thesis. Expertise discovery returns a short question with exact supporting citations from two projects; a correction invalidates the original hook. Queue preparation separates its public question from the private interview introduction. These use existing preparation calls; page visits do not trigger paid generation.

## Publication history

Keep uploads, Folio articles, saved drafts, generated exports, planning dates and confirmed external publication distinct. Project overviews sourced from published Folio articles are presented as cross-posting, not a new Folio reveal.

“Already shared this?” records an explicit external destination or dismissal. Corrections are actor/workspace/project scoped, versioned and reversible in Sharing history. Preserve saved work. A confirmed project introduction stays covered even if its wording changes; room decisions remain separately eligible. Legacy angle comparison uses source scope and caption/pitch word overlap, not headline similarity alone. Readiness and expertise generation also compare editorial arguments against supplied history, including dismissals. Historical evidence is comparison context, never fresh evidence for a new claim.

External sharing is designer-confirmed; there is no social-account import. Release dates remain planning notes. Existing saved plans retain their choices and show recorded publication/dismissal annotations. Corrections retain the latest state for each source, not a full social-post audit log.

## Fidelity and continuity

Carousel cards and the editor share `CarouselHero`, built from the production export SVG helpers. Saved asset order, ratio, headline position and watermark identity come from the persisted configuration through `savedPublicationPreview`. An unavailable saved first photograph stays unavailable; another photograph must not silently become its cover.

Readiness exports are 4:5 photographs with a separate caption. Their cards show those photographs and headline separately, without implying an overlay in the download.

Personal articles use `ActivityArticleCover` in Studio, the activity workspace and the published article. Prefer the actual profile portrait, then logo, then intentional typography. Saved draft titles take precedence over interview titles. Public reads continue using only the approved published revision.

Project interviews use a current INCLUDED project photograph; room interviews require an exact room match. Re-resolve the photograph through authorized source records for saved and public views. If no eligible image remains, use typography rather than substituting the designer's portrait or another room. This does not rewrite saved article content.

Expertise articles share `ExpertiseArticleCover` across discovery, saved work, the interview and publication. Show the actual supporting projects. A corrected thesis supersedes an article from an older thesis revision. Revoked evidence cannot supply a cover. Published article images remain connected to the claims they support.

The landing card must open the same content identity and stage that it previews. Opening alone must not save a draft, change its status or invent progress. Preserve the existing clean-exit and save/discard guards.

## Editorial hierarchy

Suggestions and In progress are the primary navigation. Exports stays secondary. One Filter control contains project and format choices. Search is quiet. Keep the introduction compact and show actual publication previews early, especially on mobile. Do not force an asset-free personal card before available project photography.

My expertise remains a visible editorial collection. Prefer a few distinct, grounded opportunities to duplicate generic exercises. Keep setup, discovery status and advanced choices subordinate to the publications. Preserve keyboard focus, meaningful preview action labels and source descriptions.

## Verification

Check the production renderer as well as the landing card: saved title/assets, identity fallbacks, corrections, source withdrawal, action destinations, unsaved exits and export/publication paths. Use desktop and mobile screenshots with clearly identified representative data. `scripts/check-studio-publication-previews.cjs` protects shared SVG fidelity, saved cover safety and corrected expertise stages; the existing Studio UI and persistence checks protect the workflow.
