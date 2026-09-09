# Canonical recorded vendor identity — session report

Date: 2026-09-09. Branch: `codex/folio-hardening`.
Starting SHA: `2d5d8e81b62a3937ada5e7251e5584dc6eca49df`.

## Pre-migration gate

Repeated read-only checks before editing and immediately before application found:

| Mandatory gate | Result |
|---|---:|
| InterviewSession rows | 0 |
| InterviewSession rows with nonnull vendorId | **0** |
| VendorBoostRequest rows | **0** |
| Historical Vendor rows | 4 |

`users.id`, `vendors.id`, `interview_sessions.vendorId`, and `vendor_boost_requests.vendorId` are all PostgreSQL `text`. Session vendorId remains nullable; request vendorId remains required.

Exact original constraints:
- `interview_sessions_vendorId_fkey` → `vendors(id)`, ON UPDATE CASCADE / ON DELETE SET NULL.
- `vendor_boost_requests_vendorId_fkey` → `vendors(id)`, ON UPDATE CASCADE / ON DELETE CASCADE.

The configured application database had **106 migrations, up to date**, before this work. The user explicitly approved this FK-only change, including guarded application under the repository workflow. No populated identity conversion was authorized or performed.

Schema backup: `%TEMP%/schema-prisma-backup-recorded-vendor-user.prisma`.
Pre-edit schema SHA-256:
`2F52DD4288AEB9CC6666DC866D671AC1F3212D6F9F8411BFE4361C49C2FD56B5`.

Migration discipline passed before schema editing and before application. Format, validate and generate passed. The session plan records restoration from backup and stopping if those schema checks fail; no restoration was needed.

## Exact semantic schema diff

```diff
 model InterviewSession {
-  vendor Vendor? @relation(fields: [vendorId], references: [id])
+  vendor User? @relation("RecordedInterviewVendor", fields: [vendorId], references: [id], onDelete: SetNull)
 }

 model VendorBoostRequest {
-  vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)
+  vendor User @relation("RecordedBoostVendor", fields: [vendorId], references: [id], onDelete: Cascade)
 }

 model User {
+  recordedVendorInterviews InterviewSession[] @relation("RecordedInterviewVendor")
+  recordedVendorBoostRequests VendorBoostRequest[] @relation("RecordedBoostVendor")
 }

 model Vendor {
-  InterviewSession InterviewSession[]
-  VendorBoostRequest VendorBoostRequest[]
 }
```

Prisma format also aligned whitespace in the adjacent User inverse-relation block. No other relation semantics changed. Existing creator/designer inverse fields remain intact.

## Migration

**VENDOR BOOST USER FK MIGRATION: APPLIED**

File: `prisma/migrations/20260909180000_recorded_vendor_user_identity/migration.sql`.

Applied through `prisma migrate deploy` after the repeated zero-reference check. This was the only pending migration. Its safety check also executes inside the same transaction as the FK replacement while both affected tables are locked:

```sql
-- Approved identity correction only. No populated identity conversion is allowed.
BEGIN;
LOCK TABLE public.interview_sessions, public.vendor_boost_requests
  IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.interview_sessions WHERE "vendorId" IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.vendor_boost_requests) THEN
    RAISE EXCEPTION 'Vendor references now exist; explicit identity mapping required';
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

Post-application `migrate status`: **107 migrations, database up to date**.
Read-only PostgreSQL constraint inspection confirms both references now target `users(id)`, with the original delete/update actions preserved.

No tables or columns were created, renamed or removed. No data update, backfill, User mutation or production-data repair was performed. Prisma migration bookkeeping records the single applied migration.

## Historical Vendor

The historical Vendor model/table and all **four rows** remain. Only the two obsolete inverse relation fields were removed from Prisma. EventVendorEdge, VendorPreviewToken, other historical relationships and vendor shadow/adapters are unchanged.

## Canonical boost architecture

```text
Authenticated vendor User
  → active non-viewer VENDOR / MANUFACTURER / SHOWROOM Organization membership
  → Product whose vendorId equals that User.id
  → verified Project + ProductTag + owner/designer User
  → VendorBoostRequest (vendorId = authenticated User.id)
  → requested Designer's boost inbox
  → conditional, unexpired PENDING acceptance
  → InterviewSession (vendorId copied from persisted request;
      creator = accepting Designer; product/project copied from request)
  → private audio upload → transcription → transcript-backed extraction
  → designer approval → publication
  → approved/publication-gated quote reader
