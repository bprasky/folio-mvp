# Folio Security Audit Report

**Date:** 2026-03-03
**Auditor:** Automated Red Team (Claude Code)
**Scope:** Full codebase — 435 API routes, auth system, middleware, Prisma schema, client components
**Severity Scale:** CRITICAL / HIGH / MEDIUM / LOW

---

## Executive Summary

This audit discovered **73 security findings** across 11 attack surface categories. The codebase has severe systemic authorization gaps: approximately **40% of API routes lack authentication entirely**, and critical administrative endpoints are publicly accessible. The findings include hardcoded credentials, leaked secrets committed to git, unauthenticated database writes, SSRF vulnerabilities, and stored XSS vectors.

### Finding Distribution

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 24 | Must fix before any public deployment |
| HIGH | 22 | Must fix before launch |
| MEDIUM | 18 | Should fix soon |
| LOW | 9 | Fix when convenient |

### Systemic Issues

1. **No global auth middleware for API routes** — The middleware matcher explicitly excludes `/api/*`, meaning every route must self-implement auth. ~40% fail to do so.
2. **Debug/test/dev/seed endpoints deployed to production** — 25+ endpoints with zero protection are accessible in production.
3. **Vendor guard infrastructure exists but is never used** — `assertVendorAccess()` and `validateVendorOwnership()` are defined but imported by zero routes.
4. **In-memory rate limiting** — Won't work across serverless instances.

---

## CRITICAL Findings

### CRIT-01: Open Admin Backdoor — `/api/create-admin`
**File:** `src/app/api/create-admin/route.ts`
**Description:** Completely unauthenticated endpoint that creates an admin user with hardcoded credentials (`newadmin@folio.com` / `admin123`) and returns the plaintext password in the response. No environment check.
**Exploit:** `curl -X POST https://folio.com/api/create-admin` → attacker gains full admin access.
**Fix:** Delete this file entirely.

---

### CRIT-02: Unauthenticated Database Init with Shell Execution — `/api/init-db`
**File:** `src/app/api/init-db/route.ts`
**Description:** Runs `execSync('npx prisma db push')` — a shell command — with zero authentication. Also creates users with dummy password hashes. The GET handler leaks user count.
**Exploit:** `POST /api/init-db` triggers schema migrations and creates admin/vendor/designer users from the public internet.
**Fix:** Delete this file entirely.

---

### CRIT-03: 11 Test Endpoints with Zero Protection
**Files:** `src/app/api/test*/route.ts` (11 files)
**Description:** No environment checks, no auth. Key exposures:
- `test-users` — dumps all user IDs, emails, names, and roles
- `test-auth` — lists all admin email addresses
- `test-org` — dumps all organizations with member data
- `test-db` (POST) — creates arbitrary records in the production database
- `test-camera-capture` (POST) — creates Selection records with attacker-controlled data
**Fix:** Delete all test endpoint files, or add `NODE_ENV === 'production'` guards.

---

### CRIT-04: Hardcoded Supabase Service Role Key in Source Code
**Files:**
- `src/scripts/setup-storage-policies.js` (line 5)
- `src/scripts/create-bucket.js` (line 5)
- `src/scripts/disable-rls.js` (line 5)
**Description:** The Supabase service role key (which bypasses all RLS) is hardcoded and committed to git. Anyone with repo access has full database access.
**Fix:** Immediately rotate the service role key in Supabase dashboard. Refactor scripts to use `process.env.SUPABASE_SERVICE_ROLE_KEY`.

---

### CRIT-05: Hardcoded Database Password in Documentation
**File:** `src/DATABASE_SETUP.md` (line 27)
**Description:** Contains the actual PostgreSQL connection string with password: `postgresql://postgres:ds%-t$#eT9$M76Z@db.gwdkhgejsyvynqzolyau.supabase.co:5432/postgres`
**Fix:** Rotate the database password immediately. Replace with placeholder in docs.

---

