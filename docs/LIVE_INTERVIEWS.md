# Folio live interviews and recorded media

This implementation extends Folio's existing interview workspaces and Publishing Studio. Folio prepares and validates every question and persists answers through the existing editorial services. Tavus supplies the full speech/avatar pipeline with a per-session PAL and Folio's authenticated custom chat-completions endpoint. All three rollout flags default off. During the separately approved release on 2026-10-01, the production migration was applied and the Tavus key, callback origin and private bucket name were configured. Live, recording and export activation still require the remaining setup below.

## Setup

Install repository dependencies with `npm ci`. Use the existing git-ignored `.env.local`; never put credentials in browser variables. Required additions:

```dotenv
TAVUS_API_KEY=...
FOLIO_LIVE_BASE_URL=https://your-reachable-development-origin
TAVUS_FACE_ID=rc9cff32ceba
FOLIO_LIVE_INTERVIEWS=1
FOLIO_LIVE_ALLOWLIST=comma-separated-approved-Folio-user-IDs
FOLIO_INTERVIEW_RECORDING=1
FOLIO_INTERVIEW_MEDIA_EXPORTS=1
FOLIO_LIVE_MAX_SECONDS=1800
FOLIO_LIVE_MAX_CONCURRENT=3
FOLIO_LIVE_MAX_DAILY_PER_ACTOR=5
INTERVIEW_MEDIA_BUCKET=interview-media
```

These are **development/preview** settings, not authorization to activate production. Existing `DATABASE_URL`, `NEXTAUTH_SECRET`, Supabase server credentials, and Folio's existing interview-generation credentials remain required. Saved recordings additionally require `OPENAI_API_KEY` for recording-aligned Whisper transcription. Production rate limiting uses the existing Upstash configuration. Keep the existing guided, Spotlight, expertise, organization and account gates as configured; the live flag never bypasses them.

### Live interviews without saved recordings

Unrecorded live interviews require the migrated database, Tavus key, reachable callback origin, approved account ID in `FOLIO_LIVE_ALLOWLIST`, `FOLIO_LIVE_INTERVIEWS=1`, existing canonical interview credentials, and scheduled session cleanup. Keep `FOLIO_INTERVIEW_RECORDING=0` and `FOLIO_INTERVIEW_MEDIA_EXPORTS=0` until the media worker is ready. This mode does not require Whisper transcription, FFmpeg or a persistent media worker; Tavus supplies live speech and the avatar, and Folio saves accepted answers through the existing interview engine. Recording options stay unavailable.

`NEXTAUTH_SECRET` encrypts stored private joining tokens; backend credentials are stored as SHA-256 hashes. Changing that secret invalidates old encrypted join responses. Only authenticated owners receive joining credentials, with no-store/no-referrer responses.

Readiness checks print names and outcomes, never secret values:

```sh
npm run check:live:setup
npm run check:live:setup -- --provider --reachability --storage --database
```

The first command is static plus local native-dependency checks. The second makes explicitly labeled read-only Tavus, backend authentication, Supabase bucket and database metadata requests. Neither creates a paid call. The current documented Tavus `test_mode` suppresses PAL joining and cannot verify turn-taking; this implementation does not mislabel it as a live speech test.

The additive SQL migration is `prisma/migrations/20261001120000_live_interview_private_media/migration.sql`. It creates private session/media/job tables with RLS and revokes client roles. The founder approved the companion Prisma models and, separately on 2026-10-01, applying this exact migration to production. The guarded `migrate:deploy` command applied it successfully. Other environments still require this migration; Studio checks table presence before exposing the media library, without blocking existing archives when creation flags are off. Follow [schema review](LIVE_INTERVIEW_MEDIA_SCHEMA_REVIEW.md) and [worker setup](LIVE_INTERVIEW_MEDIA_WORKER.md) for other environments. Do not run migration commands against another production database without its approval.

## Reachable development backend

