# Recorded interview / media integrity — implementation report

Date: 2026-09-09. Branch: `codex/folio-hardening`. Starting commit: `e38b5e18`.

The independent recorded-audio path is implemented. Canonical vendor boost creation remains blocked by the explicitly unapproved identity migration below. No Prisma schema or migrations were changed.

## Storage configuration

**INTERVIEW MEDIA BUCKET: CREATED AND VERIFIED**

The approved Supabase operation created exactly `interview-media`. A subsequent metadata read verified:

| Property | Verified configuration |
|---|---|
| Privacy | Private (`public: false`) |
| MIME allowlist | `audio/webm` only |
| Bucket limit | 20,971,520 bytes / 20 MiB |
| Read policy | No anonymous/authenticated direct object grant for this bucket; owner-authorized server signing, TTL 300 seconds |
| Write/delete policy | Server/service-role operations only |
| Listing | No anonymous/authenticated listing grant for this bucket |
| Object names | `interviews/<session-id>/<server-generated-UUID>.webm` |
| Objects uploaded during verification | **0** |

Storage RLS is enabled. All five inspected pre-existing storage policies are restricted to `imports`; none grants access to `interview-media`. No additional policy was necessary. No other bucket was modified.

The applied Storage API contract was:

```ts
supabase.storage.createBucket('interview-media', {
  public: false,
  allowedMimeTypes: ['audio/webm'],
  fileSizeLimit: 20_971_520,
});
```

The application requires `INTERVIEW_MEDIA_BUCKET=interview-media`; missing or different configuration fails closed. It is documented in `.env.example` and configured locally. The shared `SB_BUCKET_NAME` is untouched. **Set this dedicated variable in the deployment environment before deploying this code. No deployment/environment promotion was performed.**

