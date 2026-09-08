# Folio isolated renderer

Implementation is ready for Linux acceptance, **not approved for production**.
The Windows development host has no working Docker Linux engine. No Chromium
image build, nftables installation, browser sandbox, canary matrix or live product
rendering has been verified here. Unit tests are not a substitute for those gates.

## Request and trust path

Folio server (existing auth/ownership/budgets, cheap pinned HTTP first)
→ HTTPS POST /render with a Bearer key
→ Caddy TLS terminator on a dedicated Linux host
→ loopback-only Node controller
→ fresh Docker container / network namespace, idle trusted process
→ controller installs and checks nftables policy
→ UID 1000 Chromium via Puppeteer pipe
→ public IPv4 TCP 80/443 and one fixed DNS resolver.

The controller returns only `{html, finalUrl, status}`. No caller JavaScript,
browser flags, headers, cookies, profiles, proxy or filesystem options exist.
Unknown body fields fail before launch. Current and previous keys support a
two-key rotation window; comparisons hash to equal length and use timingSafeEqual.

Trusted: Linux kernel, root controller, Docker daemon, nftables/nsenter/ip tools,
pinned image and dependencies, Caddy, DNS resolver (for availability/accuracy),
host administrators and deployment configuration. Untrusted: URL, DNS answers,
HTTP responses, all page JavaScript/HTML, workers, browser network requests and
returned browser output. DNS compromise can change public content, but must not
enable a packet to a denied address. A kernel escape is outside this boundary.

## Exact network boundary

- Docker bridge `folio-render`, interface `br-folio-render`, subnet
  `10.203.0.0/24`, gateway `10.203.0.1`, inter-container connectivity disabled.
  Every render gets its own container network/PID/mount namespaces.
- The trusted controller enters only the job network namespace using nsenter
  and host nft. It installs an `inet folio_render` table before Chromium starts.
  OUTPUT/INPUT default DROP; egress allows public IPv4 TCP 80/443 and TCP/UDP 53
  to the configured public resolver, then drops everything else. Private/special
  address denies precede all port allows. Established reply traffic is allowed
  inbound; IPv6 is denied before that exception.
- The same address/port policy is installed on the host's FORWARD hook at
  priority -200 for this bridge. Host INPUT drops all traffic arriving from the
  bridge, including traffic to the host's public address. This separate table
  does not flush Docker's or the host's other firewall tables.
- Blocked IPv4 includes unspecified, RFC1918, CGNAT, loopback, link-local and
  metadata, documentation/benchmark/AS112/transition and multicast/reserved
  networks. See `DENY_V4` in `policy.mjs` for exact CIDRs. All local IPv4 addresses
  and the Docker gateway are additionally denied. Configure externally hosted
  controller/load-balancer/control-plane addresses in `RENDER_BLOCKED_IPV4`.
- IPv6 disabled through container sysctls AND denied by inet nftables rules.
  IPv6-only sites are unsupported. No host networking or published job ports.
- The root-owned resolver file is mounted read-only, replacing Docker's embedded
  loopback resolver. No arbitrary UDP/TCP DNS destination is allowed. Chromium
  managed policy turns off automatic DoH. HTTPS itself is still public internet
  access; public HTTP APIs that return DNS data cannot override packet filtering.
- No job capabilities; no NET_ADMIN, NET_RAW or SYS_ADMIN. Non-root user namespace
  sandbox, no-new-privileges and a reviewed default-deny seccomp profile retaining
  Docker restrictions except the documented namespace syscall delta. Browser
  cannot alter the original namespace firewall. No Docker socket, Folio secrets,
  host filesystem or controller key in the image/container. No TCP CDP listener.
- Network setup errors, policy drift, unexpected network configuration and failed
  cleanup stop admission. Host and namespace rule fingerprints are verified before
  browser exec. The kernel acceptance suite must prove that the intended policy
  is effective; fingerprints alone are not proof of packet filtering.

## Bounds and operational errors

One render at a time, no queue; busy returns 503. HTTP request ≤8 KiB, headers/body
deadline 5 seconds. URL ≤4096 characters, HTTP(S), default ports only. HTML ≤5 MiB;
JSON transport ≤30 MiB +8 KiB for escaping. Container: 1 CPU, 768 MiB RAM/no extra
swap, 192 PIDs, 1024 file descriptors, read-only root, 256 MiB temporary storage,
64 MiB shared memory. Fresh profile is destroyed with its container.

Launch 10s, navigation 25s, hydration/network idle ≤5s, browser command ≤45s.
Isolation+render overall 55s, cleanup ≤10s, controller transport 75s. Idle job exits
at 60s even if its controller dies; restart removes all labeled stale jobs.
Folio's scraper route allows 120s for cheap fetch, escalation and later extraction.

