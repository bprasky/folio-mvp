# Recorded interview / media integrity — storage approval gate

Date: 2026-09-09. Branch: `codex/folio-hardening`. Starting commit: `8de750ead9465edd642b4d62bb754353b1c44f4e`.

## Result

Implementation is paused at the brief's explicit storage gate. Read-only inspection confirms that **no existing bucket accepts the recorded client's audio**. No application, Prisma schema, bucket configuration, media object, or production record was changed.

The brief says: “If no suitable existing bucket exists: STOP before infrastructure mutation and return the minimal bucket/config proposal.” Step 13 separately requires approval for a new bucket or policy change. This is the reason for stopping; it is not an automatic approval-review rejection.

## Verified storage metadata

The audit used Supabase storage.listBuckets with configured credentials. It did not list objects, retrieve media, upload files or change policies.

| Bucket | Allowed MIME types | Configured size limit | Public/private |
|---|---|---:|---|
| festival-images | image/* | 5,242,880 bytes | Public |
| event-images | image/* | 5,242,880 bytes | Public |
| project-images | image/* | 5,242,880 bytes | Public |
| product-images | image/* | 5,242,880 bytes | Public |
| user-avatars | image/* | 5,242,880 bytes | Public |
| imports | application/pdf; application/vnd.openxmlformats-officedocument.presentationml.presentation; image/jpeg; image/png; image/gif; image/webp | Not set at bucket level | Public |
| product-meshes | application/octet-stream; model/gltf-binary; model/gltf+json; image/png; image/jpeg | Not set at bucket level | Public |
| analytics | application/json | Not set at bucket level | Private |

A null bucket limit does not establish an unlimited service/platform upload limit. Relabeling audio as application/octet-stream to use product-meshes would evade the intended media policy and is not proposed.

**BUCKET:** event-images, resolved from SB_BUCKET_NAME or the handler fallback.

**ALLOWED MIME TYPES:** image/*.

**MAX SIZE:** 5,242,880 bytes (5 MiB).

**PUBLIC/PRIVATE:** public.

**ACTUAL CLIENT MIME:** MediaRecorder requests audio/webm;codecs=opus. RecordingInterface constructs the final Blob as audio/webm and submits it as recording.webm.

**COMPATIBLE? NO.**

RecordingInterface requests microphone audio only. Its comment implies a browser fallback, but no isTypeSupported negotiation or alternate MIME selection exists. Video is not captured by this component. Unsupported WebM recording may fail at MediaRecorder construction; the source does not establish working MP4 fallback.

## Minimal proposal for approval

Create one dedicated bucket:

- Name: `interview-media`.
- Privacy: **private**; raw recordings must not become public merely because uploaded.
- Allowed MIME types: **audio/webm** for the current mounted recorder. No video, image wildcard or arbitrary binary uploads.
- Bucket size limit: **20,971,520 bytes (20 MiB)**, a proposed explicit application policy, not an assertion about transport/provider limits. Match or lower the application limit after checking the chosen upload transport.
- Access: authenticated server authorization before upload/read; service-role storage operations; short-lived signed read URLs only for authorized consumers. No anonymous read, write or listing policy.
- Objects: unique server-generated names scoped to the interview, rather than overwriting `recording.webm`.
- Application configuration: use a dedicated interview bucket setting; do not change shared SB_BUCKET_NAME or broaden event-images.

This proposal does not authorize a bucket creation yet. Any later additional format, such as audio/mp4, must be justified by actual client negotiation and matched server validation; it is not part of this initial proposal.

## Source findings confirmed before the stop

### Recording/upload

`RecordingInterface` → POST `/api/interviews/[id]/upload` → Supabase upload → MediaAsset → InterviewSession.

The route checks a server session and createdByUserId, permitting DRAFT or UPLOADED. It accepts any audio/* label, does not enforce an application size limit, derives the extension from the submitted filename, and overwrites `interviews/<interviewId>/recording.<ext>` with upsert:true. It uses getPublicUrl, not signed access.

Storage errors return HTTP 500 before MediaAsset writes; they do not produce a success response. However, storage, MediaAsset persistence and InterviewSession persistence are separate operations. A later DB failure can leave a stored object or an unlinked asset. There is no cleanup transaction/compensation. The initial session select omits recordingAssetId although the subsequent code reads it, so intended re-upload asset reuse is unreliable.

MediaAsset requires id and updatedAt under the current Prisma schema, but the create payload omits them. Successful current-runtime upload persistence has not been established.

### Processing

POST `/api/interviews/[id]/process` intends to check createdByUserId, require UPLOADED plus a recording, download the recording, call Whisper, persist TranscriptSegment, extract quotes, persist QuoteHighlight and advance the session.

Its current includes use `recordingAsset`, `project` and `product`; current InterviewSession relations are `MediaAsset`, `projects` and `products`. These are stale source names, not grounds to restore old Prisma aliases. TranscriptSegment createMany omits required IDs; QuoteHighlight createMany omits required IDs/updatedAt. Status changes and result writes are not committed as one stage transaction.

The source's quote prompt asks for verbatim text, but the inspected processing code does not independently validate returned quote text/ranges against persisted transcript segments. Extraction failure sets TRANSCRIBED, while entry accepts only UPLOADED, leaving retry behavior to fix.

No transcription, LLM, recording download or process request was executed.

### Actual statuses

Prisma declares DRAFT, UPLOADED, TRANSCRIBING, TRANSCRIBED, EXTRACTING, EXTRACTED, CLIPPING, READY, PUBLISHED, ARCHIVED. There is no generic PROCESSING, APPROVED or REJECTED InterviewSession status.

The inspected processing route intends UPLOADED → TRANSCRIBING → TRANSCRIBED → EXTRACTING → EXTRACTED; transcription failure resets UPLOADED and extraction failure resets TRANSCRIBED. These are current source intentions, **not a verified legal state machine**. Approval/publishing and complete reader exposure remain to audit after approval.

### Vendor identity constraint

Current Prisma declares InterviewSession.vendorId → historical Vendor (optional) and VendorBoostRequest.vendorId → historical Vendor (required). Product.vendorId separately points to User. Substituting a User or Organization ID into either historical FK is not a valid source-only repair.

The vendor-boost request source previously confirmed obsolete Product.vendorRecordId/vendorRecord reads. The next implementation phase must finish mapping the mounted boost path and determine whether an existing, trustworthy adapter can satisfy the current schema. **No schema proposal is approved or implemented here.** If canonical identity cannot be represented without changing those FKs, a separate concrete schema proposal is required by the brief.

## Remaining authorized work after the storage decision

- Finish the complete mounted entry/status/approval/boost/insight-reader graph.
- Determine a valid canonical boost identity mapping without inventing old Product relations.
- Implement bounded MIME/content handling and owner-scoped storage access against the approved bucket.
- Make upload success mean committed MediaAsset/session linkage; define duplicates, compensation and orphan risk.
- Repair mounted Prisma names and required create fields.
- Implement conditional status transitions and persisted transcript/highlight provenance checks.
- Add upload/failure/replay/boost/approval tests with transcription and AI mocked.
- Run core journeys, quote/provenance, security, client-import guard, TypeScript ratchet, lint, Prisma validation and production build.

## Verification scope and unchanged baseline

Only branch synchronization, source/schema inspection and live read-only bucket metadata were performed. Main had no new commits and the tracked application tree was clean at the start.

No media-focused, boost, quote, core, compiler, lint or production build checks were run for this paused implementation. Previous session results are not presented as proof of these paths.

The committed baseline is unchanged: **972 diagnostics / 609 fingerprints / 247 files**. No new fingerprint measurement is claimed in this audit-only phase.

No live interview/transcript/user records were queried. The existing-data evidence is bucket metadata only.

**PRISMA SCHEMA CHANGES: NONE**

**STORAGE CONFIGURATION CHANGES: NONE**

RECORDED INTERVIEW INTEGRITY INCOMPLETE — no existing bucket accepts recorded audio; approval required for a private interview-media bucket.
