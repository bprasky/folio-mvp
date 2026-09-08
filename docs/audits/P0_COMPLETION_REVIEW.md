# P0 completion review — 2026-09-08

Historical checkpoint. See [the subsequent worker implementation report](P0_RENDER_WORKER_REPORT.md) for the current implementation and remaining Linux verification gate.

**P0 INCOMPLETE.** The scoped Critical/High fixes and webhook integration are
implemented and tested. Independently enforced browser isolation and legitimate
rendering parity are not demonstrated. No later hardening phase was started.

## Critical dispositions

All callers below are mounted by `src/app/org/[orgId]/page.tsx`.

| Endpoint / caller | Original issue | Server reads / writes / side effects | Disposition |
| --- | --- | --- | --- |
| `GET /api/orgs/[orgId]/feed` — `VendorFeed.tsx` | Public endpoint exposed approved boosts even when their project was private or unpublished; returned internal vendor images and boost telemetry | Reads Organization (existence/type), OrganizationUser (server-side product filtering), InContextBoost/ProductTag/Project/ProjectPost, VendorPost, Product. No writes or external calls | **Real disclosure fixed; intentionally public.** Restrict vendor org types; require public project AND published post for project-derived rows; require published vendor articles and non-pending products; use canonical public image-provenance gate; omit boost telemetry/answer flag. Bounded valid pagination. No member IDs are returned. Public annotation describes the actual projection. |
| `POST /api/orgs/[orgId]/inquiry` — `VendorTeam.tsx` | Public contact form had unlimited unvalidated notification fanout | Reads Organization and active OWNER/ADMIN memberships; creates Notification rows addressed only to those server-selected users. No email, LLM or browser call | **Public by product design; abuse gap fixed.** Strict bounded name/email/message, reject extra recipient/user fields, distributed IP limit 5/hour and org limit 30/hour, at most 20 leadership recipients. Response is only success/error; no private org data. Contact name/email are unverified contact claims, never session identity. The URL org ID selects an intentionally public contact target, not data access. |
| `GET /api/orgs/[orgId]/prompts` — `VendorPromptSection.tsx` (initial load and reload after answer) | Org-specific editorial prompts were publicly readable and full rows were returned | Reads session, active OrganizationUser membership, VendorPrompt; on empty list, Product and Organization context. No writes or external calls | **Real cross-tenant read fixed.** Require server session and active membership with canonical `view_internal` capability; 401 for anonymous, 403 for non-member/inactive/unknown role. Select only prompt display fields; read active prompts for this org plus global templates. No suppression. |

The inquiry email is intentionally not verified: it is contact-form content, not
an authenticated claim or authorization credential. Its rate limits fail closed
when production Redis is absent. Public feed enumeration yields only the same
public display projection; the query is bounded, but a site-wide public-read
abuse policy remains separate from this scoped fix.

Following the prompt caller uncovered a related mutation bug. The answer route
now rejects inactive/read-only memberships using `edit_org_profile`, validates
answer length/default IDs, and fetches real prompts scoped to this org or global
templates. It cannot answer or mutate another org's prompt. Global templates may
be used but are not marked answered globally. Org prompt updates retain org ID
in the write predicate. A failed VendorPost write no longer claims success.

## High dispositions (all 14 original findings)

Line numbers identify the original scan, before these edits. Repeated findings
are separate scanner rules on the same operation, not separate vulnerabilities.