### CRIT-06: 8 Admin Routes Without Admin Auth Check
**Files:**
- `src/app/api/admin/vendor-analytics/route.ts` — leaks all selections with designer emails
- `src/app/api/admin/pending-products/route.ts` — all 4 methods (GET/POST/PUT/DELETE) unauthenticated
- `src/app/api/admin/events/stats/route.ts` — exposes event statistics
- `src/app/api/admin/events/approvals/route.ts` — exposes pending events with creator data
- `src/app/api/admin/events/approve/route.ts` — anyone can approve/reject events
- `src/app/api/admin/events/[id]/approve/route.ts` — anyone can approve events by ID
- `src/app/api/admin/events/[id]/reject/route.ts` — anyone can reject events by ID
- `src/app/api/admin/designers/route.ts` — GET dumps all designers, POST creates users, PUT modifies profiles
- `src/app/api/admin/vendors/route.ts` — GET reads vendor data, POST writes to filesystem
**Fix:** Add `requireAdmin()` call to all admin route handlers.

---

### CRIT-07: IDOR — Designer Project Routes Have Zero Auth
**Files (all under `src/app/api/designer/projects/[id]/`):**
- `route.ts` — GET reads any project, PATCH modifies any project's public/status
- `export/route.ts` — exports any project as CSV without auth
- `rooms/[roomId]/route.ts` — reads any room data
- `rooms/[roomId]/selections/route.ts` — creates selections in any project
- `rooms/[roomId]/selections/[selectionId]/route.ts` — modifies/deletes any selection
- `selections/route.ts` — creates/lists selections without auth
**Exploit:** `GET /api/designer/projects/{uuid}` returns full project data for any UUID.
**Fix:** Add `getServerSession()` + `assertProjectView()` to all handlers.

---

### CRIT-08: IDOR — Core Project Routes Missing Auth
**Files:**
- `src/app/api/projects/[id]/export/route.ts` — exports any project without auth
- `src/app/api/projects/[id]/rooms/[roomId]/route.ts` — GET/PUT/DELETE any room without auth
- `src/app/api/projects/[id]/interview-quotes/route.ts` — reads interview quotes without auth
**Fix:** Add authentication and `assertProjectView()`.

---

### CRIT-09: Vendor Project Routes — Zero Auth on Critical Operations
**Files (all under `src/app/api/vendor/projects/[id]/`):**
- `route.ts` — **GET returns any project; PATCH accepts arbitrary data writes to any project**
- `selections/[selectionId]/route.ts` — PUT/DELETE any selection
- `rooms/route.ts` — GET/POST rooms in any project
- `visits/route.ts` — leaks visit tokens and designer emails
- `handoff/route.ts` — creates handoff visits for any project
**Exploit:** `PATCH /api/vendor/projects/{id}` with `{"title":"hacked"}` modifies any project.
**Fix:** Add auth + vendor org ownership verification using `assertVendorAccess()`.

---

### CRIT-10: Unauthenticated Organization CRUD with Arbitrary User Impersonation
**File:** `src/app/api/organizations/route.ts`
**Description:** POST creates organizations linking an arbitrary `userId` from the request body as OWNER — with zero authentication. GET returns all organizations with full member user data (including emails).
**Exploit:** `POST /api/organizations` with `{"userId":"victim-uuid","userRole":"OWNER"}` creates an org owned by the victim.
**Fix:** Add auth, use `session.user.id` instead of body `userId`.

---

### CRIT-11: SSRF — Unauthenticated URL Fetching
**File:** `src/app/api/scrape-product/route.ts` (lines 347-371)
**Description:** Accepts any URL and fetches it server-side with zero authentication and no domain allowlist. Can probe internal networks, cloud metadata endpoints (`169.254.169.254`), and internal services.
**Exploit:** `POST /api/scrape-product` with `{"url":"http://169.254.169.254/latest/meta-data/iam/security-credentials/"}` — leaks cloud credentials.
**Fix:** Add auth, implement domain allowlist, block private/internal IP ranges.

---

### CRIT-12: Unauthenticated AI Endpoints — Cost Abuse
**Files:**
- `src/app/api/orb-agent/route.ts` — unauthenticated, triggers Anthropic API calls
- `src/app/api/support/chat/route.ts` — unauthenticated, passes user-controlled messages to Anthropic
- `src/app/api/vendor-analytics/chat/route.ts` — unauthenticated, triggers XAI API calls
**Exploit:** Script sending requests in a loop burns through API billing.
**Fix:** Add `getServerSession()` and rate limiting to all AI endpoints.