The production Content Security Policy allows Daily's call-object HTTPS and WSS hosts (including `dailywebrtc.com` and `dailywebrtc.net` failover), its documented `prod-ks.pluot.blue` endpoint, blob workers, and private Supabase audio/video playback. The installed npm SDK uses its default fetch/eval loader, covered by `connect-src` and the existing script policy; no external script-host allowance is needed. Camera/microphone remain restricted to the Folio origin and framing remains denied. Recheck [Daily's CSP requirements](https://docs.daily.co/guides/privacy-and-security/content-security-policy) when upgrading the SDK. `node scripts/check-live-csp.cjs` exercises the installed loader and allow/deny behavior in Chromium under the real response header with synthetic remote bytes; it creates no room or paid call.

The Tavus PAL uses `https://ORIGIN/api/live-interviews/provider/SESSION_ID/v1` as its base URL; Tavus appends `/chat/completions`. This route authenticates a session-scoped bearer credential; browser cookies cannot authorize it. It verifies the route session, expiry, current actor/source access, account approval, workspace and rollout gate before saving a turn.

For localhost, an existing ngrok installation/account can provide HTTPS:

```sh
npm run dev -- --hostname 127.0.0.1 --port 3000
ngrok http 3000 --inspect=false
```

Set `FOLIO_LIVE_BASE_URL` and `NEXTAUTH_URL` to that HTTPS origin, restart Next.js, and open the same HTTPS origin in your browser before signing in. Keep inspection disabled so credentials and private speech are not saved in a tunnel inspector. Stop the tunnel after testing. Verify with `check:live:setup -- --reachability` before starting a paid call. [ngrok HTTPS forwarding](https://ngrok.com/docs/gateway/endpoints/http).

Cloudflare Quick Tunnels currently document **no SSE support**, so they are not a substitute for this custom LLM stream. [Cloudflare limitations](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/#limitations).

For protected previews, the exact machine path `/api/live-interviews/provider/*/v1/chat/completions` must be reachable through the preview gateway while the Folio session bearer check remains enforced. Use a dedicated development origin or a path-specific gateway exception if your existing gateway supports it. The setup probe must return Folio HTTP 401 for an invalid credential. An SSO page, redirect or platform 403 means the machine route is still blocked. No global middleware/preview protection bypass is included.

## Interview and review

For an allowlisted, approved project owner, **Start/Resume interview** is the live start action. The guided workspace connects directly to the **Folio interviewer** beside the project photographs, without asking for a second Start click. A passive Story visit, page refresh or saved-answer review does not authorize a new call. Connecting progress, **Type instead** and explicit retry remain available; denied microphone access falls back to typed replies with Tavus. Existing unsent text, recording recovery, corrections and final review remain accessible in the saved-answer workspace. **Review saved answers** ends an active call before opening that workspace; **Return to live interview** brings back the main panel. Other supported interviews retain the shared compact panel.

**Type instead** keeps the same Tavus avatar and spoken responses while turning off the designer's microphone. It also supports starting with typed replies without microphone permission. Each reply is registered against an exact Folio question/version before the browser sends Tavus's documented `conversation.respond` interaction. Only the authenticated provider callback saves through the existing canonical interview engine. Typed and spoken replies use that same engine and preserve their input modality; Tavus is the shared conversation transport, not a second editorial decision-maker. [Tavus text interaction](https://docs.tavus.io/sections/conversational-video-interface/interactions-protocols/overview).

Typed drafts stay in actor/source-scoped session storage. Unsent drafts retain their question/version across reloads and can be cleared before starting a paid call. A changed question requires explicit reassignment. Submitted replies remain visible until the server confirms the save; ambiguous delivery is never automatically resent. Ending, expiry and failed saves preserve submitted text for review. Returning to the microphone requires an explicit click and permission, and is blocked while an unsent or unresolved typed reply remains.

When recording is enabled, choose no saved recording, voice, or voice and optional camera and accept the capture disclosure. Microphone permission is obtained before a paid voice start; text starts require recording mode `none`. Camera starts off and is not sent to Tavus. Switching to typing stops capture; returning to voice does not silently restart recording. Source photographs stay in the existing workspace; browsing does not attach a photograph to an answer.

Pause and End stop the provider call and release local media tracks. Accepted answers stay in their canonical interview. A new live call restores that progress and uses a new recording segment. If turn attribution or a canonical length limit needs review, the full raw answer remains private and visible for explicit review; it is never silently shortened. **Refresh current interview state** ends the call and reloads current canonical questions before deliberate reattribution. Starting again restores unresolved answers before requesting another paid call. **Discuss this photo** explicitly binds a project photo to the current answer. Corrections change editorial text, not the original recording. Publication eligibility rechecks current source versions.

The first question uses Tavus's verbatim custom greeting. Folio does not send another opener. Streaming utterances are provisional captions. The custom backend correlates its user history position with complete utterance events before saving; generated, delivered, interrupted and answered states are separate. A missing event or an interruption produces a visible recovery path. A paid live smoke test is still required to observe actual provider event ordering and latency; mocks cannot establish those properties.

Recorded chunks upload directly to narrowly signed private objects. Each MediaRecorder run has an ordered manifest; restarted runs are remuxed separately. The UI distinguishes uploading, processing, ready and incomplete states. The recording worker decodes the source before marking it playable, transcribes the actual stored media with segment timestamps, and uses the existing quote-provenance validator for suggested moments. There are no invented word timings, recorded tokens for unrecorded speech, or synthesized creator voices.

Use **Publishing Studio → Interview media** to listen to source recordings, select actual transcript-backed moments, adjust boundaries, order scenes and choose photography or creator video. Short video, chaptered episode video and audio use the same versioned edit-plan structure. Preview output is an actual rendered file. Exact-version approval and explicit Folio publication precede eligible clean export. Draft video previews are marked visually; draft audio previews have an audible marker. Signed source playback remains private owner access, not public publication.

## Worker and cleanup

Heavy remuxing, decoding, recording-aligned transcription and FFmpeg rendering run in a separate worker, never in the live request. Run one worker per deployment initially. The worker claims durable jobs with leases, rechecks permission/version boundaries and cleans its temporary files. See `Dockerfile.interview-media` and the worker command in `package.json`. This is a runnable worker implementation, not a deployed worker.

The production Vercel Pro deployment schedules `GET /api/cron/live-interviews` every minute through `vercel.json`. Set a random Production `CRON_SECRET` of at least 32 characters and redeploy; Vercel sends it as `Authorization: Bearer ...`. The endpoint fails closed when the secret is missing or wrong, accepts no browser-session substitute, and returns only a checked count or a generic error with `private, no-store`. Confirm the schedule and successful invocations in Vercel's Cron Jobs dashboard after deployment. [Vercel cron authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).

Each invocation reconciles at most one eligible session using the existing retry logic. Its Pro function duration is 800 seconds to accommodate paginated provider reads; individual provider requests time out after 20 seconds. Calls can overlap, so reconciliation remains idempotent and pending cleanup retains its durable reservation for a later invocation. Cleanup is independent of live, recording and export flags. It ends abandoned conversations and removes ephemeral PALs without creating new paid calls or holding a database transaction during provider requests. Provider maximum-duration, absent-participant and disconnect timeouts remain the last protection when cleanup is unavailable.

For another host, schedule `npm run live:cleanup` at least once per minute in a trusted environment. That CLI retains its default batch of up to 100 sessions and does not require the media worker or native FFmpeg binaries. Avoid running a second scheduler for the same deployment unnecessarily.

No callback ingestion endpoint is provided: the reviewed callback documentation does not establish a verifiable signature contract, and callback-supplied download URLs are not accepted. Authoritative cleanup uses authenticated provider reads.

The recording bucket must remain private and allow the selected audio/video MIME types and sufficient output size. The worker refuses objects over the bucket's configured limit; increasing that limit is an environment change to review. Set `FFMPEG_PATH` and `FFPROBE_PATH` when the binaries are not on PATH, or build the supplied container.

## Rollback and remaining boundaries

Set the live flag to `0` to stop new paid sessions and backend turns. End/cleanup and canonical text work remain available. Recording and media export have separate flags. Saved private media access does not depend on Tavus availability. Withdrawal/source revision is rechecked at media delivery; short-lived signed URLs already issued expire naturally. Files already downloaded outside Folio cannot be recalled.

Only creator tracks are captured in this implementation. AI avatar-containing public exports remain unavailable: isolated remote-track recording and applicable stock-face reuse rights were not established for this integration. Creator-only media is independent of that limitation. See [Tavus stock faces](https://docs.tavus.io/sections/faces/stock-faces), [terms](https://www.tavus.io/terms-of-service) and [source-type inventory](LIVE_INTERVIEW_INVENTORY.md). Protected Spotlight output requires current eligible selections, a published parent and exact assembled-piece approval; raw Spotlight evidence stays private. Collaboration media contains only the actor's own recording and uses their eligible real project/profile/org destination independently of the other participant's progress. Shared joint content is excluded; the existing joint article still requires both contributor approvals.

## Contract references and evidence

Contracts checked on 2026-10-01: [OpenAPI](https://docs.tavus.io/openapi.yaml), [custom LLM](https://docs.tavus.io/sections/conversational-video-interface/pal/llm), [PAL strategies](https://docs.tavus.io/sections/onboarding-guide/pal-strategies), [complete utterance](https://docs.tavus.io/sections/event-schemas/conversation-utterance), [speaking events](https://docs.tavus.io/sections/event-schemas/conversation-started-stopped-speaking), [provider recordings](https://docs.tavus.io/sections/conversational-video-interface/quickstart/conversation-recordings), [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder), [Supabase uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads). Tavus managed cloud recording is not enabled.

Verification results and exclusions are recorded in [results.md](reviews/live-interviews/results.md). Synthetic fixtures and mocked Tavus/DB boundaries are explicitly identified. No measured real Tavus join/response latency, real-device microphone quality, production migration, worker deployment or production activation is implied by local tests.
