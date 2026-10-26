# Failure and limitation ledger

All required final checks pass with zero required DB skips. Failed attempts below are not included as passing evidence. Final commands, boundaries and log hashes are in [validation.json](validation.json).

| Attempt / failure | Resolution and final evidence |
| --- | --- |
| Old audit: 21 pass, two critical DB groups skipped; Docker daemon unavailable | Provisioned native PostgreSQL 18.6 + pgvector 0.8.1 in an isolated Alpine chroot inside WSL. Exact required runner now executes safety, journeys and designer authorization: 37 pass / 0 skip. Independent-process concurrency suite: 8 pass / 0 skip. |
| Initial Windows PostgreSQL 17.5 lacked pgvector | Not used for proof. Native Linux PostgreSQL with the real extension used instead; no PGlite substitution. |
| Native DB run exposed obsolete vendor tier and missing create request IDs in old fixtures | Corrected policy to actual persisted VendorTier values and supplied stable identities in creation fixtures. Existing authorization expectations retained. Final core and firm policy checks pass. |
| First concurrency attempts exposed fixture setup/expected-state differences | Corrected fixtures to reach the real transactions and compare canonical results. Final tests force credit and Selection failures, use separate processes/backend PIDs, and verify no partial commit or stale lease unlock. Final log includes all eight tests. |
| Shared dependency path caused mismatched prepared type fingerprints | Installed this worktree's unchanged lockfile with `npm ci --ignore-scripts`, followed by Prisma generation. No package or baseline change. Final prepared ratchet 867/880. |
| Build found a misplaced `use client` directive and unsupported auth route export | Fixed source before application commit 70636d1f. Final build/type/lint/client guards pass. |
| One preparation attempt failed because Google Fonts returned an invalid-format URL | Unchanged retry succeeded; final prepared build also succeeded. No type baseline or font design workaround. |
| `npm run db:guard` without an explicit database URL failed | Repeated with explicit disposable DATABASE_URL and DIRECT_URL. Pass. Schema created by db push; no claim that production migration history was replayed. |
| Pure readiness/carousel test VM loaders lacked new protected-image import | Added boundary doubles that prevent unexpected reads in pure checks. Actual private bytes are exercised by separate HTTP/DB and connected tests. Final readiness, persistence and export checks pass. |
| Project-list check initially invoked without `--experimental-vm-modules`, then lacked new create service dependency | Used its documented Node flag and added a throwing mutation double. Six original GET/privacy checks pass; assertions unchanged. |
| Interruption fixture used an invalid fake JPEG header after encoded-dimension checks were added | Supplied a valid bounded header; corrupt input remains explicitly tested. Seven interruption groups pass. |
| Initial responsive focus-restoration assertion sampled before Radix's deferred restoration | Added bounded polling for the same expected opener. Full sweep passes; nested/dirty guard interaction check also added and passes. |
| First connected signup returned 429 with no Redis | Started native disposable Redis; fixture HTTP adapter executes actual rate-limit Lua. Did not bypass production rate limits. |
| Redis adapter mishandled Redis CLI's NOSCRIPT JSON error | Corrected fixture adapter response handling; real Redis script load/eval works. Both final connected runs pass. |
| Connected selectors/status assumptions differed from real UI/lifecycle | Used actual manual-entry label; asserted streamed not-found content and absent private data rather than assuming HTTP 404; owner REVIEW publication is correctly expected to return 409. Admin approval/replay checked separately. |
| Expired-session fixture used a non-secure cookie name against production NextAuth | Uses the actual `__Secure-next-auth.session-token` cookie and a signed expired token; real Next mutation returns 401. |
| Hosted Supabase/RLS/CDN and existing public-object inventory unavailable within the authorized isolated scope | **Open rollout blocker.** Local storage policy is synthetic. Follow [storage activation](../storage-activation.md), then verify hosted bytes and retire historical public objects before private intake. |
| Physical iOS/Android and live paid providers not exercised | **Open manual/provider gates.** Chrome emulation/simulated touch and deterministic model/recording boundaries are disclosed. No paid call or real outreach. |

Expected injected Prisma/provider/network errors appear in successful logs. Their surrounding assertions and final totals distinguish deliberate failure coverage from an unexplained failing run. Existing optional-surface build warnings remain documented in the main report; this task does not certify those optional workflows.