Application upload limit: **4,194,304 bytes / 4 MiB**, below the approved bucket maximum. The current multipart request passes through a Vercel Function; 4 MiB leaves overhead below its documented 4.5 MB payload limit. [Vercel payload limit](https://vercel.com/docs/errors/function_payload_too_large).

The recorder requests microphone audio and WebM/Opus only, checks `MediaRecorder.isTypeSupported`, and submits an `audio/webm` Blob. Unsupported browsers receive an explicit message. There is no MP4 fallback or video support added.

## Recorded architecture and authorization boundaries

```text
Canonical vendor request
  POST /api/vendor-boost/request → 503 pending identity migration
Existing persisted VendorBoostRequest (historical Vendor FK)
  /designer/boost-inbox → BoostInboxClient
  POST /api/vendor-boost/[id]/accept
    requested designer + project access + conditional PENDING claim
    → transaction creates InterviewSession and links request
Independent POST /api/interviews/create
  designer session + owned/designed project and/or existing product
  → DRAFT InterviewSession
  boost reference resumes only the already accepted, consistently linked session

/designer/interviews/[id] (creator/designer only)
  → RecordingInterface → POST /api/interviews/[id]/upload
  → private storage object → transactional MediaAsset + session linkage
  → UPLOADED status view / Process Interview
  → POST /api/interviews/[id]/process
  → service-role object download → transcription provider
  → persisted TranscriptSegment rows
  → extraction provider → persisted-transcript validation → QuoteHighlight
  → /designer/interviews/[id]/approve (creator/designer only)
  → approve-highlights → READY → explicit Publish Approved Quotes → PUBLISHED

Owner playback:
  PrivateRecording / review Play Segment
  → GET /api/interviews/[id]/media
  → authorize creator/designer → sign associated canonical asset for 300 seconds
Status polling:
  GET /api/interviews/[id]/status → creator/designer only; no media URL

Readers:
  GET /api/products/[productId]/insights
    → approved quotes + PUBLISHED interview + published project
  GET /api/projects/[id]/interview-quotes
    → assertProjectView + approved quotes + PUBLISHED interview
  extractDesignerReasoning(userId)
    → existing creator-scoped PUBLISHED sessions / persisted segments / approved quotes
```

Runtime graph qualifications: the create API, request API, and both quote-reader APIs are mounted Next routes. Source search found no current UI caller of interview creation or canonical boost request creation. `DesignerInsights` exists as a leaf component without a current import/mount; its obsolete raw-audio control was removed. No new navigation entry point or product-page placement was invented. The recorded interview pages and boost inbox are mounted pages with their client components. `upload-url` and `confirm-upload` had no current source callers and now return constant 410; neither can sign or persist client-supplied references.

Profile-field source records and the existing text/editorial interview journey are separate systems and were not rewired into this recorded-media path.

| Boundary | Enforcement |
|---|---|
| Create | Authenticated DESIGNER; project owner/designer; product existence; product/project tag agreement when both supplied |
| Upload/process/approve/publish | Authenticated DESIGNER and exact `createdByUserId`; immutable session context drives subsequent operations |
| Session and review pages | Creator/designer before rendering private data |
| Status/sign | Creator/designer only; old vendor-context shortcut removed |
| Storage | Fixed dedicated bucket, server-generated key; no arbitrary URL fetching/signing |
| Boost accept/decline | Persisted `requestedDesignerId`, DESIGNER role, conditional status/version; accept validates current project access |
| Public product quotes | Approval and publication are mandatory; `approvedOnly=false` cannot bypass them |
| Project quotes | Existing project authorization plus approval/publication; no raw recording |

## Upload guarantee

**UPLOAD SUCCESS MEANS: storage upload succeeded, a canonical MediaAsset row exists, the same authorized InterviewSession points to it, and that session committed UPLOADED through a conditional database transaction.**

The handler rejects non-WebM MIME, empty input, oversized input and missing EBML/WebM DocType markers before storage mutation. It ignores the submitted filename and generates the extension. The lightweight header check is not a full media decoder or proof of an Opus-only track.

Storage upload uses `upsert: false` and a unique UUID. The DB transaction creates MediaAsset, conditionally links the same creator/status/prior asset/version, and removes the old asset row on replacement. A losing or failed transaction attempts to delete the new object and returns failure. Cleanup failure emits a safe `orphan-cleanup-failed` event without keys, user details, provider errors or URLs.

Re-upload is allowed only in DRAFT/UPLOADED. A failed replacement preserves the prior valid asset/object; a successful replacement removes the previous object after the DB commit. Old-object cleanup failure leaves an orphan without invalidating the newly committed recording. Processing and later states reject replacement.

Storage is outside the DB transaction. Process termination between storage and compensation, or failed cleanup, can leave an orphan. No durable cleanup queue or automatic reconciliation service was introduced.

## Private access

Canonical identity uses existing fields: `MediaAsset.storageKey` plus `metadata.bucket`. The required `url` string contains an internal `storage://interview-media/...` locator, never a permanent public/signed URL. Pages and status DTOs do not expose that locator.

The media endpoint signs only the asset associated with the authorized session, validates its bucket/key/session scope, and returns a five-minute URL with `Cache-Control: private, no-store`. Playback requests access on demand; the owner can refresh expired access. Review playback gets a new URL for each segment. Processing downloads via service role using the canonical object reference and never fetches a persisted arbitrary HTTP URL.

Publishing a quote does not publish the raw audio. Product insights are text-only.

## Prisma source repairs

- `recordingAsset` → `MediaAsset`; `project` → `projects`; `product` → `products` in session queries.
- `highlights` → `QuoteHighlight`; nested highlight `interviewSession` → `InterviewSession`; `createdBy` → `users`.
- Boost readers use `products`/`projects`; stable client DTO names are mapped explicitly.
- Project slugs come from `post.slug`, not nonexistent `Project.slug`.
- Explicit UUIDs and required timestamps on InterviewSession, MediaAsset and QuoteHighlight creates; explicit UUIDs on TranscriptSegment creates.
- Explicit `updatedAt` on lifecycle writes; recording timestamp set when upload commits.
- Removed obsolete `vendorRecordId/vendorRecord` request queries; canonical request creation fails closed pending the schema gate.
- Removed server-to-client inline callback from the interview page; UPLOADED now exposes its existing process action, and READY has a working publish action.

## Status machine

| Operation | Legal transition | Failure / replay |
|---|---|---|
| First upload | DRAFT → UPLOADED | Prior state remains; compensate new object |
| Replacement | UPLOADED → UPLOADED, new asset | Prior recording remains on failure; stale conditional write fails |
| Transcription | UPLOADED → TRANSCRIBING → TRANSCRIBED | Failure → UPLOADED, safe retry message |
| Extraction | TRANSCRIBED → EXTRACTING → EXTRACTED | Failure → TRANSCRIBED; retry does not transcribe again |
| Quote approval | EXTRACTED → READY; READY selection updates allowed | Atomic selection membership/provenance/version validation |
| Publish | READY → PUBLISHED | Atomic approved-quote validation; linked legacy boost completes in same transaction |

Existing transcriptionJobId/extractionJobId fields carry unique attempt tokens. Stage persistence and failure resets match the claimed status, attempt, creator and recording. Duplicate/stale work cannot overwrite another attempt. Transcript and quote row writes are transactional with their corresponding completion status.

There is no mounted CLIPPING transition in this flow. PUBLISHED, ARCHIVED and other later states cannot be re-uploaded or reprocessed. No APPROVED/REJECTED session status was invented.

Processing remains synchronous. A hard runtime kill or a database outage that prevents the failure-state write can leave an in-progress state requiring operational review; this task does not add durable job scheduling or crash recovery.

## Quote provenance

Extraction always reads persisted TranscriptSegment rows, including on the initial run. Zod validates generated shape, timestamp integers, use case and score. A candidate must align with a contiguous sequence of persisted segment boundaries, and its text must pass existing `isVerbatimSpan` normalization against that selected source. Invented, paraphrased or mismatched-range candidates are omitted. If none survives, extraction returns to TRANSCRIBED.

Every accepted quote uses the server session's interview/product identity. Approval and publication recheck transcript backing. Approval rejects unknown, duplicate or overlapping approved/rejected IDs, and saves the complete selection atomically. Public readers cannot request unpublished/unapproved speech.

## Vendor boost identity and minimal unimplemented proposal

Production read-only evidence: **4 historical Vendor rows; 0 with userId; 0 boost requests; 0 recorded sessions**. `Vendor.userId` is not an enforced unique/FK adapter. `Product.vendorId` identifies User, while the two recorded-boost FKs identify historical Vendor. No name/domain/UUID reinterpretation is safe.

Canonical request creation now returns authenticated unavailability (503), rather than querying imaginary aliases or using the wrong identity. Existing persisted historical requests can be read/accepted/declined with server-controlled context; their mocked tests do not establish a canonical vendor adapter.

**Proposal only, not implemented:** preserve the existing text columns and align both vendor references with User, matching Product.vendorId. Keep Organization as the existing vendor authorization context; do not conflate membership with ownership. Preserve the current delete actions.

Affected Prisma blocks (only the listed fields):

```prisma
// InterviewSession: replace vendor relation
vendor User? @relation("RecordedInterviewVendor", fields: [vendorId], references: [id], onDelete: SetNull)

// VendorBoostRequest: replace vendor relation
vendor User @relation("RecordedBoostVendor", fields: [vendorId], references: [id], onDelete: Cascade)

// User: add two named inverses; preserve the existing creator/designer inverses
recordedVendorInterviews InterviewSession[] @relation("RecordedInterviewVendor")
recordedVendorBoostRequests VendorBoostRequest[] @relation("RecordedBoostVendor")

// Vendor: remove only these obsolete inverse fields:
// InterviewSession InterviewSession[]
// VendorBoostRequest VendorBoostRequest[]
```

Exact current FK names/actions were verified read-only. Minimal SQL proposal, requiring schema/migration approval and a fresh aggregate audit before application:

```sql
BEGIN;
LOCK TABLE public.interview_sessions, public.vendor_boost_requests
  IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.interview_sessions WHERE "vendorId" IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.vendor_boost_requests) THEN
    RAISE EXCEPTION 'Vendor references now exist; stop for an explicitly reviewed identity mapping';
  END IF;
END $$;

ALTER TABLE public.interview_sessions
  DROP CONSTRAINT IF EXISTS "interview_sessions_vendorId_fkey";
ALTER TABLE public.interview_sessions
  ADD CONSTRAINT "interview_sessions_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES public.users(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.vendor_boost_requests
  DROP CONSTRAINT IF EXISTS "vendor_boost_requests_vendorId_fkey";
ALTER TABLE public.vendor_boost_requests
  ADD CONSTRAINT "vendor_boost_requests_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES public.users(id)
  ON UPDATE CASCADE ON DELETE CASCADE;
COMMIT;
```

No historical Vendor rows need deletion. After approval, restore request creation using authenticated canonical product ownership, active vendor organization context, current ProductTag/project/designer checks, and explicit required IDs/timestamps. Update vendor display projections for User and run canonical vendor creation through acceptance/publish tests. None of that identity conversion was implemented here.

**VENDOR BOOST IDENTITY: PRISMA CHANGE REQUIRED**

## Existing data — aggregate only

| Observation | Count |
|---|---:|
| InterviewSession, all statuses | 0 |
| Sessions with recording / without recording | 0 / 0 |
| MediaAsset rows / unlinked rows | 0 / 0 |
| TranscriptSegment / QuoteHighlight | 0 / 0 |
| VendorBoostRequest, all statuses | 0 |
| Historical Vendor / with userId | 4 / 0 |
| Duplicate nonnull Vendor.userId groups | 0 |
| Missing referenced media rows | 0 |
| Inconsistent session/boost context | 0 |
| Quote/session product mismatches | 0 |

Read-only transactions queried aggregates, column metadata and FK/policy definitions. No transcript, media, user identifiers, emails or tokens are included here. No application data was mutated.

## Verification

Focused `npm run test:recorded-media`: **28 passed, 1 explicitly skipped** (canonical boost creation pending schema approval).

Covered cases:

- Supported/missing/unsupported WebM recorder capability.
- Owner upload and canonical private identity; anonymous, other designer, vendor and swapped-session denial.
- MIME, empty, oversized, container mismatch and absent-config rejection.
- Storage failure; DB create/link failure with rollback and compensation; cleanup failure logging.
- Failed replacement preservation; successful distinct replacement; competing upload winner/loser; every later state rejects replacement.
- Owner-only bounded signing, no-store, no signing of another session's key.
- Missing-media processing, anonymous/other-designer/vendor denial.
- Transcription failure/retry and saved transcript.
- Extraction-only retry, invented quote rejection, timestamp mismatch rejection.
- Transcript/quote persistence failure rollback and stale/duplicate processing.
- Approval/publish authorization, membership, provenance, illegal state and replay; corrupted quote rejection.
- Product and project reader publication/approval filters, including `approvedOnly=false`.
- Review pages/status deny strangers even with vendor context.
- Retired protocols cannot persist/sign arbitrary input.
- Persisted legacy boost context, acceptance rollback, expiry, replay, decline conflict, and client context substitution rejection.
- Attempt cannot persist after creator changes during provider work.
- Actual provider-adapter response parsing with mocked SDK responses.

External storage, transcription and extraction services are mocked. The local transaction double serializes and restores snapshots; it proves application rollback/losing-write handling, **not PostgreSQL lock behavior**. The WebM fixture is a synthetic header fixture, not an uploaded/playable-media compatibility test. No safe staging context was available for a live media upload, so none was performed. No live transcription/LLM calls were made.

Additional checks:

| Check | Result |
|---|---|
| Persistence regressions | 34 passed |
| Core journeys | 8 tests passed; disposable-DB journey group explicitly skipped |
| Existing pull-quote/provenance suite | Passed; unchanged script executed with installed Git Bash for its Unix grep command |
| Existing quote audit | Passed |
| IDOR | 559 routes; 0 Critical, 1 existing High, 15 Medium, 11 Low; no new Critical/High |
| Client import guard | Passed |
| Ratchet guard tests | 5 passed |
| Changed-source lint | Passed; one pre-existing image optimization warning in DesignerInsights |
| Prisma validate | Passed |
| Migration discipline | Passed: 32 loose SQL baseline, 0 phantom calls, 0 missing SQL, 0 non-idempotent recent DDL |
| Type preparation | Passed after fixing the initial component parse error |
| Production build | Passed |

All five protected journeys remain green: signup/onboarding; project/image/tag creation; owner/stranger/organization authorization; saved text interview/editorial generation/review/publication; vendor collaboration invitation/acceptance/isolation. Recorded media is not required by those journeys.

## TypeScript

| Metric | Before | After |
|---|---:|---:|
| Diagnostics | 972 | 904 |
| Fingerprints | 609 | 574 |
| Files with diagnostics | 247 | 233 |

New fingerprints: **0**. Debt reduced by **68 diagnostics** through scoped stale source repair/removal. The lower baseline was recorded by `typecheck:baseline:update`; unrelated errors were not repaired.

## Infrastructure / schema

**PRISMA SCHEMA CHANGES: NONE**

**STORAGE CONFIGURATION CHANGES: APPROVED interview-media only**

No schema migration, production application-data mutation, media upload, paid model call, main-branch merge or deployment was performed. Prior parked P0 infrastructure and the separate completed claim/attribution/editorial/persistence work remain unchanged.

RECORDED INTERVIEW INTEGRITY INCOMPLETE — canonical vendor boost identity requires approval of the proposed User FK migration