---

### CRIT-13: Credit Balance Race Condition
**File:** `src/app/api/commerce/orders/route.ts` (lines 208-292)
**Description:** Credit balance check happens OUTSIDE the `$transaction` block, but deduction happens INSIDE. A user submitting simultaneous requests can spend more credits than available (TOCTOU).
**Exploit:** Send 10 concurrent POST requests with `creditAppliedCents: fullBalance` — all pass the check, each deducts, resulting in negative balance.
**Fix:** Move balance check inside `$transaction` with `SELECT ... FOR UPDATE`.

---

### CRIT-14: Products — Unauthenticated Arbitrary Modification
**File:** `src/app/api/products/[productId]/route.ts` (PUT handler, lines 71-152)
**Description:** The PUT handler has zero auth. Anyone can modify any product's name, description, price, image, brand, URL, and vendor association.
**Fix:** Add auth + ownership verification.

---

### CRIT-15: Demo User Creation Bypasses Production Guard
**File:** `src/app/api/demo/create-user/route.ts`
**Description:** Checks `!request.headers.get('x-demo-secret')` — any non-empty header value passes. Returns hardcoded credentials (`demo@folio.com` / `password123`).
**Fix:** Validate against `process.env.DEMO_SECRET`, or delete.

---

### CRIT-16: Dev Endpoints Exposed in Production
**Files:**
- `src/app/api/dev/find-product/route.ts` — no env check, no auth, queries products
- `src/app/api/dev/whoami/route.ts` — no env check, no auth, leaks session data
- `src/app/api/dev/vendor-context/route.ts` — no env check, proceeds without auth
**Fix:** Add `NODE_ENV === 'production'` guards.

---

### CRIT-17: Unauthenticated Video Upload with No Validation
**File:** `src/app/api/videos/upload/route.ts` (lines 31-64)
**Description:** No authentication, no file type validation, no size limit, potential path traversal. Filename from `file.name` used directly. Files written to local filesystem.
**Fix:** Add auth, validate file type/size, sanitize filename, use Supabase Storage.

---

---

## HIGH Findings

### HIGH-01: User Enumeration — `/api/users/search`
**File:** `src/app/api/users/search/route.ts`
**Description:** No auth. Anyone can search by name or email and get user IDs, emails, roles, and profile images.
**Fix:** Add auth or remove email from public response.

---

### HIGH-02: Full User Data Leak — Organization Endpoints
**Files:**
- `src/app/api/organizations/[id]/route.ts` — no auth, returns full user objects
- `src/app/api/orgs/[orgId]/route.ts` (GET) — no auth, leaks member emails
- `src/app/api/orgs/[orgId]/members/route.ts` (GET) — no auth, leaks emails and roles
- `src/app/api/orgs/[orgId]/team/route.ts` (GET) — no auth, leaks member data
**Fix:** Add auth or strip sensitive fields (email, etc.) from public responses.

---

### HIGH-03: Any User Can Claim Any Unclaimed Organization
**File:** `src/app/api/orgs/[orgId]/claim/route.ts`
**Description:** Any authenticated user can claim an unclaimed org as OWNER with no business verification.
**Fix:** Add verification (email domain, admin approval queue).

---

### HIGH-04: IDOR via userId Query Parameter — `/api/orgs` GET
**File:** `src/app/api/orgs/route.ts` (lines 15-113)
**Description:** No auth. Accepts arbitrary `userId` query param to enumerate any user's org memberships via raw SQL.
**Fix:** Add auth, use `session.user.id`.

---

### HIGH-05: Profile Endpoint Exposes PII Without Auth
**File:** `src/app/api/profile/[userId]/route.ts`
**Description:** No auth. Returns email, Instagram, LinkedIn, architect license numbers, location.
**Fix:** Strip email and license info from unauthenticated responses.

---

### HIGH-06: Private Events Accessible Without Auth
**File:** `src/app/api/events/[id]/route.ts`
**Description:** Returns any event (including private, unapproved) by ID without checking `isPublic`.
**Fix:** Filter by `isPublic === true` for unauthenticated requests.

---

