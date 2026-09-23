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

## Fidelity and continuity

Carousel cards and the editor share `CarouselHero`, built from the production export SVG helpers. Saved asset order, ratio, headline position and watermark identity come from the persisted configuration through `savedPublicationPreview`. An unavailable saved first photograph stays unavailable; another photograph must not silently become its cover.

Readiness exports are 4:5 photographs with a separate caption. Their cards show those photographs and headline separately, without implying an overlay in the download.

Personal articles use `ActivityArticleCover` in Studio, the activity workspace and the published article. Prefer the actual profile portrait, then logo, then intentional typography. Saved draft titles take precedence over interview titles. Public reads continue using only the approved published revision.

Expertise articles share `ExpertiseArticleCover` across discovery, saved work, the interview and publication. Show the actual supporting projects. A corrected thesis supersedes an article from an older thesis revision. Revoked evidence cannot supply a cover. Published article images remain connected to the claims they support.

The landing card must open the same content identity and stage that it previews. Opening alone must not save a draft, change its status or invent progress. Preserve the existing clean-exit and save/discard guards.

## Editorial hierarchy

Suggestions and In progress are the primary navigation. Exports stays secondary. One Filter control contains project and format choices. Search is quiet. Keep the introduction compact and show actual publication previews early, especially on mobile. Do not force an asset-free personal card before available project photography.

My expertise remains a visible editorial collection. Prefer a few distinct, grounded opportunities to duplicate generic exercises. Keep setup, discovery status and advanced choices subordinate to the publications. Preserve keyboard focus, meaningful preview action labels and source descriptions.

## Verification

Check the production renderer as well as the landing card: saved title/assets, identity fallbacks, corrections, source withdrawal, action destinations, unsaved exits and export/publication paths. Use desktop and mobile screenshots with clearly identified representative data. `scripts/check-studio-publication-previews.cjs` protects shared SVG fidelity, saved cover safety and corrected expertise stages; the existing Studio UI and persistence checks protect the workflow.
