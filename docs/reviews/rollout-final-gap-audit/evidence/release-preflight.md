# Release preflight — 27 October 2026

User explicitly authorized merge and deploy after the original report. Target: GitHub `bprasky/folio-mvp` PR827; Vercel `folio-mvp` / `prj_x3AUoaFxpqS1yTKlF1kQfbQLbHg4` in `team_C6byv9SuLXADBaq6A6BJsn9r`; production domain `folioad.com`. Previous production was READY at main1020fef5, deployment `dpl_p9umFJfJREwzwuuno9A7LfzxjzAs`. Git auto-deployment remains disabled in vercel.json; deployment must explicitly select the merged SHA.

Initial hosted CI at e3ad31a1: ten checks passed, Supabase Preview skipped because no Supabase-directory change, and Core regression journeys failed at the photo-viewer focus assertion. Radix restores focus after unmount; the fixture asserted immediately after disappearance. A two-second condition wait was added to both remaining photo-viewer/product-drawer checks, preserving the expected opener assertion. No application code, authorization, baseline or skip behavior changed.

Local rerun: `RESPONSIVE_QUICK=1 RESPONSIVE_REVIEW_DIR=.tmp/release-responsive-final node scripts/check-responsive-journey.cjs` — 27 entries, 12 behavior groups, no overflow/errors. See [log](logs/release-responsive-final.log). Hosted checks must pass on the updated PR before merge.

The next hosted run passed focus restoration but timed out reopening the product drawer after its initial dismissal. The fixture now requires the opener to be the pointer hit target, waits for modal pointer-lock release, and uses Puppeteer's locator to wait for stable layout before the real click. All open/dismiss/focus assertions remain. A local four-times CPU-throttled Chrome rerun passes all 27 entries/12 groups. The remaining 36 Publishing Studio scripts also pass locally. No runtime source changed.

Production storage prerequisite: used the existing configured local service credentials in-process, without printing or exporting them. Verified the expected Supabase project host, found no `project-photos` bucket, and created only that new bucket: private, 20,971,520-byte limit, JPEG/PNG allowed. No existing bucket policy or legacy content was changed.

A unique temporary `__release-verification/` object containing a 16×16 synthetic JPEG (268 bytes) was uploaded with the service role. Exact bytes were read back; unauthenticated public URL returned 400 with no image; the anonymous client's authenticated-object download and object listing did not expose the canary. Only that canary was removed afterward. See [sanitized log](logs/release-storage.log). No real user data, account, paid model or email was involved.

Read-only catalog inspection confirms RLS is enabled on storage.objects and storage.buckets. Existing object policies are scoped to the imports bucket; none grants anon/authenticated direct access to project-photos. No policy was modified and no user object was queried.

This is direct hosted storage proof for the new bucket, not a signed-in production application journey, authenticated end-user RLS matrix, legacy-object retirement or physical-device smoke. Those remaining rollout gates in the main report still apply. The full test evidence from the original application commit remains applicable because this follow-up changes only test synchronization and documentation.
