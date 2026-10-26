# PR #826 follow-up verification

Verified 2026-10-26 against merged main **1020fef5a5970d9d3abaf3034c410d1dc5569227**. This updates the earlier audit of 32e771a5; it does not erase that historical evidence.

**Yes: #826 closes the reproduced interview recovery issues, clears the hosted TypeScript gate, and substantially improves the primary intake, upload, tagging and publishing flows. It does not close all rollout findings.**

[PR826](https://github.com/bprasky/folio-mvp/pull/826) merged at 20:09 UTC. Its final reviewed head, 3a98fd8b, has the **same Git tree** as merge commit1020fef5. All eleven non-preview PR checks passed; Supabase Preview was skipped. Read-only deployment inspection at 20:16:53 UTC confirms folioad.com points to READY production deployment dpl_p9umFJfJREwzwuuno9A7LfzxjzAs at1020fef5. This verifies the deployed source identity, not a signed-in production smoke test. [Metadata and checks](pr826/merge-and-checks.json).

## Changes to the audit findings

| Earlier finding | After #826 | Evidence and remaining scope |
| --- | --- | --- |
| **M1 TypeScript verification failure** | **Hosted gate cleared** | Final CI runs prepared compile and typecheck, verifies the baseline against merge base904, and passes at880/880. Removes unsupported listAllContacts export. This is a passing debt ratchet, not zero TypeScript errors; authOptions remains existing baseline debt. [Exact-head log excerpt](pr826/typecheck-ci-excerpt.txt). |
| **M2 Recovery work not merged / combined package absent** | **Partly closed** | Recovery is now on main and deployed. The responsive branch f000a0da remains separate; the five-workstream package is still not fully combined. |
| **R1 Excluded-photo URLs in anonymous tag API** | **Still open; reproduced again** | Anonymous GET still returns an excluded photo URL. Its filtering was not changed. |
| **R2 Intake loss and duplicate creation/uploads** | **Primary flow improved; broader finding remains open** | CreateProjectGuide retains fields and an actor/firm-scoped creation request across refresh/lost acknowledgement. ProjectGuideUploads opts into stable photo identity. New browser and upload regressions pass. But unchanged createProjectDraftWriter/manual creation still makes two projects after losing the first success, and replayed room creation still makes two rooms. |
| **R3 Stale tag positions and silent failures** | **Primary UI fixed; older callers remain unprotected** | TaggingSection sends expected prior coordinates/photo; route rejects conflicts and UI surfaces 401/non-2xx failures. Core and interruption tests pass. PATCH without expected is deliberately still accepted unconditionally; the original bare-request stale-write probe still ends at the older coordinates. Do not claim all tag clients are conflict-safe. |
| **R4 Two-tab interview overwrite / pending generation / lease handling** | **Reproduced UI failures closed; lease protection implemented** | Fresh guided browser checks retain separate tab drafts and keep202 generation pending. Force regeneration respects active lease; save/unlock checks request ownership. Generation save-path and core regressions pass. Actual independent PostgreSQL worker races remain unverified under V2. |
| **R5 Collaborator API/page mismatch** | **Still open** | Project-page gate is unchanged; editor still passes the canonical write helper but fails the inspected owner/designer/admin-only page condition. No full Next authenticated request claimed. |
| **R6 Shared-dialog space typing/focus/Escape** | **Unchanged** | dialog.tsx is byte-identical to the audited version. The earlier reproduced failure still applies; no new browser render of this unchanged component was needed for this comparison. |
| **R7 Mobile overflow / cropped tagging coordinates** | **Unchanged** | StoryRenderer is byte-identical. TaggingSection changes request/error handling, not the offending layout or image framing. Responsive-branch fixes have not landed. |
| **R8 Project creation silently drops credits** | **Still open; reproduced again** | Child credit-write failure still leaves the project stored and returns201 without credits. |
| **V1 Actual private image bytes** | **Unverified** | No disposable Supabase byte-access test. Shared deterministic upload paths also require real storage-policy/race verification. |
| **V2 Critical database groups** | **Unverified** | Fresh core run is21 pass /2 DB groups skipped. Successful hosted postgres/private-journey jobs are Spotlight tests, not the missing founding-designer groups. |
| **V3 Complete authenticated browser→API→database journey** | **Unverified** | Fresh tests use actual components/handlers but synthetic sessions/providers/storage and memory persistence. Production source identity does not close this gap. |
| **F1 Linked Selection retains old room after tag move** | **Still open; reproduced again** | Tag moves to RoomB's photo while its linked Selection remains in RoomA. |
| **F2 Divergent legacy publication readiness** | **Unchanged** | Legacy publish page's first-ten-image readiness calculation is byte-identical. |
| **F3 Stalled requests / older editors / weak feedback** | **Partly closed** | New workflowRequest bounds headers/body, explains session expiry, and does not automatically retry uncertain writes. Primary upload rejects unsupported/oversized files, handles partial failures, and stops late unmounted callbacks. Publish hook prevents same-tick repeats and stale draft reads. Older editors, profile empty/error/no-op actions and no-opt-in callers remain outside this fix. |
| **F4 Optional live/Studio/export operational gates; P1 polish/docs** | **Not closed by this PR** | Real provider/storage/worker/model evaluation and unrelated visual/documentation cleanup remain separate. |

The primary upload limit is now3MiB for JPEG/PNG/WebP, leaving room for encoded request overhead. Re-selecting identical content in the same project deliberately resolves to the existing image, preserving its saved name/room/tags. Files themselves are not persisted in browser storage; users must reselect unconfirmed files after leaving.

## Fresh checks performed for this follow-up

All checks below ran on a clean temporary checkout of **1020fef5**, with unchanged repository scripts and the same dependency lockfile as the earlier audit. Node22.17.0 and Chrome on Windows; no production credentials, database or paid providers.

| Check | Result |
| --- | --- |
| Workflow request transport | 4/4 pass: stalled headers/body, session expiry, server errors. |
| Project guide upload | Pass: validation, injected storage/DB failures, simulated concurrent/lost-response retries and project isolation. |
| Generation quote/save-path | Pass, including rejection of a superseded generation lease owner. |
| Core safety/journeys/designer authorization | **21 pass, 2 database groups skipped.** |
| Interruption browser | **7 scenario groups pass**: retained intake, invalid files, lost creation ack, offline partial upload, navigation/unmount, failed publish/retry, stale draft reads and visible tag failures. Some grouped scenarios cover multiple behaviors. |
| Guided browser | **21 scenarios pass**, including independent tabs, session expiry/timeouts and pending generation. |
| Original remaining-gap probes | Reproduce unchanged manual creation/room duplication, no-expected stale PATCH, excluded-photo URL, linked Selection room mismatch and swallowed credit failure; page mismatch inspected. A probe exit0 means the expected defect was reproduced. |

[Commands and exit codes](pr826/test-results.json), [remaining-gap readbacks](pr826/remaining-gaps.json), [interruption browser log](pr826/interruptions-browser.log), [guided browser log](pr826/guided-browser.log), [mobile recovery screenshot](pr826/screenshots/partial-mobile.png).

The tag-error browser test drives the shared mutation helper through a confirmation control; source inspection establishes that dragging/moving also uses this helper. It is not a claim of physical-device drag testing. The stale-position route regression uses expected coordinates; the old no-expected probe is retained specifically to expose the compatibility limitation.

The fresh follow-up did not rebuild/typecheck locally: exact-head hosted build/typecheck evidence was available and its tree matches the merge. No application, test, configuration, schema or migration changes were made. The temporary checkout's generated review artifacts are evidence only.

## Updated conclusion

The earlier statement “recovery fixes are unmerged and the TypeScript gate is failing” is now superseded: **#826 is merged, deployed, and its hosted gate passed**.

The remaining rollout decision still depends on the excluded-photo disclosure, manual/legacy retry gaps, collaborator page admission, shared dialogs/mobile presentation, lost credits and missing real integration evidence. #826 is substantial progress on recovery; it is not a complete resolution of the final audit.