| Original location | Rule | Classification / result |
| --- | --- | --- |
| scrape-bql:52 product read | IDOR003 | Launch blocker: authenticated caller could obtain/use any claimed product for refresh. Vendor/admin gate added before spend or mutation. |
| scrape-bql:67 failure-state write | IDOR003 | Launch blocker fixed with ownership gate and vendor/URL predicates at write time. |
| scrape-bql:67 failure-state write | IDOR004 | Same operation; fixed. |
| scrape-bql:87 pending-state write | IDOR003 | Launch blocker fixed with ownership gate and vendor/URL predicates. |
| scrape-bql:87 pending-state write | IDOR004 | Same operation; fixed. |
| scrape-bql:99 cache-fill write | IDOR003 | Launch blocker fixed with ownership gate and vendor/URL predicates. |
| scrape-bql:99 cache-fill write | IDOR004 | Same operation; fixed. |
| scrape-bql:118 unconfigured-provider write | IDOR003 | Old branch removed; all live escalation uses the existing fail-closed protected renderer. |
| scrape-bql:118 unconfigured-provider write | IDOR004 | Same removed operation. |
| scrape-bql:160 failed-render write | IDOR003 | Launch blocker fixed with ownership gate and vendor/URL predicates. |
| scrape-bql:160 failed-render write | IDOR004 | Same operation; fixed. |
| scrape-bql:223 final product write | IDOR003 | Launch blocker fixed with ownership gate and vendor/URL predicates. |
| scrape-bql:223 final product write | IDOR004 | Same operation; fixed. |
| products:158 add-only enrichment | IDOR004 | Unclaimed catalog enrichment is intentionally collaborative, as documented by the existing product PUT and lifecycle spec. The real concurrent-claim/field-overwrite race is fixed with `updateMany` conditioned on `vendorId: null` AND original field values. **One High remains visible: scanner limitation**, since it does not model unclaimed shared-catalog permissions. The concurrency regression returns the winning vendor data and performs no mesh side effect when the update matches zero rows. |

No High allow annotations were added and the scanner itself was not changed.
The inaccurate public annotation on scrape-bql was removed. The product catalog
keeps its accurate public GET annotation; it does not suppress this remaining
High write finding.

Escalation callers: `src/app/project/[id]/TaggingSection.tsx` after tagging and
`src/components/project/ProductEditModal.tsx` for forced refresh. Both still use
the same API URL. Server-enforced budgets: 20 renders/user/hour and 3/product/hour,
in addition to the existing flagged-domain/recent-block gate. Every product URL
is validated before provider use; no unrestricted BQL call remains in this route.
Cache, scrapeStatus and extracted field persistence remain, but live rendering
fails closed until the browser blocker below is resolved.

Catalog POST callers include ProductTagPicker, ProjectCreationModal and other
tagging surfaces (source search for `/api/products`). It now has a 60/user/hour
distributed limit that also bounds its automatic mesh-trigger opportunities.

Related ownership escalation discovered while checking the canonical product
permission model: product PUT accepted `vendorName`, looked up a vendor, and
assigned ownership from that untrusted display name. This assignment is removed;
claims retain their own workflow, and the product update keeps the original
vendor ID predicate. Regression coverage proves a supplied name cannot assign a
vendor or cause a vendor lookup.

Anonymous product detail also used the raw image URL, bypassing the catalog's
public provenance policy. It now uses the canonical image resolver; a route
regression verifies that an internal vendor-reference image is not returned.

## Browser architecture decision

**Do not use the current managed Browserless service as the authoritative
boundary.** The previous live probe observed its injected bypass
`<-loopback>;0.0.0.0;production-sfo.browserless.io`. Folio cannot demonstrate
control over that service's namespace/firewall, and the documented custom
launch/proxy interfaces do not provide such control. An alternate websocket URL
or a successful page load would not resolve this.

**Proposed smallest replacement: one dedicated Linux host running a stateless
Chromium worker, one disposable job container/network namespace at a time.**
This is an architecture decision/proposal, not an implemented or tested worker.
Use an existing suitable host first; otherwise a small 2–4 GB Linux VM is the
initial sizing candidate, to be load-tested. No VM has been purchased or provisioned.
This avoids operating Browserless's full CDP/function/BQL surface, a queue service,
a database, or Kubernetes. Ongoing work is host security updates, pinned browser
image updates, resource monitoring and rerunning network acceptance tests.

