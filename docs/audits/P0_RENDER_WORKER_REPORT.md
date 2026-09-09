# P0 isolated renderer implementation report — 2026-09-08

Implementation delivered; authoritative Linux network verification pending.
No subsequent hardening phase started. Deployment/operations details are in
`services/render-worker/README.md`; prior IDOR dispositions remain in
`docs/audits/P0_COMPLETION_REVIEW.md`.

## Architecture and trusted components

Folio → authenticated HTTPS → Caddy → loopback Node controller → disposable
Docker/Chromium job → public network. Folio preserves its existing cheap-fetch,
authorization, ownership and spending gates. The controller uses a strict URL-only
body, two-key constant-time authentication, one-job admission, bounded subprocess
I/O, verified rule installation, and cleanup on success/error/timeout.

Trusted: host kernel/admin, controller, Docker daemon, nft/nsenter/ip tools,
immutable job image/dependencies and Caddy configuration. The DNS resolver is
trusted for answers/availability but packet policy must still block private
destinations after rebinding. Remote page content and Chromium traffic are
untrusted. No application/provider/controller credentials reach the job.

## Implemented network policy (not yet exercised)

- Docker bridge and per-job Linux network namespace; host controller uses nsenter
  to install nftables before executing Chromium.
- Namespace INPUT/OUTPUT default DROP. IPv4 private/special ranges, local host
  addresses, gateway and configured external control-plane addresses denied
  before allowing public TCP 80/443. Other traffic denied.
- IPv6 disabled with Docker sysctls AND dropped by inet-family rules.
- TCP/UDP DNS only to a configured public resolver, read-only resolv.conf,
  Chromium automatic DoH disabled. Packet filtering remains authoritative.
- Independent host FORWARD policy for the bridge, and host INPUT drops all
  traffic from the bridge, including to public host addresses.
- Job UID 1000, all capabilities dropped, no-new-privileges, default-deny seccomp
  with documented user-namespace syscall allowances. Chromium sandbox retained;
  no SYS_ADMIN/NET_ADMIN, no no-sandbox or unconfined seccomp. Pipe CDP only.
- Read-only root, bounded temporary profile/storage, CPU/RAM/PID/output/time
  limits, no published ports, no socket mounts and no secrets in the Docker image.

## Authoritative adversarial results

The Windows machine cannot connect to `dockerDesktopLinuxEngine`. The Linux
acceptance entrypoint exits nonzero before network setup. These are **not tested
blocking results**; canary connections and kernel counters are unmeasured.

| Attack | Blocked? | Canary connections | Kernel/firewall evidence |
| --- | --- | --- | --- |
| Direct 127.0.0.1 | NOT RUN | Unmeasured | None |
| 0.0.0.0 | NOT RUN | Unmeasured | None |
| RFC1918 IPv4 | NOT RUN | Unmeasured | None |
| Link-local IPv4 | NOT RUN | Unmeasured | None |
| Cloud metadata | NOT RUN | Unmeasured | None |
| IPv6 ::1 | NOT RUN | Unmeasured | None |
| IPv6 private | NOT RUN | Unmeasured | Disable policy unverified |
| IPv6 link-local | NOT RUN | Unmeasured | Disable policy unverified |
| Public redirect → private | NOT RUN | Unmeasured | None |
| Mixed public/private DNS | NOT RUN in browser | Unmeasured | Unit-level rejection only |
| Changed/rebinding DNS | NOT RUN in browser | Unmeasured | DNS fixture logic only |
| img private subresource | NOT RUN | Unmeasured | None |
| script private subresource | NOT RUN | Unmeasured | None |
| CSS/font resources | NOT RUN | Unmeasured | None |
| fetch/XHR | NOT RUN | Unmeasured | None |
| iframe/private navigation | NOT RUN | Unmeasured | None |
| WebSocket | NOT RUN in browser | Unmeasured | Local canary unit test only |
| Web Worker | NOT RUN | Unmeasured | None |
| Service Worker | NOT RUN | Unmeasured | None |
| Prefetch/preconnect/DNS-prefetch | NOT RUN | Unmeasured | None |
| Beacon | NOT RUN | Unmeasured | None |
| WebRTC/STUN UDP | NOT RUN | Unmeasured | None |
| Host gateway, namespace rule absent | NOT RUN | Unmeasured | None |
| Deliberately unrestricted test control | NOT RUN in browser | Unmeasured | None |

The harness contains public HTTP/HTTPS fixtures, a controlled UDP/TCP DNS server,
per-job private HTTP/WebSocket/UDP canaries, and a deliberate-breach test guarded
by a dedicated-test-host interlock. It verifies the Chromium sandbox is active,
requires fixture mechanisms to execute, and keeps browser denial counters separate
from explicit raw-packet witnesses. A PNA/mixed-content browser rejection cannot
be attributed to the firewall. Tests and bypass probes are excluded from the
production image and unavailable through the controller API.

