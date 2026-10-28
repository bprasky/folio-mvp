# Immersive publications — implementation review

The approved photography-led reader is implemented in the public article, canonical Publish editor/preview and older article preview. The existing project lead, credits, quote/paragraph editing and product access remain available. Room order is deterministic and editable. Photos without stories form balanced galleries of two to four; a single available photo is shown without a fabricated companion. Missing/excluded photos never become room slides.

The desktop blends the selected photo's right edge into its enlarged blurred continuation. Mobile uses a rounded glass label, horizontal project/firm/location, a prominent room title and a tap to read. Original-photo view, direct room selection, next/previous controls and horizontal touch handlers avoid scroll-driven animation. Keyboard focus returns after gallery enlargement and article collapse. Long headings and quotes cannot push the read affordance under navigation; their complete text remains in the scrollable reader.

## Designer-owned appearance

`expandedBlocks.presentation` stores a version, nullable accent and ordered room identities. Existing posts are neutral. Finding colors performs no write and applies no color. The authenticated endpoint samples at most eight eligible project photos and offers at most six distinct dominant colors. Protected photos use project-scoped storage access; remote inputs use the existing bounded, DNS-checked transport. Unreadable photos do not generate substitute colors. Reset persists null.

Presentation writes are authorized and compare against the article read for the request. The UI sends only fields the designer changed. Full editorial generation preserves the latest preferences rather than model output; other whole-JSON writers reject concurrent changes. The public serializer explicitly returns only the presentation fields, without private evidence or extraction metadata. No database migration or publishing gate changed.

## Downstream exports

The Instagram carousel preview and downloaded photo slides share the same canvas composition and licensed Cormorant Garamond/Instrument Sans assets. The default new format is 9:16; existing exports retain their selected ratio. 4:5 and 1:1 remain available. Photo exports omit article previews and navigation arrows. Source validation prevents stale previews or submitted arbitrary colors/URLs from changing exports.

Active room spotlight campaigns use the same room-photo composition. Approved Studio stories retain their exact approved headline as unquoted editorial text and their existing captions/approval checks. Existing launch, product, bio and CTA content types remain supported. The unused legacy modal/slide endpoint was not expanded into another supported workflow. Print/book production is not part of this change.

## Verification

- Real Next 14 compile succeeded; no mocked font responses or production credentials. An initial transient Google-font response failed the loader's extension assumption; exact loader checks and the fresh compile succeeded with 22 genuine font files. Existing unrelated import/browser-data warnings remain.
- Full lint passed with existing warnings. TypeScript measured 866 existing errors against baseline 880. After normalizing dependency paths from the shared local `node_modules` checkout, no new diagnostic fingerprints. The normal local guard reports five equivalent path-only differences; no baseline was changed.
- `node --import tsx scripts/check-immersive-rooms.ts`: 300 gallery sizes, 120-room order, blank paragraph indexes, duplicate/legacy identities, excluded/missing assets and photo-only fallback.
- `node --import tsx scripts/check-publication-presentation.ts`: 24 checks for real pixel extraction, authorization, neutral defaults, explicit selection/reset, allowed room identities, concurrency, generation preservation and public sanitization.
- `node --import tsx scripts/check-publication-social.ts`: actual raster outputs in all three formats, source attribution, stale previews, owner fallback, approved campaign copy and authorized image selection.
- Existing generation persistence, public transport (11 cases), carousel editor/persistence/page, campaign readiness and social teaser suites passed. Client-import and migration-discipline guards passed.
- Browser verification at 320/390/700/desktop widths used actual components and fonts with locally held La Gorce images/copy. Verified no horizontal overflow, reader expansion/collapse, full-photo return and keyboard focus, photo-only gallery, long-copy scrolling, source-neutral swatch discovery, save/reload and reset. Instagram browser previews and actual JPG exports were inspected.

The browser fixture is `node scripts/preview-immersive-publication.cjs`. Set `PUBLICATION_FIXTURE_DIR` to the local approved-reference directory to use those assets; otherwise it uses synthetic photographs/copy. The server is loopback-only, stores test preferences in memory, and never reads credentials or writes application data. Its header links expose editor, full article, long-content and social cases.

No live database persistence round trip, physical touch-device gesture test, production content mutation, merge or deployment was performed. The three new regression suites are included in CI.
