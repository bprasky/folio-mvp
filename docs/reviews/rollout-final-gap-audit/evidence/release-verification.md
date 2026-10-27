# Released code and verification — 27 October 2026

## Release identity and outcome

- PR827 merged as `4829a94efc07999b02a8356390a53e3585efaea6` after all 11 repository checks passed.
- The first production build reached READY, but live smoke found ordinary homepage image URLs returning 404 while the originals returned JPEG bytes. Production was restored to the previous deployment before preparing the correction.
- PR828 restored the default optimizer, added the shared `FolioImage` protected-source bypass, and restricted local optimization to static paths. Next 14 bypasses middleware for the image endpoint, so `images.localPatterns` enforces the cache boundary. The component's consumers changed imports only.
- All 11 repository checks passed for reviewed head `efbc9ecf4b8f2fcbfced1bb672cab39fec5dcb45`, plus Vercel build/feedback checks. Supabase Preview skipped because its directory did not change. The prepared TypeScript ratchet passed at **867 / baseline 880**, not zero diagnostics.
- PR828 merged as `09f92c228b87910c943bddfc4965447f3886e658`. `git diff --exit-code efbc9ecf4b8f2fcbfced1bb672cab39fec5dcb45 origin/main` proved identical trees after merge.
- The staged production build `dpl_AHrfkcM64Vg8W6yY7fUQbsvc7YER` used that reviewed head. Hosted ordinary-image and protected-boundary checks passed before promotion. The verified build was promoted without rebuilding; both `folioad.com` and `www.folioad.com` resolve to it. Status is **READY**.

## Hosted verification and its limits

The separate production `project-photos` bucket is private, accepts JPEG/PNG and has a 20 MiB object limit. A unique 268-byte synthetic JPEG was uploaded, read back exactly with service-role access, denied to anonymous public/private byte and list requests, and removed. Read-only catalog checks confirmed storage RLS and that existing policies did not grant direct access to this bucket. Existing user content, buckets, policies and schema were unchanged. [Preflight detail](release-preflight.md).

All **17 production HTTP checks** passed after promotion at 18:53 UTC:

- Homepage, sign-in and signup pages return 200; anonymous session is empty and the private project listing returns 401.
- A synthetic nonexistent protected-photo URL returns 404 with private/no-store and nosniff headers.
- Relative, absolute, encoded and traversing protected-photo sources return 400 at both `/_next/image` and `/_vercel/image`. These are optimizer validation errors, not cached photo bytes.
- Three distinct ordinary homepage images return 200 and decode as JPEGs with valid dimensions (640×416, 600×600, 600×600).

The scoped runtime-error query found no errors on the checked routes since 18:52 UTC. These checks do not exercise a signed-in production account, a real user's private image, revocation of a real production grant, physical hardware, or paid providers.

The new committed `node scripts/check-image-delivery.cjs` test also passed locally and in hosted CI. It builds and starts real Next in production mode using synthetic bytes, checks rendered public/protected image URLs, verifies normal optimized bytes and protected access/no-store, and rejects protected optimization with and without synthetic access cookies. It checks the compiled image manifest so disabling the entire optimizer cannot falsely satisfy the privacy assertion again.

## Final-code connected rerun

The continuation runs against application/test source **09f92c228b87910c943bddfc4965447f3886e658**; only documentation and generated evidence are being changed. The refreshed disposable environment uses native PostgreSQL 18.6 plus pgvector and Redis 8.4.2. The earlier fixture data had been removed. An initial attempt to initialize the database on Docker Desktop's small root filesystem failed for lack of space; it left no initialized database. A dedicated 768 MiB temporary memory filesystem under the task's chroot holds the new UTF-8 database. No production connection or migration is involved.

The build and connected runs receive an allowlist of local environment values and synthetic credentials. Runtime outbound traffic is restricted to loopback. Email is disabled; AI responses and Supabase policy behavior are fixtures. The actual browser, Next server, NextAuth cookie exchange, PostgreSQL transactions, Redis scripts, image decoding and carousel rendering execute normally.

The full `next build` completed successfully, followed by **12/12 desktop groups and 12/12 mobile groups**, with no failed or skipped journey groups. Both runs used the rebuilt final code. The desktop intake began at 1440px, mobile intake at 390px, and workspace/public story checks also covered 360/390/768/1440px. Captured desktop workspace, mobile intake and mobile public story screenshots were inspected; the solid-color photos are deliberate synthetic images.

The connected checks cover real signup/session exchange, firm onboarding, lost-success-response creation/retry, refresh/resume, eleven-photo readiness, photo bytes/room replay/tags, private-cache exclusion, editor/viewer/revoked/firm access, carousel JPEG export, profile follow persistence, expired sessions, saved interviews with local model responses, failed owner publication followed by approved retry, public story/profile and immediate unpublish revocation. Expected forbidden-delete and expired-JWT logs correspond to negative assertions. No invitations were sent and vendor notification count was zero.

The build retains the previously documented optional-surface `FaNotes` and `getServerSession` import warnings, plus expected static-render diagnostics for dynamic routes. These are not claimed fixed or verified by this continuation. No new application defect was found in the scoped journeys, and no runtime source changed.

Evidence:

- [Exact commands, source identity, boundaries and SHA-256 hashes](release-validation.json)
- [Desktop result](release-connected-desktop.json) and [log](logs/release-connected-desktop.log)
- [Mobile result](release-connected-mobile.json) and [log](logs/release-connected-mobile.log)
- [17 production HTTP checks](release-production-smoke.json)
- [Desktop workspace](../screenshots/release-desktop-workspace.png), [mobile intake](../screenshots/release-mobile-intake.png), [mobile story](../screenshots/release-mobile-story.png)

The run wrapper invoked `prisma db push --skip-generate` against the newly initialized disposable database, `next build`, then `node scripts/rollout/connected-journey.cjs` with the documented desktop/mobile environment. Runtime application traffic was loopback-only. The run manifests retain all screenshot names; the selected captures above are included in the repository. Temporary Next/Chrome/PostgreSQL/Redis processes are stopped after the runs.

## Remaining rollout work

1. **Legacy objects:** approved inventory, copy/reference migration and retirement of historical public project-photo URLs. The existing isolated copy/shared-reference/rollback test and operating procedure are prepared; production application remains outside the original task authorization.
2. **Hosted signed-in smoke:** labeled test accounts/content, full designer journey, collaborator revocation and private-byte revocation on the approved deployment. Production publication of test content and paid model calls remain excluded by the original instructions; a disposable hosted environment or explicit scoped authorization is needed for those parts.
3. **Physical devices:** essential upload, tagging, keyboard/dialog and resume actions on actual iPhone/Android hardware. Chrome viewport/touch emulation does not close this item.
4. **Optional providers/media:** real model quality/cost, voice handoff, hosted workers and private derivatives need their separate activation verification if offered at launch.

The code release is complete. The full founding-designer rollout is not yet certified.