Structured fixed outcomes: invalid_url, forbidden_destination,
isolation_setup_failure, browser_launch_failure, navigation_timeout,
retailer_blocked, oversized_response, internal_worker_error. Log only outcome and
duration; no URL, request body, HTML, token or raw subprocess stderr. Folio users
receive generic renderer-unavailable/manual-entry guidance. Monitor success/error
counts, busy responses, latency, memory pressure, residual labeled containers,
host nft counters and service restarts through journald/normal host monitoring.

## Deploy (after passing acceptance on the target host/image)

Initial sizing candidate: dedicated Debian Linux, 2 vCPU / 2–4 GiB RAM, one job.
This is an unbenchmarked starting point, not a capacity guarantee. Operational
components: one VM, Docker, one controller service, Caddy. No database/queue/cluster.
Use a host supporting unprivileged user namespaces and Chromium sandboxing.
Ubuntu AppArmor userns restrictions may need a narrowly reviewed profile; do not
work around a launch failure with `--no-sandbox`, SYS_ADMIN or unconfined seccomp.

1. Install Docker Engine, Node 22, nftables, iproute2, util-linux and Caddy on a
   dedicated Linux host. Docker's normal bridge forwarding/NAT must work. Leave
   Docker firewall management enabled. Do not use rootless Docker, a remote
   DOCKER_HOST, host-networked jobs, or share this controller with unrelated jobs.
2. Copy this directory to `/opt/folio-render`, root-owned and not writable by the
   browser user. Run `npm ci --omit=dev --ignore-scripts`. Build with
   `docker build --pull -t folio-render:acceptance .`. Record the base/image/browser
   versions. The Dockerfile uses current Debian security packages at build time;
   production execution requires the immutable local `sha256:...` image ID from
   `docker image inspect folio-render:acceptance --format '{{.Id}}'`.
3. Install `deploy/controller.env.example` as `/etc/folio-render.env`, mode 0600.
   Generate a random ≥32-character key locally; configure image ID, trusted DNS,
   and any non-local control-plane IPv4 addresses. Never bake this file into an
   image. `seccomp.json` must remain alongside the controller.
4. Complete the Linux acceptance steps below **before starting production traffic**.
5. Install `deploy/folio-render.service`, run `systemctl daemon-reload`, then
   `systemctl enable --now folio-render`. Install `deploy/Caddyfile`, replacing
   `{$RENDER_HOSTNAME}` with the dedicated renderer DNS name. Validate it with
   `caddy validate --config /etc/caddy/Caddyfile`, then reload Caddy. Configure DNS
   and TLS normally. Expose only HTTPS and the ports needed for certificate
   issuance; never expose 8787 or Docker. Prefer ingress allowlisting to Folio's
   fixed egress where available, in addition to the required Bearer key.
6. Set Folio `RENDER_WORKER_URL=https://<renderer>/render` and
   `RENDER_WORKER_API_KEY` to the same key. Old Browserless keys do not enable any
   runtime renderer. Run the public smoke and representative application flows.

Rotation: set new current + previous old key on controller, restart; update Folio,
verify, remove previous and restart. No request logs containing Authorization.
Updates: rebuild with security updates and pinned npm lock, review image/profile
diffs, run the full matrix on that exact image ID and kernel, then update service
image ID and restart. Rollback only to a previously accepted immutable image.
On host address/firewall changes, stop admission and restart to rederive denies;
rerun acceptance. A firewall administrator and host kernel are trusted components.

## Linux adversarial acceptance

Use a **dedicated test worker VM** and a separate public fixture host/domain with
no production data. The acceptance script cannot be called through the render
API and is excluded from the Docker image. It modifies test network namespaces,
starts private listeners and deliberately removes one namespace policy for its
positive control. Never install its interlock on a production host.

Public fixture host:

- Run `test/public-fixture.mjs` with `FIXTURE_ZONE` (real DNS hostname),
  `FIXTURE_PUBLIC_IPV4` (its public IPv4), `FIXTURE_ADMIN_KEY` (fresh ≥32 chars),
  `FIXTURE_TLS_KEY` and `FIXTURE_TLS_CERT` (valid certificate covering fixture
  hostname). It serves HTTP 80, HTTPS 443, UDP/TCP DNS 53. Restrict DNS access to
  the worker test host's public address. The fixture DNS returns only fixture-zone
  records; it is not a recursive/open resolver. All content is synthetic.
- External DNS must resolve the fixture hostname publicly. The worker uses the
  fixture's own DNS address for mixed and changing answers. The service-worker
  page uses valid HTTPS; other probes use HTTP to avoid mixed-content interference
  where possible. The fixture reset endpoint requires its separate admin key,
  which is never passed to the browser.

Test worker, from this directory:

