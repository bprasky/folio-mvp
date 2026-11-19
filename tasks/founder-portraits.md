# Founder portraits and profile composition

Baseline: production main 89d138b4707805dc523de4d9c77aa6c92c7dbb0f.

- [x] Discover bounded, source-attributed portrait suggestions during website import; never publish automatically.
- [x] Add optional portrait composition to the existing appearance model and shared hero, preserving old covers.
- [x] Add authenticated selection, original/cutout treatment, positioning, upload and removal controls.
- [x] Move private profile work into Manage profile; keep the public composition hero → tabs → content.
- [x] Verify discovery, permissions, persistence, fallbacks and desktop/mobile presentation.
- [x] Prepare a review branch and preview for the end-to-end import test.

Portrait suggestions are not identity assertions. Instagram is best effort from links on the studio website; blocked pages cannot be promised. Background removal uses segmentation of the original photograph, never generative replacement of people.

Verification: Hosted production compilation and actual Chromium portrait selection, cancellation, removal, narrow layouts, and light/dark checks passed at 51e4cabd. TypeScript ratchet has no new diagnostics. Local build/browser were blocked by Windows sandbox restrictions. Coverage UI regression is updated to open the management sheet. Provider calls are mocked in tests; a live founder-photo import is the owner's next end-to-end check. No production profile was changed.