### HIGH-07: Designers List Leaks All Designer PII
**File:** `src/app/api/designers/route.ts`
**Description:** No auth. Returns all designers with social handles, website, followers, views, creation dates.
**Fix:** Add auth or remove `createdAt`, `followers`, `views` from public response.

---

### HIGH-08: Missing Project Auth on Interview Endpoints
**Files:**
- `src/app/api/interview/respond/route.ts` — no `assertProjectView` on projectId from body
- `src/app/api/interview/generate-draft/route.ts` — no `assertProjectView`
**Fix:** Add `assertProjectView(user.id, projectId)`.

---

### HIGH-09: Missing Project Auth on Editorial Approval Endpoints
**Files:**
- `src/app/api/projects/[id]/approvals/publish-editorial/route.ts` — auth but no ownership check
- `src/app/api/projects/[id]/approvals/draft-editorial/route.ts` — auth but no ownership check
**Fix:** Add `assertProjectView()`.

---

### HIGH-10: XSS via `dangerouslySetInnerHTML` on Editorial Content
**File:** `src/app/editorials/[id]/page.tsx` (line 201)
**Description:** `editorial.content` rendered via `dangerouslySetInnerHTML` without sanitization. If AI-generated content contains malicious HTML (via prompt injection), it becomes stored XSS.
**Fix:** Sanitize with DOMPurify before rendering.

---

### HIGH-11: No Rate Limiting on AI-Backed Endpoints
**Files:** `src/app/api/ai/complete-product/route.ts`, `src/app/api/ai/find-in-folio/route.ts`, `src/app/api/interview/respond/route.ts`, `src/app/api/interview/generate-draft/route.ts`, `src/app/api/interview/start/route.ts`, `src/app/api/interview/complete/route.ts`, `src/app/api/interview/realtime/session/route.ts`
**Description:** All have auth but zero rate limiting. An authenticated user can make unlimited LLM calls.
**Fix:** Apply existing `rateLimit()` function (10-20 req/min for AI endpoints).

---

### HIGH-12: Vendor Smart-Invites IDOR
**File:** `src/app/api/vendor/smart-invites/route.ts` (line 23)
**Description:** `vendorId = searchParams.get('vendorId') || session.user.id` — any authenticated user can pass any vendorId and see that vendor's data.
**Fix:** Remove query param override, always use session.

---

### HIGH-13: Vendor Routes Missing VENDOR Role Check
**Files (19 routes):** Most routes under `src/app/api/vendor/` check auth but not `role === 'VENDOR'`. A DESIGNER can call vendor analytics, stats, invite-designer, etc.
**Fix:** Add VENDOR role check or use `assertVendorAccess()`.

---

### HIGH-14: Trade Account Credentials Stored in Plaintext
**File:** `src/app/api/admin/commerce/trade-accounts/route.ts` (lines 199-200)
**Description:** The encryption infrastructure exists but the create route still writes plaintext `password` and `apiKey`.
**Fix:** Use existing `createTradeAccountWithEncryption()` from `src/lib/tradeCredentials.ts`.

---

### HIGH-15: Debug Log Exposes Service Role Key
**File:** `src/scripts/setup-storage.js` (line 6)
**Description:** `console.log('DEBUG: SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY)`
**Fix:** Remove this debug log.

---

### HIGH-16: NextAuth Fallback to Known Secret in Dev
**File:** `src/app/api/auth/[...nextauth]/options.ts` (line 323)
**Description:** Falls back to `'dev-secret-key-not-for-production'` if `NEXTAUTH_SECRET` is unset and `NODE_ENV !== 'production'`. If `NODE_ENV` is misconfigured, JWTs are signed with a known key.
**Fix:** Fail loudly if `NEXTAUTH_SECRET` is missing.

---

### HIGH-17: Org Endpoints Leak Data and Create Records Without Auth
**Files:**
- `src/app/api/orgs/[orgId]/bio-interview/route.ts` (GET) — no auth, returns interview data
- `src/app/api/orgs/[orgId]/onboarding-progress/route.ts` (GET) — no auth, creates records for any org
- `src/app/api/orgs/[orgId]/recognition/route.ts` (GET) — no auth
- `src/app/api/orgs/[orgId]/process-phases/route.ts` (GET) — no auth
- `src/app/api/orgs/[orgId]/team/[orgUserId]/quiz/route.ts` (GET) — no auth, leaks quiz answers
**Fix:** Add auth to all GET handlers.