```sh
printf '%s\n' 'DEDICATED TEST HOST' | sudo tee /etc/folio-render-acceptance-host
# Set environment securely; do not paste secrets into recorded commands.
# FOLIO_RENDER_TEST_HOST=YES
# RENDER_IMAGE_ID=sha256:<built immutable image>
# FIXTURE_ORIGIN=https://<public fixture hostname>
# FIXTURE_PUBLIC_IPV4=<public fixture IPv4>
# FIXTURE_ADMIN_KEY=<fixture reset key>
sudo --preserve-env=FOLIO_RENDER_TEST_HOST,RENDER_IMAGE_ID,FIXTURE_ORIGIN,FIXTURE_PUBLIC_IPV4,FIXTURE_ADMIN_KEY node test/linux-acceptance.mjs
```

The harness checks Chromium's namespace/seccomp sandbox, requires the deliberately
unrestricted sandboxed browser to reach a loopback canary, and separately tests
host gateway filtering with namespace filtering absent. Each protected attack
gets fresh HTTP/WebSocket/UDP canaries, private aliases and a fresh container.
It requires zero canary connections and kernel denial/IPv6-disable evidence.
Workers/service workers must acknowledge executing their request. Mixed DNS is
also rejected at validation; rebind DNS changes between an initial public answer
and the browser's lookup. Low TTL does not assume Chromium honors rebinding.

`browserDenyPackets` and separate `packetWitnessDenyPackets` are recorded, since
Chromium may reject PNA/mixed-content requests before sending any packet. A raw
packet witness independently tests the same destination policy in that namespace;
it is never presented as a browser packet. Zero browser deny counters require
review of the browser's pre-network denial and must not be reported as firewall
interception. `acceptance-results.json` is ignored and contains only synthetic
fixture HTML plus counters. Do not commit live retailer captures or credentials.

The fixture resolver only resolves its test zone. After completing the matrix,
optional `DIFFICULT_RETAILER_URL` runs with freshly installed policy using
`DIFFICULT_DNS_IPV4` (default 1.1.1.1). It records rendering/status without saving
real HTML; a successful page still needs a real product extraction comparison.
Only an explicit retailer block is classified as a compatibility limitation.

## Product parity and application checks

Linux acceptance renders static, JS-hydrated, legitimate redirect and browser
fetch-dependent product fixtures. It saves synthetic outputs for the real Folio
extractor. From repository root:

```sh
RENDER_ACCEPTANCE_RESULTS=services/render-worker/acceptance-results.json node --import tsx --test scripts/security/render-parity.test.ts
node --import tsx --test scripts/security/hardening.test.ts scripts/security/p0-routes.test.ts scripts/security/rate-limit-observability.test.ts scripts/security/render-client.test.ts scripts/security/render-parity.test.ts scripts/security/render-legacy.test.ts
node --import tsx scripts/security/protected-browser-smoke.ts
node --import tsx scripts/security/upstash-smoke.ts
```

Parity checks name, image, price, description, final URL/status and real escalation
handler cache/scrapeStatus writes with infrastructure replaced. Browser outputs
must additionally come from Linux acceptance. A real historically hard/BQL retailer
is a separate compatibility gate; no captcha-solving/proxy fallback is restored.
Missing Redis credentials leave live shared-count verification pending.

## Integration boundaries and compatibility limitations

`src/lib/server/render-product.ts` replaces deleted `protected-product.ts`.
`/api/scrape-product` keeps cheap pinned fetch first and only renders thin results.
`products/[productId]/scrape-bql` keeps auth, ownership predicates, user/product
budgets, domain/recent-block gate, cache and status writes; extraction now uses the
worker's final URL. Existing provider launch assertions were deleted with the
unreachable managed transport, not relaxed to allow that provider.

The shared legacy client now routes getContent/bql to this worker. No managed
REST/function/GraphQL calls or remote CDP connection remain in runtime source.
Its shared entrypoint requires a server session and a 20/user/hour budget, closing
the legacy vendor action's otherwise unauthenticated/unbudgeted rendering path.
Its direct fallback uses existing pinned safeProductFetch. Arbitrary runFunction
and its website harvester were removed; website import extracts rendered HTML
with the existing Cheerio routine. It no longer collects computed CSS-only
background images or natural-size filters, and scroll-only lazy imagery may be
missed. These are explicit compatibility gaps, not a reason to restore unsafe
remote execution. Standalone historical scripts under src/tests are not runtime
fallbacks and must not be used as P0 acceptance tools.

Reference rationale: [Docker network firewall interaction](https://docs.docker.com/engine/network/packet-filtering-firewalls/),
[Docker security](https://docs.docker.com/engine/security/),
[Chromium Linux sandbox](https://chromium.googlesource.com/chromium/src.git/+/master/sandbox/linux).
