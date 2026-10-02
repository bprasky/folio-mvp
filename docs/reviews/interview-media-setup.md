# Guided setup, recording preparation and live retry

The founder found uploads still visible during the interview, an unconditional no-recording message, and a Retry button returning the same live limit error.

## Root causes

- The Story host always mounted the upload disclosure. It now mounts only in Photos & details. Spoken upload actions navigate there; interview actions return to Story without reconnecting the host. Returning to Photos & details through the tab returns the canonical host to guidance.
- `project_guide` was explicitly excluded from recording availability and media-source authorization. Existing project guides now support a separate authenticated, consented recording action during the same call. Create+ remains unrecorded until there is a real project. Canonical interview progress remains in the snapshot; media identity is stable across guide/interview transitions.
- Production read-only evidence found five ended provider conversations for the pilot in the rolling day, with no configured daily override. The default five-call cap had become incompatible with automatic entry on workflow surfaces. The default is now 20 (configurable up to 30); concurrency and per-minute limits remain. Confirmed pre-provider failures no longer consume paid-call allowance. Genuine daily limits include a reset timestamp and disable an impossible immediate retry; capacity errors are distinct. Typed Tavus replies require a live call too, so quota copy directs users to the stepped workspace.

## Recording behavior

Tavus joins without an extra start gesture. In the Interview view, preparation describes a media opportunity, lighting, framing, sound and natural retakes. An explicit checkbox and Record action authorize private creator audio or camera/voice recording. Camera permission denial preserves the live conversation. Starting/stopping capture does not create another Tavus conversation; only the creator stream is captured. The camera requests 1280×720 at up to 30 fps, with 2 Mbps video encoding. The actual device/browser may supply a lower resolution. Uploaded sources remain private; publishing requires separate approval through the existing media pipeline.

The recording control is gated by real configuration. The guide receives only recording availability, never guesses that capture is running, and does not promise automatic clipping/publication. Recording links open the existing media library in a separate tab so they do not interrupt the call.

## Verification

- 41 transport checks, including consent, disabled state, owner/source isolation, ended sessions and no additional provider calls.
- 35 browser/capture checks, including in-call audio/video capture, camera denial, private preview, no camera sent to Tavus, final upload and daily-limit feedback.
- 19 composed Create+/project host browser checks, including uploads absent on Story, spoken upload navigation, same-call return, saved answers/reset and stepped fallback. Desktop/mobile screenshots inspected under `.tmp/project-guide-browser/review`.
- 15 guide adapter checks plus existing seven-kind adapter suite and planner checks. Existing projects resolve through private project media authorization; new/foreign projects and unpublished exports are denied.
- Disposable PostgreSQL + actual FFmpeg integration passes: private capture, leases, actual short/episode/audio outputs, approval/publication boundaries, quota accounting/reset timestamps and capacity errors. Actual Prisma reservation regression extended for hosted isolated PostgreSQL.
- Scoped lint (existing warnings only), client import guard, migration discipline and TypeScript budget 904/904 pass.

Browser and provider boundaries use synthetic data. No real device recording, paid test call, fabricated designer answer or production reset was performed. These checks do not establish production media processor availability.

## Production media dependency

Read-only inspection confirms `interview-media` is private and permits audio/video WebM/MP4. Its 20 MiB object cap accommodates 5 MiB chunks but must be increased for larger normalized recordings and outputs before worker activation. Recording/export flags and an OpenAI transcription key are absent from the inspected production environment; a persistent media worker deployment has not been established. The UI and consent path are implemented, but recording stays off until that infrastructure is configured and verified. Hosting clarification is pending from the founder. Do not describe recording or finished clips as live merely because this code is deployed.
