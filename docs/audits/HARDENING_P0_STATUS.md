# P0 security hardening — in progress, not production-ready

This is the historical first checkpoint. See [the completion-phase review](P0_COMPLETION_REVIEW.md)
for current Critical/High dispositions, additional tests and the browser architecture decision.

Date: 2026-09-08. Branch: `codex/folio-hardening`.

## Findings and changes

| Boundary | Before | Current implementation |
| --- | --- | --- |
| Inbound email | Unauthenticated payloads, including `email.test`, processed | Raw-body Svix verification before dispatch; missing/invalid signatures rejected; missing secret returns 503 in every environment |
| Credentials login | Local email counter; IP check in middleware excluded by its own matcher | Both IP and email checks in credentials callback; production uses shared Upstash fixed-window limits |
| Rate-limit failures | Instance-local state lost on restart | Production denies missing configuration, transport errors and SDK timeout; development/test retain local counters |
| Scraper | Public, arbitrary fetches and redirects | Session and user limit required; URL/IP validation, all DNS answers checked, chosen address pinned to the socket, every direct redirect revalidated |
| Browser rendering | Browserless navigates with unrestricted network behavior | Experimental protected client verifies actual launch flags and fulfills GET resources through the pinned transport; rejects current provider configuration |
| Media policy | First-party camera/microphone denied | `camera=(self), microphone=(self), geolocation=()`; other policies unchanged |

The middleware matcher excludes API routes. Consequently the old IP login check
never executed. Moving the enforcement into `authorize` closes that gap. All
existing imports of the asynchronous rate-limit API were updated to await it.
The multiple-limit helper also no longer counts the final limit twice.

CameraCapture, RecordingInterface and useVoiceRecording are the three current
getUserMedia callers; each is first-party and compatible with the policy.

## Browser blocker — observed, not hypothetical

Live probes against the configured managed Browserless service found:

1. Proxy flags in the JSON launch argument were omitted.
2. Direct query flags applied the proxy, but the provider rewrote the bypass list
   to `--proxy-bypass-list=<-loopback>;0.0.0.0;production-sfo.browserless.io`.
3. The renderer rejected that configuration before navigation, as required.

The private-address bypass defeats the proposed network boundary. Do not relax
the assertion or restore unrestricted `/content`, `/function` or BQL fallback.
The user explicitly requested a protected browser path, so disabling it is not
an accepted completion outcome. The current renderer does not work on the
configured provider and P0 remains incomplete.

To continue, provide a Browserless endpoint that honors all launch restrictions,
or a browser environment with independently enforced public-only egress.
`BROWSERLESS_PROTECTED_WS_URL` supports a TLS endpoint override. Merely setting
this variable is not proof: repeat the smoke test, then adversarial browser
tests for redirects, subresources, workers, WebSockets and private destinations.
The old BQL escalation handoff is absent from this draft; feature parity remains
to be resolved through a protected path before release.

## Verification

- `node --import tsx --test scripts/security/hardening.test.ts`: 9 groups passed.
  Includes signed test event, tampering, absent headers/secret, stale timestamps,
  private/encoded addresses, mixed DNS answers, connection pinning, blocked
  private redirects, local reset/counting, missing
  production configuration, simulated backend outage and rejected browser flags.
- `node scripts/guard-client-imports.js`: passed (2,203 source files, 915 clients).
- ESLint on changed JS/TS files and added files: zero errors, 174 warnings,
  predominantly historical `any` usage in the generation route.
- `tsc --noEmit --pretty false --incremental false`: 1,009 baseline diagnostics;
  initially 1,007 after changes, then 1,009 after rebuilding generated Next types.
  No diagnostics in the new security helpers or scraper. A newly generated
  diagnostic concerns the pre-existing `listAllContacts` export in the untouched
  rep-contacts route. This is not a clean typecheck. The baseline is the rebased
  working branch, not a measurement of clean main.
- Final production build (including protected-client dependency): exit 0.
  Static generation logged a database schema mismatch for
  `editorial_assignment.editorialId`. Build success does not establish healthy
  editorial runtime behavior. No database changes were made.
- `npm run security:idor:ci`: fails with 3 Critical, 14 High, 16 Medium and 20 Low
  findings. Critical routes: org feed, inquiry and prompts. No critical finding
  is in the modified routes. This static scan is not a runtime IDOR test.
- `node --import tsx scripts/security/protected-browser-smoke.ts`: fails closed
  on the managed provider's injected proxy bypass. No successful protected render.

Still unverified: live distributed Redis behavior across instances; route-level
webhook/thread integration; browser egress and rendered product parity. No completion claim.

## Deployment actions and dependencies

Do not deploy this draft as completed P0 hardening. Before eventual deployment:

- Configure one shared `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
  across production instances. Missing values intentionally deny auth attempts.
- Configure `RESEND_WEBHOOK_SECRET` from the webhook's signing secret.
- Resolve and verify the browser environment described above.

Dependencies: official Upstash Redis/rate-limit SDKs avoid a homegrown distributed
store; Svix 1.x supplies timestamp/signature verification while supporting the
repository's declared runtime; ipaddr.js handles IPv4/IPv6 normalization and
special ranges; puppeteer-core supplies CDP control without downloading Chrome.

References: [Resend verification](https://resend.com/docs/webhooks/verify-webhooks-requests),
[Upstash timeout behavior](https://upstash.com/docs/redis/sdks/ratelimit-ts/features),
[Browserless launch parameters](https://docs.browserless.io/overview/launch-parameters),
[Browserless proxy parameters](https://docs.browserless.io/baas/bot-detection/proxies).

Prompts 2–6 have not started, preserving the requested order.
