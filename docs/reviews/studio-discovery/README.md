# Publishing Studio discovery and activities

Implemented 21 September 2026. Application changes await merge/deployment; the explicitly approved additive activity migration has been applied. Existing readiness rollout configuration is unchanged.

## Visible experience

- Both Studio paths use a swipeable subject strip with All work, About me and project thumbnails; story formats are visible buttons.
- Recommended work includes a 20 Questions invitation. About me exposes bio, personal Q&A, materials and process activities. Additional prepared stories stay visible; legacy archive grouping uses actual Folio publication age, never inferred project completion.
- Cards use compact previews. Mobile recommendations scroll horizontally with About me first. Project-room invitations explicitly offer a room choice before starting.
- Activity entry is read-only. Explicit Start generates and freezes personalized questions; save/resume preserves original answers. Untouched generated interviews stay out of In progress. Unpublished drafts can be explicitly removed.
- Reviewed answers produce a Q&A article. Explicit publication features it on both profile routes. Public reads use the approved revision; later private edits cannot replace it. Selected short answers produce a downloadable 1080 x 1350 Instagram PNG, with overflow rejected rather than silently clipped.
- Bio activities use the existing interview flow. Explicit publication updates the profile bio; later private edits retain the preceding public copy. This does not claim a separate generated Instagram bio.
- Opening a prepared post creates no draft. Clean exits are immediate; dirty exits offer save, discard and keep editing. Partial readiness answers and image reordering persist only on explicit save. Existing intentional drafts remain untouched until explicitly removed.

## Verification

Production compile passed with existing unrelated missing-export warnings. Full ESLint passed with existing warnings; client-import and migration-discipline guards passed. TypeScript is 903 diagnostics against the unchanged 904 baseline. Added exact property-display equivalences after old/new generated-client comparison; full proof is in `../STUDIO_STORIES_TYPESCRIPT_DISPLAY_PROOF.json`.

Passing regressions include Studio landing/filtering, readiness UI/service/configurator, legacy carousel page/editor/persistence, selected draft removal, interview creation/idempotency/source races, HTTP authorization, bio publication/resume/failures, review revocation, saved interview removal and measured Instagram image layout. These checks are included in CI.

`scripts/check-story-persistence.cjs` uses pinned PGlite and the real migration/service with a SQL-backed Prisma-shaped adapter. It verifies original-answer JSONB persistence, partial save/resume, unauthorized and stale writes, review/prepare/publication, immutable public revisions, review revocation, source withdrawal and unpublished-draft removal. It does not prove concurrency between independent PostgreSQL connections.

Browser verification used `scripts/preview-readiness.cjs` with explicitly labelled synthetic content and no provider calls. Checked clean/dirty exits, interview save/resume, complete five-answer review, article completion/link, actual canvas PNG preview/download action, About me selection and desktop/mobile presentation. This is UI verification, not an authenticated production browser round trip. New interview questions still use the existing generator and its grounding checks; no new live quality evaluation was performed.

Screenshots: [desktop feed](desktop-feed.png), [mobile About me](mobile-about-me.png). Preview runs at http://127.0.0.1:4183/designer/studio.

## Storage

See `../STUDIO_ACTIVITY_STORAGE_APPLICATION.md` for exact approval and application evidence. Four additive RLS tables, no backfill or existing scalar changes; migration status clean, 113 bookkeeping rows and zero unfinished. No designer application rows were written by verification. The existing `db:check` package command references a missing script; equivalent read-only metadata and constraints were checked directly.
