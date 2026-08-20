# Consolidate the Edit/Preview toggle into the preview

## Why

The staging panel runs two renderers over the same draft and asks the designer
to pick one: `EditableArticle` (a labelled form) and `StoryRenderer` (the real
Story Format). The toggle is not a view option, it is a tax — the designer edits
in a layout that is not the article, then switches to see what they actually
made. The headline is even rendered twice on screen today, once by the panel and
once by the form.

Target: one surface. The preview IS the editor.

## Constraint that shapes everything

`StoryRenderer` also renders the LIVE published article at `/p/[slug]`. Every
change here must be inert when no editing context is present. That is why edit
state travels by React context rather than props: the public page mounts no
provider, `useStoryEdit()` returns null, and the components render exactly as
they do today.

## Steps

- [x] 1. `StoryEditContext` — provider + `useStoryEdit()`. Owns overrides,
      save/revert against `/sections/override`, the editing-field cursor, and
      `router.refresh()`. Logic lifted from `EditableArticle`, not duplicated.
- [x] 2. `buildEditorialChapters` — keep `bodyParagraphs: string[]` alongside the
      joined `body` string. The override API is keyed by `paragraphIndex`; the
      join destroyed that identity.
- [x] 3. `buildRoomTiles` — carry `chapterIndex` (the true galleryChapters index,
      NOT the tile index — tiles are filtered) and `editorialParagraphs` onto
      `RoomTileData`.
- [x] 4. `RoomTilePair` — pass both through to every `QuoteTile` call site.
- [x] 5. `QuoteTile` — when editing: narrative always visible, one editable node
      per paragraph, pull-quote picker in place. Click-to-edit must not trigger
      the tile's click-to-expand.
- [x] 6. `StoryIntro` — editable title, project quote and intro paragraphs.
- [x] 7. `StagingPublishPanel` — delete the toggle, `viewMode`, and the duplicated
      title block; wrap the story in the provider.
- [x] 8. Retire `EditableArticle`; keep `EditableParagraph` + `SectionFeedback`.
- [x] 9. Move the pull-quote picker assertions in `check-pull-quotes.ts` to the
      picker's new home, or section 7 silently stops guarding anything.

## Review

Done. `npm run check:pull-quotes` (45 checks) and `check:quote-audit` green;
both files parse; `EditableArticle` deleted with no remaining importers.

What changed shape from the original plan:

- The pull-quote picker moved to `src/components/story/PullQuotePicker.tsx` as a
  shared component rather than being reimplemented in `QuoteTile`. It is the one
  surface where the verbatim guarantee is visible to the designer, so it stays
  one implementation. `check-pull-quotes.ts` section 7 now reads that path.
- `QuoteTile` gained an `isEditing` short-circuit around its `onClick`/`onKeyDown`
  rather than relying on `stopPropagation` at every leaf. Editing regions are
  wrapped in one `data-story-edit` container that swallows the bubble, so a
  future editable field cannot forget to opt out.
- Owners always see the narrative expanded. The collapsed teaser state is a
  reader affordance; an editor who has to expand each room to reach their prose
  is the same tax the toggle was.
