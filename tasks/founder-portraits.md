# Founder portraits and profile composition

Baseline: production main 89d138b4707805dc523de4d9c77aa6c92c7dbb0f.

- [x] Discover bounded, source-attributed portrait suggestions during website import; never publish automatically.
- [x] Add optional portrait composition to the existing appearance model and shared hero, preserving old covers.
- [x] Add authenticated selection, original/cutout treatment, positioning, upload and removal controls.
- [ ] Move private profile work into Manage profile; keep the public composition hero → tabs → content.
- [ ] Verify discovery, permissions, persistence, fallbacks and desktop/mobile presentation.
- [ ] Prepare a review branch and preview for the end-to-end import test.

Portrait suggestions are not identity assertions. Instagram is best effort from links on the studio website; blocked pages cannot be promised. Background removal uses segmentation of the original photograph, never generative replacement of people.

## Review checkpoint - 2026-11-19

The founder authorized pushing a review branch and opening a PR to run hosted build and browser checks. Merge and production deployment are outside this approval.

Local checks: all 27 portrait/appearance/permission tests pass; import orchestration and rendered feed/privacy checks pass; client boundaries and migration discipline pass. TypeScript remains 843/843 with no new diagnostics. Scoped ESLint has zero errors and 34 existing warnings. The Windows sandbox blocked local production compilation/browser launch in the implementation session; hosted compile and real Chromium checks remain required. Provider behavior uses synthetic segmentation masks; live provider quality and real website discovery remain acceptance checks. No schema migration is included.

Private profile actions now live in the management sheet and the preview review sheet. Updated the existing browser contrast suite to enter the management sheet while retaining its desktop/mobile and light/dark assertions.