```

`POST /api/vendor-boost/request` is restored from its schema-blocked 503 response to authorized persistent creation. The API is mounted; no new request button or product-page placement was added. The existing boost inbox, acceptance UI and recorded-interview pages remain the mounted consumer path.

## Authorization

Request creation requires:
- An authenticated `VENDOR` User.
- The existing `vendorClaimMembership` policy: active OWNER/ADMIN/MANAGER/MEMBER membership in a VENDOR, MANUFACTURER or SHOWROOM Organization.
- **Direct canonical Product ownership**: Product.vendorId must equal the authenticated User ID. Membership in another organization, brand/name matching, or a supplied owner ID is insufficient.
- An existing project and a current ProductTag connecting that product to an image in the project.
- A requested designer who is the project's owner or designer and has the DESIGNER role. When omitted, the target is derived from the project's designer/owner.
- Bounded request message and expiry.

Organization membership is authorization context, not an alternate product-ownership claim. No new organization verification/claim policy was invented: this operation acts on a product already owned by the concrete User. Client vendor/organization fields are ignored; they cannot set requester identity.

Context validation, duplicate detection and creation use one serializable transaction. A conflicting/failed transaction returns failure; it does not report an unsaved request. Live pending and accepted duplicates are rejected. An expired pending request cannot be accepted, and does not permanently prevent a fresh request.

Acceptance and decline retain their existing server-session checks. Acceptance requires the exact requested DESIGNER, current project access, PENDING status, no existing linked session, unexpired request and matching version. The database transaction copies all persisted request context into the new session and links both sides. It does not look up a vendor by name/domain. Wrong designers, terminal/replayed requests, expiry and stale versions fail. Decline is also a conditional designer-owned PENDING transition.

Independent recording creation still uses explicit required IDs/timestamps and no vendor association. A boost reference resumes only its existing accepted and consistently linked session; client product/project substitution is rejected.

## Identity and display

`VendorBoostRequest.vendorId → User.id`

`InterviewSession.vendorId → User.id`

`Product.vendorId → User.id`

`OrganizationUser = authorization context`

Boost API/page projections now select `vendor.name` and `vendor.profileImage` from User. The stable client vendor DTO maps `logoUrl` explicitly from User.profileImage, with a fallback display name. No historical Vendor or fake vendorRecord lookup is used.

The published quote remains tied to its persisted product/session. The complete-flow test resolves both session vendor and product vendor to the same canonical User and confirms no historical Vendor delegate was queried.

## Existing data after migration

| Aggregate | Count |
|---|---:|
| InterviewSession | 0 |
| InterviewSession with nonnull vendorId | 0 |
| VendorBoostRequest | 0 |
| Orphaned session vendor references | 0 |
| Orphaned boost vendor references | 0 |
| Historical Vendor | **4** |

No private identifiers or content were gathered for this report. Application test records exist only in the deterministic test database double; no production request/interview/media rows were created.

## Tests

| Suite/check | Result |
|---|---|
| Focused vendor boost | **8 passed, 0 skipped** |
| Full recorded media | **33 passed, 0 skipped** |
| Product attribution | 8 passed |
| Vendor claims | 17 passed |
| Core journeys | 8 tests passed; disposable-database journey group explicitly skipped |
| Pull-quote/provenance | Passed |
| Quote audit | Passed |
| Product Record invariants | Clean, zero violations |
| Ratchet guards | 5 passed |

The previously schema-gated test is active and checks generated Prisma relation metadata. Focused coverage now includes:
- Authorized canonical vendor request and inferred/verified designer context.
- Anonymous/non-vendor denial; inactive/viewer/non-vendor organization membership denial.
- Wrong Product ownership, incorrect designer and missing product/project tag rejection.
- Spoofed vendor/organization IDs cannot change requester identity.
- Wrong designer cannot accept or decline.
- Duplicate creation, repeated acceptance/decline, declined and expired request rejection.
- Stale version loses without creating an orphan session.
- Failed acceptance transaction rolls back the request state.
- Accepted-session vendor/product/project identity exactly matches persisted canonical context.
- Complete private upload → process → transcript → quote → approval → publish path.
- Boost completion and public quote/product context, without historical Vendor lookup.
- Canonical User display projection in the designer inbox.

Storage and provider boundaries are mocked. The local transaction double serializes and rolls back snapshots: these tests prove application behavior, not PostgreSQL concurrency/serialization mechanics. The real database proof in this session is migration status, FK definitions, compatible types and aggregate post-migration counts. No live model calls, media uploads or production test-data mutations were performed.

All five protected core journeys remain green: signup/onboarding; project/image/tag persistence; resource/organization authorization; text interview/editorial generation/review/publication; vendor collaboration invitation/acceptance/isolation. Recorded boosts remain additive.

## Recorded media guarantees

The existing private `interview-media` bucket was read back: private, `audio/webm` only, 20,971,520-byte bucket limit. **No storage configuration changed.** The 4 MiB application cap, WebM capability/MIME validation, unique server object paths, owner authorization, transactional linkage, compensating cleanup, five-minute signed access, processing retries, persisted-transcript quote validation and publication gating are preserved.

This session does not establish live recording/browser/provider compatibility. The previous report's deployment requirement still applies: deploy with `INTERVIEW_MEDIA_BUCKET=interview-media`. No application deployment was performed here.

## TypeScript

| Metric | Before | After |
|---|---:|---:|
| Diagnostics | 904 | 904 |
| Fingerprints | 574 | 574 |
| Files with diagnostics | 233 | 233 |

**NEW FINGERPRINTS = 0**. Type preparation and typecheck passed. The baseline is unchanged because diagnostics did not decrease; unrelated debt was not modified.

## Security and build

| Check | Result |
|---|---|
| IDOR | 559 routes; 0 Critical / 1 pre-existing High / 15 Medium / 11 Low; no new Critical/High |
| Product invariants | Passed |
| Client import guard | Passed |
| Changed-file lint | No warnings or errors |
| Prisma format/validate/generate | Passed |
| Migration discipline | Passed: 32/32 loose SQL, 0 phantom delegates, 0 missing SQL, 0 non-idempotent recent DDL |
| Migration status | 107 migrations, up to date |
| Production build | Passed |

No historical identity conversion, broad schema cleanup, new storage configuration, unrelated code repair, main merge or production application deployment was included.

RECORDED INTERVIEW INTEGRITY COMPLETE
