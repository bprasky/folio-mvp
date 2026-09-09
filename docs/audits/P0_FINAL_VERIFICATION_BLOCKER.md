# P0 final verification attempt — 2026-09-08

Verification baseline: branch codex/folio-hardening, implementation commit
1d57d5e0. Origin fetched; no newer main commits at baseline. No renderer,
networking, sandbox, application, or harness implementation was changed.

## Environment / provisioning blocker

No dedicated Linux test host has been provisioned or accessed. Tool inventory
exposes no compute provisioning connector. The local shell has ssh.exe but no
configured SSH host. No aws, az, gcloud, hcloud, doctl, vercel or gh command was
found. Standard AWS/Azure/gcloud/Hetzner/DigitalOcean/SSH configuration paths are
absent. Process environment and local .env/.env.local contain no populated
matching cloud, RENDER_*, FIXTURE_* or UPSTASH_* configuration. Values were not
printed. This is evidence of unavailable access in this session, not a claim
that the user has no cloud account.

The user was asked which cloud account or dedicated Linux host to use, with
sudo access, a public fixture hostname and shared staging Upstash configuration.
No provider was selected, no resources were purchased and no production system
was used for a deliberate-breach test.

| Required environment value | Observed Linux value |
| --- | --- |
| Distribution/version | Not provisioned |
| Kernel | Not observed |
| Docker | Not observed |
| nftables | Not observed |
| Node | Not observed on Linux |
| CPU/RAM | Not provisioned |
| Public/private test topology | Not configured |
| Immutable renderer image digest | Not built |
| Chromium | Not running / version not observed |
| Puppeteer | Runtime not observed; source lock alone is not proof |

## Exact acceptance failure

The existing acceptance entrypoint was invoked without implementation edits:

`node services/render-worker/test/linux-acceptance.mjs`

It exited 1 and reported:

> Linux root/Docker/nftables unavailable; no network cases executed

Its completedCases array was empty. The temporary failure-result file contained
no captures and was removed after recording this evidence. A Windows invocation
is not Linux network evidence and is not being treated as such.

## Runtime isolation proof

No running render job exists in the available test environment. UID, effective
capabilities, Chromium sandbox, read-only root, resource limits, mounted secrets,
IPv6 state, DNS settings, pipe transport, CDP listeners and Docker socket exposure
are all **unobserved**. The implementation's configuration is not substituted for
observed runtime values.

## Deliberate breach proof

HTTP/fetch, image/subresource, WebSocket and worker-originated positive controls
were **not run in Chromium**. No canary hit counts exist. The protected suite did
not proceed. A local canary unit test passed but does not satisfy this gate.

## Protected adversarial matrix

No results below assert zero connections or firewall blocking. No packet capture,
namespace counter or host counter was collected.

| ATTACK | BROWSER MECHANISM | PACKET EMITTED? | CANARY CONNECTIONS | NAMESPACE DENY COUNTER | HOST DENY COUNTER | RESULT |
| --- | --- | --- | --- | --- | --- | --- |
| 127.0.0.1 | Direct navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| 0.0.0.0 | Direct navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| 10/8 | Direct navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| 172.16/12 | Direct navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| 192.168/16 | Direct navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| 100.64/10 | Direct navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| 169.254/16 | Direct navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Cloud metadata | Direct navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Docker gateway | Direct navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Host private interfaces | Direct navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Controller addresses | Direct navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| ::1 | IPv6 navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| IPv6 private/link-local | IPv6 navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Public redirect to private | HTTP redirect | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Mixed public/private DNS | DNS + browser fetch | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Changed/rebinding DNS | DNS + browser fetch | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Low-TTL changing answer | DNS + browser fetch | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Alternate textual private IP | URL parsing + navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Unauthorized resolver | DNS UDP/TCP | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Private image | img | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Private script | script | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Private stylesheet/font | CSS/font | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Private fetch | fetch | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Private XHR | XMLHttpRequest | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Private iframe | iframe/navigation | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Private WebSocket | WebSocket | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Worker request | Web Worker | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Service worker request | Service Worker | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Private beacon | sendBeacon | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Prefetch | link rel=prefetch | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| Preconnect | link rel=preconnect | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| DNS-prefetch | link rel=dns-prefetch | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |
| WebRTC/STUN | UDP | Unmeasured | Unmeasured | Unmeasured | Unmeasured | NOT RUN |

## Product parity

| Category | Expected | Actual browser result | Final URL/status | Result |
| --- | --- | --- | --- | --- |
| Static fixture | Acceptance Oak Chair, chair.svg, 249 USD, controlled oak description | Unobserved; static extractor unit passes | Unobserved | NOT RUN on Linux |
| JS-hydrated fixture | Same product after JS hydration | Unobserved | Unobserved | NOT RUN |
| Public redirect | Public final URL and correct product | Unobserved | Unobserved | NOT RUN |
| Browser-fetch-dependent fixture | Product appears after browser fetch | Unobserved | Unobserved | NOT RUN |
| Difficult real retailer | Real product extraction or an observed retailer block | No retailer contacted | Unobserved | NOT RUN; no compatibility classification made |

## Folio integration

No staging Folio/renderer deployment was available, so the live cheap-fetch →
escalation → worker → extraction → database flow did not run. Local tests cover
pinned direct transport, signed webhook matching, authorization, ownership,
request budgets, output/final-URL validation and cache/status persistence with
infrastructure replaced. Cache avoidance and failure behavior in mocks are not
claimed as live integration evidence. The runtime source scan confirms the
managed provider/BQL transport remains absent; this is source evidence only.

## Upstash

`node --import tsx scripts/security/upstash-smoke.ts` exited nonzero with:

> Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN before running this smoke test.

No independent-process shared counts, cross-host counts or live reset behavior
were observed. Local missing-configuration/outage/timeout/rejection tests pass;
no live Redis behavior is inferred from them. No Redis token or URL was printed.

## Local regression results

Worker/controller/harness: 13 passed. Application P0 suite: 23 passed, 1 skipped
(the test requiring Linux-rendered output). IDOR: 0 Critical / 1 documented High /
16 Medium / 20 Low, exit 0. Client guard passes, 2,203 source files / 915 clients.
Targeted renderer/client lint and worker service lint pass with no errors or
warnings. Production build exits 0. TypeScript diagnostics: 1,009 before / 1,007
after; zero added after normalizing source line/column shifts. The repository
typecheck still exits 1 for historical diagnostics; no type cleanup was made.
Secret/artifact review found no credentials, profiles or HTML captures in the
checkpoint. The only checkpoint changes are documentation and scanner output.

## Corrections and remaining risks

No implementation corrections: deployment never reached a Linux runtime where
a concrete defect could be observed. Only this evidence report, task log and the
fresh scanner report are checkpointed. No unrelated hardening was started.

The remaining blocker is access to a dedicated Linux test host/cloud account,
public fixture infrastructure, a staging Folio environment and shared Upstash
credentials. Until those are available, the required runtime isolation proof,
positive controls, protected packet matrix, live rendering and live distributed
limits cannot be established. Existing implementation risks remain unverified;
no new theoretical cleanup work is proposed.

P0 INCOMPLETE — dedicated Linux test/fixture access and staging Upstash configuration unavailable