Minimum API: authenticated TLS `POST /render` with `{url}` only. Return bounded
HTML, final URL and HTTP status; no caller-provided JavaScript, launch flags,
proxy, cookies, filesystem path or browser profile. A trusted controller supplies
the URL over stdin and receives the result over stdout. Browser control uses
Puppeteer's pipe mode: no TCP DevTools listener in the job. Destroy each job.
Keep the API token only in the controller; job containers receive no Folio,
database, cloud, Docker-socket or provider secrets.

### Required authoritative boundary

Before any browser process starts, the trusted host installs a default-deny
OUTPUT policy **inside the job network namespace**, with additional host egress
rules. Host forwarding rules alone do not cover container-local loopback.

- Deny loopback/unspecified, private, link-local, CGNAT, multicast/reserved and
  metadata IPv4 destinations, including `127/8`, `0/8`, `10/8`, `172.16/12`,
  `192.168/16`, `169.254/16`, `100.64/10` and the host/gateway/control-plane IPs.
- Deny IPv6 entirely in the initial worker, closing IPv6 and mapped/transition
  bypasses. IPv6-only product support must be explicitly revisited and tested.
- Allow new public IPv4 TCP 80/443 only, plus TCP/UDP 53 to a fixed trusted public
  DNS resolver. No metadata exception, private DNS proxy or default proxy bypass.
- Allow only established replies. No published job ports, host network mode,
  shared control network, privileged browser process or retained CAP_NET_ADMIN.
- Apply rules before startup and verify them from the trusted controller; abort
  if setup fails. Browser/runner processes cannot modify them. Drop capabilities,
  use read-only rootfs plus bounded temporary storage, retain Chromium sandbox,
  and apply CPU/memory/PID/time/output limits.

The threat is malicious product HTML/JS, redirects, DNS and subresources. The
controller, host kernel/firewall and pinned image are trusted. The boundary must
hold even when URL checks or request interception miss a browser network feature.
An application parser, Puppeteer routing hook, network-error string or Chrome
launch flag is not the authoritative boundary. Application/DNS validation and
request interception remain defense in depth and useful error handling.

