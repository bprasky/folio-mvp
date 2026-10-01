# Live interview recording and media worker

The application records only the creator's consented stream. Recording runs,
original ordered chunks, raw aligned transcription, exact edit plans and job
leases remain private. Existing canonical interviews remain authoritative.
The same recording can produce portrait, landscape or audio editions, each
with an exact immutable edit plan and separate approval.

## Required infrastructure

1. Review `prisma/migrations/20261001120000_live_interview_private_media/migration.sql`.
   It adds two private SQL tables, actor/session foreign keys, claim indexes and
   RLS with client grants revoked. The application uses parameterized SQL, so
   no generated delegate is needed at runtime. The companion Prisma model
   proposal was approved and applied to the branch schema; see
   `docs/LIVE_INTERVIEW_MEDIA_SCHEMA_REVIEW.md`. This
   migration was applied to production on 2026-10-01 after separate explicit
   approval using `npm run migrate:deploy`. Synthetic tests also apply it
   twice to disposable PGlite. Other environments need their own migration.
2. Use the existing private Supabase bucket named `interview-media`.
   Keep public access **off**. Configure allowed MIME types `audio/webm`,
   `video/webm`, `audio/mp4`, `video/mp4` and a sufficient object size limit
   (512 MiB supports the enforced recording limit). Existing legacy audio
   recording limits remain enforced by their existing handlers. The current
   bucket's legacy MIME allowlist does not satisfy this configuration.
   No bucket settings were modified during implementation.
3. Run one persistent worker with FFmpeg and FFprobe. The worker supports
   one concurrent job per process. Start with one process, 2 CPUs, 2 GiB RAM,
   and 2 GiB scratch disk. It must reach the existing PostgreSQL, Supabase
   Storage and OpenAI endpoints. It does not receive Tavus camera imagery.
4. Keep the server flags off until the reviewed migration, bucket and worker
   are ready. New recording uses `FOLIO_INTERVIEW_RECORDING=1`; media creation
   and export uses `FOLIO_INTERVIEW_MEDIA_EXPORTS=1`. Archived authorized
   previews remain accessible when flags are disabled.

Production migration application was separately approved and completed;
creation flags remain off and the worker is not deployed. No paid test call
was performed. Existing `npm run db:check` points to a missing
`scripts/db-check.ts` in this checkout; this is a pre-existing setup gap.

## Local worker

Use Node 22 and the repository's installed dependencies. Install FFmpeg with
libx264, libass, libvpx and libopus; FFprobe must be from the same distribution.
`FFMPEG_PATH` and `FFPROBE_PATH` may name absolute executable paths if they are
not on PATH. The bootstrap loads the existing `.env.local` using Next's env
loader before application modules initialize. It handles Next's server-only
marker for this dedicated Node entry; do not use `--conditions=react-server`
with this repository's React 18 runtime.

```text
npm ci
node scripts/interview-media-worker.cjs --check-native
node scripts/interview-media-worker.cjs --check
node scripts/interview-media-worker.cjs
```

`--check-native` loads the actual worker imports and verifies both native
executables without claiming a job. `--check` also verifies private bucket
configuration and existing `OPENAI_API_KEY`. `--once` claims at most one job.
The normal command polls every three seconds. Stop gracefully with SIGTERM.

The existing server environment needs `DATABASE_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`INTERVIEW_MEDIA_BUCKET=interview-media` and `OPENAI_API_KEY`.
Do not expose service credentials through public variables or build arguments.

## Container deployment

```text
docker build -f Dockerfile.interview-media -t folio-interview-media .
docker run --rm --env-file .env.local --cpus=2 --memory=2g --pids-limit=128 --read-only --tmpfs /tmp:rw,size=2g --cap-drop=ALL --security-opt=no-new-privileges folio-interview-media
```

Use the existing deployment host's secret environment instead of baking in
`.env.local`. `.dockerignore` excludes local secrets and private task artifacts.
The container installs one FFmpeg implementation and Folio's existing licensed
Inter font. It runs as the unprivileged Node user. A Dockerfile is supplied;
the container was not built here because Docker's daemon is unavailable.

Migration execution, after approval, uses the repository commands:

```text
npm run db:guard
npm run db:backup
npm run migrate:deploy
npm run prisma:status
npm run verify:prisma
npm run db:check
```

Do not run `schema:push` on production. The approved branch schema and generated
client include both new models; the approved shared database migration was applied.
Rollback is disabling the flags and stopping new jobs; preserve
both private tables and stored media so accepted evidence is not deleted.

## Creator flow

Start an existing live interview with explicit voice or voice-and-camera
consent. Uploads go directly to private object reservations in bounded 5 MiB
chunks. A run is finalized only after every final recorder chunk is confirmed.
The worker assembles only the bytes belonging to a single recorder run;
separately restarted runs stay separate and retain their start offsets.

Open **Publishing Studio → Interview recordings and media** at
`/designer/studio/media`. Listen to the original normalized source, inspect
recording-aligned phrases, select moments, trim at actual phrase boundaries,
reorder chapters and choose authorized photos or your own camera footage.
Preview the rendered short clip, episode video or audio piece, approve its
exact version, publish to Folio and then export the approved file. Published
media has a real Folio page at `/interview-media/{id}` and links back to its
eligible original public source. Non-project pieces keep their real profile,
organization or story identity.

Private video drafts carry a visual marker; private audio drafts carry an
audible marker. They are actual rendered pieces, but do not provide a clean
export bypass. Source recordings themselves remain private. Short-lived signed
URLs can remain usable until expiry after withdrawal; already downloaded files
cannot be recalled. Refresh playback after a signed URL expires.

Changing any plan requires a new render and approval. Canonical source changes
invalidate existing delivery; changed source-selection permission also blocks
reusing old captures in a new plan. Recording corrections remain in canonical
interview history; captions continue to represent actual audio. Whisper supplies
segment timestamps, not invented word timings. AI interviewer video and remote
tracks are not captured or exported by this implementation.

## Verification evidence

```text
npx tsx --test scripts/core/live-media.test.cjs
```

Run with FFmpeg/FFprobe installed or explicit paths. The test uses disposable
PGlite PostgreSQL and actual native media processing. It verifies the idempotent
draft migration, session reservation, actor isolation, consent modes, ordered
chunk manifests, final data checks, private normalized source, aligned fixture
transcripts, portrait photography clip, chaptered landscape camera episode,
audio export, marked previews, exact approval/publication, stale source denial,
worker crash exhaustion, bounded explicit retry and cancellation fencing.

Storage, source authorization and transcription providers are mocked. Tone/color
fixtures are clearly synthetic and rights-free. These tests prove actual file
decoding/rendering and the application contracts; they do not prove live Tavus
turn-taking, real transcription quality, browser device behavior, worker
deployment or production storage readiness.