## Product parity

| Category | Local result | Linux/browser result |
| --- | --- | --- |
| Ordinary server-rendered fixture | Real extractor gets expected name/image/price/description | NOT RUN |
| JS-hydrated fixture | Fixture provided; extraction test requires actual Linux output | NOT RUN |
| Legitimate retailer redirect | Fixture provided; final URL assertion in harness | NOT RUN |
| Browser fetch-dependent product | Fixture provided; product absent from initial HTML | NOT RUN |
| Historically difficult/BQL retailer | Optional real URL probe; no known safe success claimed | NOT RUN |
| Cache and scrapeStatus persistence | Real handler with mocked infrastructure passes; conditional ownership writes retained and cache hit avoids renderer | Live persistence not exercised |

Retailer captcha/automation blocks remain compatibility limitations; no proxy,
solver or unrestricted provider fallback is reintroduced. Website import now
extracts rendered DOM instead of executing its former remote function; computed
CSS-only images, natural-size filtering and scroll-only lazy imagery are explicit
compatibility gaps outside the product extraction fixtures.

## Integration and removal evidence

- Deleted `src/lib/browserless/protected-product.ts` and its obsolete managed
  launch-argument test. Replaced with `src/lib/server/render-product.ts` and tests
  proving strict HTTPS/auth/URL-only requests, bounded results, final-URL safety
  and no fallback when the worker fails or is unconfigured.
- Both product scraper entrypoints use that client. Existing auth, ownership,
  user/product limits, cheap fetch, escalation gate, cache and status behavior
  remain; deterministic extraction uses the returned final URL.
- Removed managed `/content`, `/function`, BQL request implementation and token
  handling from the shared legacy client. getContent/bql now adapt to the same
  isolated worker. Its direct fallback uses the existing pinned safe fetch.
  The compatibility entrypoint now checks session identity and a shared
  20/user/hour budget; the legacy vendor action lacked its own renderer gate.
  This specific integration defect is covered by a no-worker-call regression.
- Removed the arbitrary HARVEST_CODE/runFunction website caller; it now reuses
  bounded rendered HTML extraction. Vendor UI no longer directs users to enter
  obsolete provider credentials.
- Runtime source search excluding `src/tests/**` returns no Browserless key,
  provider URL, remote Puppeteer connection, runFunction or protected-product
  reference. Historical standalone scripts are not application fallbacks.

## Configuration and operational burden

One dedicated Linux VM, Docker, root controller service and Caddy; no queue or
database. Initial sizing candidate 2 vCPU / 2–4 GiB, one render at a time; load
testing is still required. Environment templates and systemd/Caddy files are
provided. Production runs an immutable local image ID; package lock and reviewed
seccomp base/delta are versioned. Rebuild browser security updates, rerun the
matrix on the exact image/kernel, then switch image ID. Failed setup/cleanup
closes admission; restart removes stale labeled jobs and reapplies policy.

Configure controller current/previous keys, image ID, fixed resolver and any
external control-plane denies. Folio needs RENDER_WORKER_URL and
RENDER_WORKER_API_KEY. No host was provisioned and no production environment was
changed in this task. The README gives full installation, acceptance, rotation,
monitoring and recovery commands.

Upstash smoke was attempted and stopped because UPSTASH_REDIS_REST_URL and
UPSTASH_REDIS_REST_TOKEN are absent. Live independent-process shared-count proof
remains pending. Existing procedure:
`node --import tsx scripts/security/upstash-smoke.ts`.

## Verification and remaining gate

Worker/controller/harness: **13 passed**. P0 application/client/cache/legacy
access tests: **23 passed, 1 explicitly skipped** (Linux browser-output parity
without acceptance output). Total **36 passed, 1 skipped**. Production build:
**exit 0**. TypeScript: **1,009 baseline / 1,009 final, zero added diagnostics**
after normalizing source line/column shifts. Historical typecheck still exits 1.
Client-import guard passes (2,203 source files / 915 client modules). Changed-file
lint: **zero errors**; worker service files and new client/tests have no warnings,
older integration files have **13 warnings**. No-secret/staged-artifact checks
pass; no actual credentials, profiles or captured HTML are committed.
IDOR remains 0 Critical / 1 documented High / 16 Medium / 20 Low. Scanner unchanged.
No schema/auth consolidation/editorial/deletion-audit work was started.

Linux image build, Chromium sandbox/runtime, kernel policy, all browser attacks,
deliberate-breach control, live product rendering and hard-retailer extraction are
unverified. Those are release gates, not presumed working from source inspection.

P0 INCOMPLETE — implementation ready, authoritative network verification pending