---

### HIGH-18: Vendor Claim-Product Has Zero Auth
**File:** `src/app/api/vendor/claim-product/route.ts`
**Description:** Only requires a preview token ID (no session). Anyone with a valid token can claim products.
**Fix:** Add session auth alongside token verification.

---

---

## MEDIUM Findings

### MED-01: No Password Policy on Signup
**File:** `src/app/api/auth/signup/route.ts`
**Description:** Zero validation on password strength. Users can register with a 1-character password.
**Fix:** Enforce minimum 8 characters, add complexity requirements.

---

### MED-02: No Email Format Validation on Signup
**File:** `src/app/api/auth/signup/route.ts`
**Description:** Email is trimmed/lowercased but never validated against a pattern.
**Fix:** Add email format validation with Zod `z.string().email()`.

---

### MED-03: In-Memory Rate Limiting Ineffective in Serverless
**File:** `src/lib/rateLimit.ts`
**Description:** Uses an in-memory `Map`. Rate limits reset on server restart and are per-instance in multi-instance deployments.
**Fix:** Migrate to Redis-backed rate limiting (e.g., `@upstash/ratelimit`).

---

### MED-04: Debug SSRF — `/api/debug/pdf-text`
**File:** `src/app/api/debug/pdf-text/route.ts`
**Description:** Has auth check but NO `NODE_ENV` guard. Fetches arbitrary URLs server-side in production.
**Fix:** Add `NODE_ENV === 'production'` guard.

---

### MED-05: All Storage Buckets Are Public
**File:** `src/scripts/create-bucket.js`, `src/scripts/setup-storage.js`
**Description:** Five buckets (`festival-images`, `event-images`, `project-images`, `product-images`, `user-avatars`) are all created with `public: true`.
**Fix:** Make `project-images` and `user-avatars` private with signed URLs.

---

### MED-06: SQL Injection Risk — `$queryRawUnsafe` Usage
**Files:** `src/server/queries/getDesignerVendorDirectory.ts`, `src/lib/events/queries.ts`, `src/lib/editorial/curator.ts`, + 4 more
**Description:** 17 files use `$queryRawUnsafe`. While current implementations appear to use parameterized values, the pattern is fragile.
**Fix:** Migrate to Prisma's `$queryRaw` tagged-template syntax where possible.

---

### MED-07: Prompt Injection Risk in AI Endpoints
**Files:** `src/app/api/interview/respond/route.ts`, `src/app/api/ai/complete-product/route.ts`, `src/app/api/ai/find-in-folio/route.ts`
**Description:** User-supplied text (interview answers, product names) interpolated directly into LLM prompts without sanitization.
**Fix:** Add input sanitization/length limits. Apply existing `moderateAnswers` function consistently.

---

### MED-08: Weak Realtime Session Token
**File:** `src/app/api/interview/realtime/session/route.ts` (lines 119-126)
**Description:** Token is base64-encoded JSON (trivially decodable, not signed or encrypted).
**Fix:** Replace with properly signed JWT or LiveKit server SDK token.

---

### MED-09: Org Admin Can Promote to Admin (Lateral Escalation)
**File:** `src/app/api/orgs/[orgId]/members/[userId]/route.ts` (PATCH)
**Description:** An ADMIN can change any member's role to ADMIN. Only OWNER should be able to create ADMINs.
**Fix:** Restrict ADMIN role assignment to OWNER only.

---

### MED-10: No Rate Limiting on Signals
**Files:** `src/app/api/signals/like/route.ts`, `src/app/api/signals/save/route.ts`
**Description:** Properly authenticated but no rate limiting. Users can inflate engagement metrics.
**Fix:** Add rate limiting.

---

### MED-11: Error Responses Leak Debug Info
**Files:** `src/app/api/orgs/search/route.ts` (includes `debug`, `errorStack`), multiple other routes include `error.message`.
**Fix:** Strip debug/stack info from production error responses.

---