Docker documents per-container networking and capability boundaries, while its
forwarding rules live in the host namespace; this is why the design requires
explicit namespace-local enforcement too:
[container isolation](https://docs.docker.com/engine/containers/run/),
[Docker firewall placement](https://docs.docker.com/engine/network/firewall-iptables/),
[Docker security](https://docs.docker.com/engine/security/).

### Exact current blocker and acceptance requirements

There is no independently controlled worker host configured. Locally, Docker's
Linux engine did not become available after `docker desktop start` and a hidden
Docker Desktop launch; `docker info` repeatedly returned a missing
`dockerDesktopLinuxEngine` named pipe. The stalled CLI start was interrupted.
Historical Docker logs do not establish today's root cause. No firewall or
browser-container code was added on the strength of an untestable environment.

To resume browser implementation, supply a working Linux Docker/namespace test
environment or a dedicated Linux worker host with host-level firewall control.
Then implement the minimum controller/worker and execute the matrix below.

| Adversarial case | Current evidence |
| --- | --- |
| Loopback 127.0.0.1, 0.0.0.0, ::1; RFC1918; link-local v4/v6; metadata | Application URL/IP tests pass; **browser/network enforcement not run** |
| Public redirect to private | Direct-transport test proves no second socket; **browser test not run** |
| Mixed public/private DNS; rebinding | DNS mixed-answer and pinned-connection tests pass; **browser/kernel packet test not run** |
| Image/script subresource, fetch/XHR, iframe/private navigation | **Not run** |
| WebSocket, worker/service-worker, other browser mechanisms | **Not run** |

Tests must host controlled public adversarial pages and private canary listeners,
assert zero connections/hits at canaries, and inspect firewall deny counters.
Include delayed DNS answer changes and both IPv4 and IPv6 destination forms.
Prove the test rig can detect a deliberate breach in an isolated test-only
unrestricted namespace, so an unreachable canary cannot create a false PASS.

### Product-rendering parity

**No representative protected product page has been rendered successfully.**
The existing managed client still fails closed. Cache reuse and authenticated
escalation persistence are retained; JS hydration, hard-retailer access and
conditional captcha/stealth behavior previously supplied by BQL are unverified
and not restored through an unsafe fallback. Acceptance must cover ordinary
server-rendered, JS-hydrated and previously BQL-dependent retailer pages and
compare name, image, price, description, final URL, cache and scrapeStatus results.
If a hard retailer still blocks the isolated worker, it remains a parity gap;
any external solver/proxy requires its own public-only destination guarantees.

## Other P0 verification and configuration

- Removed unreachable middleware auth rate-limit code. Credentials handler
  remains authoritative for IP and email limits.
- Safe rate-limit outcomes: `rejected`, `missing_configuration`,
  `backend_timeout`, `backend_outage`. No identifiers, endpoints, tokens or
  exception text. Test exercises the actual SDK timeout with a stalled transport.
- Signed webhook integration executes the real handler and real thread matcher
  with only Prisma/auth/network boundaries replaced. Valid signature reaches
  outbound-message lookup, creates an inbound reply and updates thread status;
  tampering reaches zero database calls. These are application integration tests,
  not live production DB tests.
- `node --import tsx --test scripts/security/hardening.test.ts scripts/security/p0-routes.test.ts scripts/security/rate-limit-observability.test.ts`: **20 passed**.
- `node --import tsx scripts/security/idor-scan.ts --ci --out tasks/p0-completion-idor-after.md`:
  **exit 0, 0 Critical / 1 High / 16 Medium / 20 Low**. Remaining High explained above.
- `node scripts/guard-client-imports.js`: **passed**, 2,203 files / 915 clients.
- Changed-file lint: **zero errors, 10 warnings** (including three deliberately
  flexible mock-boundary types in the new route test harness).
- TypeScript diagnostic comparison: **1,009 before / 1,007 after, zero added**
  after normalizing source line/column shifts. The repository-wide typecheck
  still exits nonzero; the historical debt was not expanded into this task.
- `npm run build`: **exit 0**. Historical editorial schema errors logged during
  static generation do not turn build success into a healthy editorial-runtime
  claim. No schema changes were made.

### Distributed Upstash smoke procedure

Configure the same `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for
every production instance. Retain `RESEND_WEBHOOK_SECRET` for inbound mail.

1. Run `node --import tsx scripts/security/upstash-smoke.ts` from a trusted checkout
   with production Redis credentials. It uses a random `p0-smoke:*` key with a
   60-second TTL and starts three independent processes. Expected: allow/allow/
   reject and remaining 1/0/0. It never calls a real user's login endpoint.
2. To test separate deployment hosts, choose one fresh non-sensitive smoke ID.
   Run the script with `--attempt <same-smoke-id>` once on host A, once on host B,
   then again on A within the same minute window. Expected true/true/false.
   Wait for the reported reset; another attempt must succeed. Never reuse an
   actual auth identifier. If crossing a window, rerun with a fresh key.
3. Verify both hosts fail closed with missing credentials or a deliberately
   unavailable backend in staging; inspect the distinct safe outcome logs.

The local smoke attempt stopped because these Redis environment variables are
not configured. No live distributed PASS is claimed. No production secrets or
schema changes are required for the application tests.

## Remaining risks / release gate

Browser infrastructure and adversarial/parity verification are the P0 blocker.
Live Upstash smoke is pending environment configuration. The visible High is an
intentional shared-catalog policy the scanner cannot model, protected by a
conditional update and regression test. The 16 Medium/20 Low findings are not
claimed resolved by this bounded audit. Existing editorial schema drift
(`editorial_assignment.editorialId`) is recorded for the next appropriate phase;
no direct P0 impact was found and it was not modified. Historical repository
type errors remain. Do not label or deploy this as completed P0 hardening.