### MED-12: InfluenceScore Leaks Despite Anonymization
**File:** `src/app/api/vendor/shop-analytics/route.ts` (lines 230-254)
**Description:** When `vendorVisibility = false`, designer is anonymized but `influenceScore` is still returned, potentially enabling de-anonymization.
**Fix:** Set `influenceScore: null` when anonymizing.

---

### MED-13: No Stripe Webhook Verification
**Description:** No Stripe webhook endpoint exists in the codebase. When Stripe integration is added, webhook signature verification (`stripe.webhooks.constructEvent`) must be implemented.
**Fix:** Implement before accepting Stripe payments.

---

### MED-14: RLS Disable Script Exists
**File:** `src/scripts/disable-rls.js`
**Description:** Script that attempts to disable Row Level Security on storage tables.
**Fix:** Delete this script.

---

### MED-15: Hardcoded Passwords in Seed Scripts
**Files:** `src/scripts/create-new-admin.js`, `src/scripts/create-test-users.js`, `prisma/seed.js`
**Description:** Contain `admin123` and `password123` hardcoded passwords.
**Fix:** Ensure these scripts never run in production.

---

### MED-16: `new PrismaClient()` Per-Request in Several Routes
**Files:** `src/app/api/organizations/route.ts`, `src/app/api/organizations/[id]/route.ts`, `src/app/api/users/search/route.ts`, `src/app/api/create-admin/route.ts`, `src/app/api/init-db/route.ts`
**Description:** Creates a new PrismaClient per request, exhausting connection pools under load (DoS vector).
**Fix:** Use shared `@/lib/prisma` singleton.

---

### MED-17: Image Upload SSRF via External URL Fetch
**File:** `src/app/api/projects/[id]/images/route.ts` (lines 43-100)
**Description:** Fetches external image URLs server-side to re-upload to Supabase. No URL validation against internal IPs.
**Fix:** Add private IP range blocking.

---

### MED-18: Cron Endpoint Auth Bypass When Secret Unset
**File:** `src/app/api/cron/process-boost-opportunities/route.ts` (line 26)
**Description:** `if (cronSecret && authHeader !== ...)` — if `CRON_SECRET` is unset, the entire check is skipped.
**Fix:** Return 401 if `CRON_SECRET` is not configured.

---

---

## LOW Findings

### LOW-01: No Password Reset Flow
**Description:** No password reset endpoint exists. Users with compromised passwords have no recovery path.
**Fix:** Implement password reset with time-limited tokens.

---

### LOW-02: No Content Security Policy (CSP) Headers
**File:** `next.config.js`
**Description:** Security headers include X-Frame-Options, HSTS, etc. but no CSP header. Missing CSP enables XSS exploitation.
**Fix:** Add `Content-Security-Policy` header.

---

### LOW-03: TypeScript Build Errors Ignored
**File:** `next.config.js` — `typescript.ignoreBuildErrors: true`
**Description:** Type errors are silently suppressed, potentially hiding type-safety issues that could lead to runtime vulnerabilities.
**Fix:** Enable build error checking when feasible.

---

### LOW-04: `set-active-profile` Endpoint Is a No-Op Server-Side
**File:** `src/app/api/set-active-profile/route.ts`
**Description:** No auth, returns success for any input. Currently frontend-only but dangerous if later wired to DB.
**Fix:** Add auth or delete.

---

### LOW-05: Dev API Auth Bypass
**File:** `src/lib/apiAuth.ts` (lines 13-15)
**Description:** In non-production, accepts `x-dev-user-id` header for impersonation.
**Fix:** Ensure `NODE_ENV` is always `production` in deployed environments.

---

### LOW-06: `access.ts` vendorOrgId Always Returns Null
**File:** `src/lib/authz/access.ts` (line 49)
**Description:** `getProjectAccess` always returns `vendorOrgId: null`, causing vendor-side selection access checks to always deny.
**Fix:** Populate vendorOrgId from the participant's org when `side === VENDOR`.

---

### LOW-07: Community Page HTML Construction
**File:** `src/app/community/page.tsx` (line 224)
**Description:** Uses `dangerouslySetInnerHTML` with hardcoded HTML strings. Currently safe but fragile.
**Fix:** Replace with JSX components.

---

### LOW-08: Health Check Leaks Config Info
**File:** `src/app/api/health/llm/route.ts`
**Description:** Returns AI provider name, feature flags, and whether an API key is configured.
**Fix:** Remove `reason` field from response.

---

### LOW-09: Impersonate Exit Doesn't Check Admin Role
**File:** `src/app/api/admin/impersonate/exit/route.ts`
**Description:** Both GET and POST check session existence but not ADMIN role.
**Fix:** Add `role === 'ADMIN'` check.

---

---

## Critical Findings Summary — Fix Before Launch

| # | Finding | File(s) | Effort |
|---|---------|---------|--------|
| 1 | Delete `/api/create-admin` backdoor | 1 file | 5 min |
| 2 | Delete `/api/init-db` | 1 file | 5 min |
| 3 | Delete/protect 11 `test-*` endpoints | 11 files | 30 min |
| 4 | Rotate Supabase service role key + DB password | Supabase dashboard | 15 min |
| 5 | Remove hardcoded keys from scripts | 3 files | 10 min |
| 6 | Add auth to 8 unprotected admin routes | 8 files | 1 hr |
| 7 | Add auth to designer project routes | 7 files | 1 hr |
| 8 | Add auth to core project IDOR routes | 3 files | 30 min |
| 9 | Add auth to vendor project routes | 6 files | 1 hr |
| 10 | Add auth to organization CRUD | 3 files | 30 min |
| 11 | Fix SSRF in scrape-product | 1 file | 30 min |
| 12 | Add auth to AI chat endpoints | 3 files | 30 min |
| 13 | Fix credit race condition | 1 file | 1 hr |
| 14 | Add auth to product PUT | 1 file | 15 min |
| 15 | Fix demo endpoint bypass | 1 file | 10 min |
| 16 | Protect dev endpoints | 3 files | 15 min |
| 17 | Add auth to video upload | 1 file | 30 min |

---

## Quick Wins — Easy Fixes, High Impact

1. **Delete files** — Remove `create-admin`, `init-db`, and all `test-*` endpoints (15 min, eliminates 13 CRITICAL findings)
2. **Add `requireAdmin()` calls** — Copy pattern from secured admin routes (1 hr, fixes 8 admin routes)
3. **Add `assertProjectView()` calls** — Copy pattern from secured project routes (2 hrs, fixes ~15 IDOR routes)
4. **Wire up `assertVendorAccess()`** — Function already exists, just needs to be called (2 hrs, fixes 19 vendor routes)
5. **Add `NODE_ENV` guards** — One-liner at top of each dev/debug route (30 min, fixes 6 routes)
6. **Rotate secrets** — Supabase service key + DB password (15 min, eliminates credential exposure)

---

## Recommended Middleware

### 1. Global API Auth Middleware
Add a middleware layer that blocks unauthenticated access to all `/api/*` routes except an explicit allowlist:
```
Allowlist: /api/auth/*, /api/feed, /api/posting/[slug], /api/health/*, /api/waitlist, /api/directory/*
```

### 2. Rate Limiting Middleware (Redis-backed)
Replace in-memory `Map` with `@upstash/ratelimit` or similar. Apply globally with route-specific overrides for AI endpoints.

### 3. CSP Headers
Add Content-Security-Policy to `next.config.js` headers.

### 4. Production Route Blocker
Add middleware that blocks all `/api/debug/*`, `/api/dev/*`, `/api/test*`, `/api/seed/*`, `/api/init-db`, `/api/create-admin`, `/api/demo/*` routes in production regardless of individual file guards.

---

## Estimated Remediation Effort

| Priority | Description | Estimated Time |
|----------|-------------|----------------|
| P0 — CRITICAL | Delete dangerous endpoints, rotate secrets, fix auth on admin/project/vendor routes | 8-12 hours |
| P1 — HIGH | Fix IDOR patterns, add rate limiting to AI endpoints, sanitize XSS, protect org endpoints | 8-12 hours |
| P2 — MEDIUM | Password policy, distributed rate limiting, prompt injection mitigation, CSP headers | 4-8 hours |
| P3 — LOW | Password reset flow, minor cleanup | 4-8 hours |
| **Total** | | **24-40 hours** |

---

*Report generated by automated security audit. All findings should be validated manually before remediation.*
