# Folio Pre-Launch Audit

**Date:** 2026-06-09
**Scope:** Full codebase — Next.js (App Router) + Prisma + Supabase, deployed on Vercel.
**Goal:** Find anything that would embarrass us, break trust, or leak data in front of paying interior designers at first launch.
**Constraint:** Audit only. Nothing was refactored or fixed.

## How to read this

Severities are calibrated to **launch risk**, not code purity:

- **BLOCKER** — exploitable data leak / unauthenticated mutation / a core journey that dead-ends with real users. Fix before any designer touches it.
- **HIGH** — real exposure or breakage that will bite within the first weeks (cost, trust, data integrity).
- **MEDIUM** — degrades as we scale or under bad input; not an immediate launch-day failure.
- **LOW** — defense-in-depth, polish, or theoretical.

Every finding was confirmed by reading the file. Where a parallel pass over-reported, I say so under **Corrected / not findings** at the end so we don't waste effort on phantoms.

Architecture note that governs the whole report: **`middleware.ts` exempts every `/api/*` path** (line 124 matcher + line 16 `EXEMPT_ROUTES`). The middleware only gates page navigation and onboarding redirects. **Every API route must therefore enforce its own auth server-side.** Prisma connects directly to Postgres and **bypasses Supabase RLS entirely** — so the session/role checks in route handlers are the *only* access-control layer for Prisma-backed data. No RLS policies exist in the migrations (`CREATE POLICY` count: 0). That is an acceptable architecture *if and only if* every route checks. Most do. The ones that don't are below.

---

## 1. Security & Access Control

### ✅ RESOLVED (commit 158b523) — BLOCKER — Unauthenticated user/account creation
**`src/app/api/profiles/route.ts:129`** (POST handler)
Anyone can `POST /api/profiles` with `{ role: "designer" | "vendor" | "individual", ... }` and the handler calls `prisma.user.create()` with **no session check**. An attacker can mint unlimited real `User` rows of any role, including spoofed designer/vendor profiles. The body is also stuffed with demo-era junk (random follower counts, `randomuser.me` avatars, `source.unsplash.com` logos) so the created accounts are visibly fake but real rows.
**Fix:** Require an authenticated admin session, or delete this route — it looks like leftover demo-seeding code. The real signup path is `src/app/api/auth/signup/route.ts`, which is separate.
**Resolution:** Removed the POST handler entirely — no caller existed in the codebase. The read-only `GET` directory listing in the same file was kept intact.

### ✅ RESOLVED (commit f5cad40) — BLOCKER — Inbound email webhook has no signature verification
**`src/app/api/email/inbound/route.ts:22`** (POST handler; the file's own header TODO at lines 1–6 admits this)
The Resend inbound webhook processes `request.json()` and calls `matchInboundToThread()` with **no Svix signature check**. Anyone who finds the URL can POST fake inbound emails: inject forged vendor replies into conversation threads, flip `EmailThread` status to `REPLIED`, and corrupt rep response-time metrics. Designers would see fabricated vendor messages as genuine.
**Fix:** Verify `svix-id` / `svix-timestamp` / `svix-signature` headers with the `svix` package against `RESEND_WEBHOOK_SECRET` before processing. Reject if absent/invalid.
**Resolution:** The Svix signature is now verified against `RESEND_WEBHOOK_SECRET` over the **raw** request body before any parsing or DB work; missing secret, missing headers, or failed verification all return 401. `svix` was promoted from a transitive dependency to a direct one. Searched for other inbound webhook handlers (Resend/Stripe/other) — none exist; this was the only one. The Stripe references in the codebase are outbound Connect onboarding (session-authenticated), not webhooks.

### HIGH — Unauthenticated product claim / vendor record mutation
**`src/app/api/vendor/claim-product/route.ts:6`** (POST handler)
No session check. With a `previewTokenId` (handed out in vendor-preview links and thus shareable/guessable), an unauthenticated caller can claim a product, create or overwrite a `Vendor` record's name/website/email, attach it to the product, and mark the token used to cover tracks. There is no verification that the claimer controls the vendor email.
**Fix:** Require an authenticated vendor session and verify the claimed email matches the session user (or an email-verification round-trip) before mutating `Vendor`/product state.

### ✅ RESOLVED — HIGH — Cron endpoints fail *open* when the secret is unset
**`src/app/api/cron/dormancy-check/route.ts:24`** and **`src/app/api/cron/process-boost-opportunities/route.ts`** (~line 24)
The guard is `if (cronSecret && authHeader !== \`Bearer ${cronSecret}\`) return 401`. If `CRON_SECRET` is empty/undefined in the environment, the condition short-circuits to `false` and the route runs **unauthenticated** — anyone can trigger dormancy notifications (spam designers) or boost-opportunity processing.
**Fix:** Invert to fail-closed: `if (!cronSecret || authHeader !== \`Bearer ${cronSecret}\`) return 401`. Treat a missing secret as "deny," and add a deploy-time assertion that `CRON_SECRET` is set in production.
**Resolution:** Inverted both guards to fail closed. Also fixed a third route with the same class of bug, **`src/app/api/cron/process-boost-revenue/route.ts:23`** (`if (cronSecret && NODE_ENV === 'production')` skipped auth when the secret was unset in production) — now requires a valid secret in production while preserving its intentional dev-skip. **`src/app/api/admin/commerce/release-credits/route.ts:23`** uses the same env secret but was already fail-closed (default-deny `isAuthorized` flag + admin-session fallback), so it was left unchanged.

### ✅ RESOLVED (commit 207fbd5) — HIGH — Unauthenticated server-side URL fetcher (SSRF + AI-budget burn)
**`src/app/api/scrape-product/route.ts:1`** (no session import anywhere in the file; `@idor-allow: public-read` annotation present but it performs outbound fetches + AI extraction)
No auth. The route fetches an arbitrary user-supplied URL server-side (optionally via Browserless) and runs `aiExtractProduct()`. Two problems: (1) **SSRF** — an attacker can point it at internal/metadata addresses or use the server as a fetch proxy; (2) **cost** — anyone can loop this to burn Browserless + model spend. `maxDuration = 60`, so each call can hold a function for a minute.
**Fix:** Require a session. Add an allow/deny list that blocks private IP ranges, `localhost`, and link-local/metadata addresses before fetching. Rate-limit per user.
**Resolution:** Added a `getServerSession` check (401 if unauthenticated) before any work, a per-user rate limit (60 scrapes/hour, via the existing `rateLimit` helper in `src/lib/rateLimit.ts`), and an SSRF guard. The guard is a new helper **`src/lib/security/ssrf.ts`** (`assertPublicUrl`) that allows only http/https and **resolves the hostname, then rejects if any resolved IP is loopback/private/link-local/CGNAT/multicast/reserved or a cloud-metadata address (169.254.169.254, AWS IMDSv6 `fd00:ec2::254`, IPv4-mapped IPv6, etc.)** — i.e. it validates the resolved IP, not just the URL string. Validated with 22 unit cases. The `@idor-allow: public-read` annotation was removed since the route is now authenticated (the idor-scan heuristic recognizes `getServerSession`).

**Rate limiting (per task step 3):** none existed for this route before this change. A reusable limiter (`rateLimit` / `checkRateLimit` in `src/lib/rateLimit.ts`) did exist, so it was applied. Note the limiter is in-memory/per-instance (documented best-effort), so under multi-instance Vercel it's a speed bump, not a hard cap — moving it to Upstash/Redis is the standing follow-up tracked under §4 MEDIUM.

**Other server-side URL fetchers (task step 4 — reported, not fixed):** these take a user-supplied URL and `fetch()` it without the SSRF guard. They share the same DNS-rebinding/metadata exposure and should get `assertPublicUrl` next:
- **`src/app/api/og-fetch/route.ts`** — **unauthenticated** (`{ url } = body` → `fetch(url)`), open SSRF/proxy. Highest priority of this set.
- **`src/app/api/instagram/proxy-image/route.ts`** — **unauthenticated** image proxy (`searchParams.get('url')` → `fetch`), open SSRF/proxy.
- **`src/app/api/profile/fetch-bio-url/route.ts`** — authenticated; fetches user URL (has a timeout, no IP guard).
- **`src/app/api/import/website/route.ts`** — authenticated; direct `fetch(url)` fallback + Browserless.
- **`src/app/api/import/product/route.ts`** — authenticated; fetches via Browserless.
(The `projects/*/images*` and `import/presentation` routes also `fetch()` but resolve Supabase-storage paths / trusted URLs, so they're lower concern.)

### MEDIUM — Public org inquiry form: no rate limit, unsanitized stored content
**`src/app/api/orgs/[orgId]/inquiry/route.ts:10`** (POST handler)
Accepts an inquiry from anyone and creates notifications for org admins with no rate limiting; the `message` field is stored verbatim. An attacker can flood an org's admins with notifications, and stored content is a stored-XSS risk if any admin surface renders it as HTML.
**Fix:** Rate-limit per IP and per `orgId`; treat `message` as plain text on render (escape it); consider a CAPTCHA on the public form.

### MEDIUM — `3D asset generation` has no entitlement/cost gate
**`src/app/api/projects/[id]/generate-3d-assets/route.ts:16`** (TODO: "Restrict 3D to premium tier")
Any authenticated user who owns a project can trigger 3D-asset generation, an expensive operation the code itself flags as intended to be premium-only. Pre-launch this is a direct cost liability.
**Fix:** Gate behind the subscription tier (the session already carries `subscriptionTier`) or disable the entry point until billing exists.

### LOW — Impersonation cookie is unsigned PII (but does *not* grant access — see corrections)
**`src/app/api/admin/impersonate/[id]/route.ts:59`**
The `folio-impersonation` cookie is plain JSON (admin email, target email/name) — `httpOnly`+`secure` but unsigned. It cannot be used to read another user's data (server routes authorize on the signed JWT `session.user.id`, never on this cookie — see corrections), and the `exit` route re-checks `session.user.id === originalAdminId`. The residual risk is that it stores PII in a tamperable cookie and the feature is half-wired (below in §3).
**Fix:** Sign it (HMAC with `NEXTAUTH_SECRET`) or move the state into the JWT. Low priority — admin-only, no data-layer impact today.

### LOW — Dev/maintenance routes rely on `NODE_ENV` only
**`src/app/api/maintenance/elevate-role/route.ts`**, `src/app/api/init-db/route.ts`, `src/app/api/seed/events/route.ts`
`elevate-role` is gated by both `NODE_ENV !== 'production'` **and** a `MAINTENANCE_TOKEN` header — that one is fine. The seed/init routes lean on `NODE_ENV` alone, which is correct on Vercel but brittle if an env is mislabeled.
**Fix:** Keep the token requirement on all of them; don't trust `NODE_ENV` as the sole gate for anything that mutates.

**Auth patterns (for consistent fixes):** the canonical helpers are `getServerSession(authOptions)` (raw session), `requireAdmin()` in `src/lib/requireAdmin.ts` (throws 401/403), and the project matrix `assertProjectWrite()` / `assertProjectPublish()` / `assertProjectDelete()` in `src/lib/authz/access.ts` (org-role aware). Admin routes, the org-membership routes, and `/api/auth/me` were verified to enforce server-side and to whitelist writable fields (no role/`accountStatus`/`passwordHash` self-escalation). New fixes should reuse these helpers rather than re-implementing checks.

---

## 2. Data Integrity

### HIGH — Immediate hard-delete of projects with full cascade, no grace period
**`src/app/api/projects/[id]/route.ts:92`** (`DELETE` handler)
After an authorized `assertProjectDelete`, this does a straight `prisma.project.delete()`. Every FK is `onDelete: Cascade`/`SetNull`, so deleting a project **tears down rooms, selections, images, stories, editorial drafts, and the `ProjectPost`** in one shot — including published posts. There is an `archivedAt` field and a separate guarded `force-delete` route that *requires* archiving first, which implies an intended archive → grace-period → force-delete flow, but this plain `DELETE` bypasses all of it. A designer (or an org admin) can irreversibly destroy a published, possibly-featured project with one click.
**Fix:** Route normal deletes through soft-delete (`archivedAt`) with a grace period; reserve hard delete for the `force-delete` path. Consider `onDelete: SetNull` for editorial relations so a delete doesn't silently break published article references.

### HIGH — Signup is find-then-create; concurrent signups 500 instead of a clean error
**`src/app/api/auth/signup/route.ts:87`**
`findFirst({ email })` then `user.create()`. Two concurrent registrations for the same email both pass the check and the second hits the `@unique` constraint (P2002), surfacing as a 500. At public-launch traffic this is the most likely race to actually fire.
**Fix:** Wrap the `create` in a try/catch on `error.code === 'P2002'` and return a 409 "email already registered" (the unique constraint already guarantees correctness; just handle the error gracefully).

### MEDIUM — Org member-add and join-request-delete are not atomic
**`src/app/api/orgs/[orgId]/members/route.ts:176`**
`organizationUser.create()` then `orgJoinRequest.deleteMany()` run as two separate writes. If the second fails, the user is a member but their join request stays `PENDING`, and a retry can collide on the membership unique constraint.
**Fix:** Wrap both in `prisma.$transaction([...])`.

### MEDIUM — Project update PUT has no schema validation
**`src/app/api/projects/route.ts:253`** (PUT)
Fields are filtered to an `allowedFields` whitelist (good — no mass assignment), but the *values* are unvalidated. A non-string `title`, an array `city`, or an out-of-range `budgetBand` enum becomes a Prisma 500 instead of a 422. Annoying for the client, and it masks the real cause.
**Fix:** Add a `zod` schema (`.strict()`) and `safeParse`; return 422 on failure. Same pattern applies to the org member PATCH (`members/[userId]/route.ts:24`), where `role.toUpperCase()` will throw if `role` isn't a string.

### MEDIUM — Owner can delete their account and orphan an org
**`src/app/api/user/delete/route.ts:127`**
The GDPR-style deletion (correctly wrapped in `$transaction`) `deleteMany`s the user's `OrganizationUser` rows but never checks whether they're the **last OWNER** of an org. The org is left ownerless.
**Fix:** Before deleting, count `OrganizationUser where userId, role: OWNER`; block (or force ownership transfer) if > 0.

### LOW — Publish slug generation returns a bare 409 on collision, no retry
**`src/app/api/posting/project/[projectId]/status/route.ts:~411` and `~461`**
The find-then-update slug loop is *correctness-safe* (the `@unique` on `ProjectPost.slug` catches the race and the handler maps P2002 → 409), but the user just sees "conflict" with no auto-retry. Low risk at launch volume.
**Fix:** On P2002 for slug, retry once with a timestamp suffix before surfacing an error.

---

## 3. Broken or Half-Finished Flows

### BLOCKER — Editorial submissions are stored in process memory + read from the filesystem
**`src/app/api/editorial-submissions/route.ts:7`** (`let editorialQueue = []`, `let projects = []`, then `loadProjects()` reads `src/data/projects.json` off disk)
On Vercel's serverless runtime this is broken two ways: (1) the in-memory queue is **per-instance and wiped on every cold start**, so submissions silently vanish; (2) reading a JSON file from the deployment bundle as a data source won't reflect the real database. A designer submitting work for editorial review gets a success response and the submission disappears.
**Fix:** Persist submissions to a Prisma model. Remove the filesystem/in-memory store entirely. This route is not production-shaped.

### BLOCKER — Approval and rejection send no notification; designer is stranded
**`src/app/api/admin/users/[id]/approve/route.ts:50`** and **`.../reject/route.ts:52`** (both have the email call commented out: `// TODO: Send approval email`)
A designer signs up, lands on `/pending-approval`, and waits. When an admin approves them, **nothing tells them.** They're released only when their JWT happens to refresh on a later visit — invisible and unreliable. Rejection is worse: the `/application-rejected` page exists and fetches a reason, but the user is never told to go look. This is the front door of the designer acquisition funnel.
**Fix:** Implement the approval/rejection emails (the helpers are stubbed and ready), or add an in-app status banner + short polling so the state change is visible without a manual reload.

### HIGH — Project creation throws an uncaught error when the user has no org
**`src/app/actions/projects.ts:216`** (`throw new Error('Organization context required to create projects')`)
`createProjectAction()` requires `operatingAsOrgId`. A designer who isn't in an org yet hits a raw thrown error in a server action — the form crashes instead of saying "create or join a studio first."
**Fix:** Catch this in the calling component and render a guided CTA, or auto-provision a personal org during onboarding so the precondition always holds.

### HIGH — Impersonation feature is half-wired (sets a banner, never switches identity)
**`src/app/api/admin/impersonate/[id]/route.ts`** vs **`src/app/api/auth/[...nextauth]/options.ts:404`**
The POST route sets the `folio-impersonation` cookie, but `token.impersonating` is **only ever read** in the JWT/session callbacks — it is never *assigned* anywhere. So clicking "impersonate" shows the `ImpersonationBanner` but the server still authorizes every query as the admin's own `session.user.id`. The feature doesn't actually let an admin see the app as the user. (This is why the unsigned-cookie risk in §1 is LOW, not HIGH — the cookie has no data-layer authority.)
**Fix:** Decide whether impersonation is in scope for launch. If yes, wire `token.impersonating` (and override the effective user id) in the JWT callback. If no, hide the admin UI so it doesn't look broken.

### MEDIUM — `POSTING_V1` flag is evaluated inconsistently; dev always-on masks prod-off
**`src/app/api/posting/project/[projectId]/status/route.ts:45`**
The gate is `POSTING_V1==='true' || NEXT_PUBLIC_POSTING_V1==='true' || NODE_ENV !== 'production'`. Publishing is therefore **always enabled in dev** regardless of flags, but disabled in prod if neither var is set. A designer's publish that "works" in a preview/dev env can be silently unpublishable in production.
**Fix:** Pick one canonical flag, evaluate it identically everywhere (a single `isPostingEnabled()` helper), and don't let `NODE_ENV` implicitly flip it.

### MEDIUM — Several invite flows create DB rows but send no invitation
**`src/app/api/orgs/[orgId]/team/invite/route.ts:107`**, `vendor/invite-admin/route.ts:102`, `vendor/invite-designer/route.ts:57`, `designer/sourcebook/invite-rep/route.ts:82` (all `// TODO: send email`)
Invites land in the database but the invitee is never notified, so the flow dead-ends unless someone manually shares the link.
**Fix:** Send the invite emails, or remove the invite UI until they're wired.

### MEDIUM — Unhandled promise rejections leave UI stuck "Loading…"
**`src/components/posting/interactive/InlineTagLink.tsx:47`** (`.then()` with no `.catch()`), **`src/components/posting/preview/RichArticle.tsx`** (`Promise.all(productFetches).then(...)` with no `.catch()` — one failed product fetch blanks the whole preview).
On a failed fetch the spinner never resolves and the user gets no error. `InlineTagLink` is on the public published article surface designers share with clients.
**Fix:** Add `.catch()` with an error/empty state; use `Promise.allSettled` in `RichArticle` so one bad product doesn't sink the preview.

---

## 4. AI Integration Reliability

### BLOCKER — No timeouts on model calls; a slow response strands the user mid-flow
Multiple call sites: **`src/app/api/consultations/[consultationId]/chat/route.ts:~194`**, **`src/app/api/ai/complete-product/route.ts:~80`**, **`src/app/api/ai/find-in-folio/route.ts:~168`**, and the Sofia interview generation routes.
`anthropic.messages.create()` is called with **no `signal`/timeout**. If the model is slow, the Vercel function runs to its hard limit and the client gets no response — the Sofia interview (the flagship feature) hangs with a spinner and the designer loses unsaved answers. This is the single most likely way a real designer's first session breaks.
**Fix:** Pass `signal: AbortSignal.timeout(20000)` (tune per route, under the function's `maxDuration`), catch `AbortError`, return a 504 with a "try again" message, and make sure the client shows it and preserves input.

### HIGH — Raw `JSON.parse` on model output with no guard
**`src/app/api/ai/complete-product/route.ts:174`** and **`src/app/api/ai/find-in-folio/route.ts:207`**
The model's text is `JSON.parse`'d directly (after a regex match). Malformed or truncated JSON throws, the route 500s, and the user sees a dead spinner with no fallback.
**Fix:** Wrap in try/catch; on parse failure return a structured "couldn't read that, try rephrasing" response and log the raw output server-side. Prefer the SDK's JSON/tool-output mode over regex-extracting fenced JSON.

### HIGH — Unbounded message history / input into chat endpoints
**`src/app/api/consultations/[consultationId]/chat/route.ts:~186` and `~194`** (and **`src/app/api/support/chat/route.ts:73`**)
The `messages` array and `availableProducts` are passed to the model with **no length or token cap**. A long conversation (or a deliberately huge message) blows past the context window / timeout and can spike cost. Output is capped (`max_tokens: 1024`) but input is not.
**Fix:** Cap message count and total input tokens before the call; reject or truncate oldest turns past the cap.

### HIGH — Prompt-injection surface where scraped/user text enters prompts
**`src/lib/designer-bio/scrape-website.ts:128`** (scraped website text concatenated into the prompt) and **`src/app/api/ai/find-in-folio/route.ts:174`** (`productName`/`description` interpolated directly).
A designer importing a bio from a hostile site, or a crafted product name, can inject instructions into the prompt. Today the blast radius is limited to corrupting **the user's own** generated output (bio/match) — there's no tool that reaches other users' data — so this is HIGH-for-trust, not a cross-tenant leak. The risk grows the moment any of these prompts gain tools or DB access.
**Fix:** Wrap untrusted content in clear delimiters (e.g. `<website_content>…</website_content>`), instruct the model to treat it as data not instructions, cap length (scrape-website already truncates to 10k — tighten to ~5k), and never give these prompts tools that can read across users.

### Good (verified): retry with backoff exists in `src/lib/ai/llmClient.ts`; generation routes (`/api/posting/.../interview/generate`) already rate-limit per-user/day and per-project/minute; several fetch helpers set `AbortSignal.timeout`. The gap is that the **direct** `anthropic.messages.create()` call sites don't use these.

---

## 5. Mobile & UX Blockers

### HIGH — Public portfolio images bypass `next/image` (slow LCP on the surface that matters most)
**`src/components/project/ProjectImageGallery.tsx:42`** and **`src/components/EventCard.tsx:115`** use raw `<img>`.
The portfolio gallery is the page designers send to clients; serving full-res, un-lazy, non-WebP images here is the worst place to do it. Mobile LCP suffers and big uploads ship at full size.
**Fix:** Use `next/image` with `fill`/`sizes` and `priority` on the first image. `next.config.js` already allow-lists the CDNs; add `formats: ['image/avif','image/webp']` and `deviceSizes`.

### HIGH — No indexes on the `Project` model (and `Product`) — see §6.

### MEDIUM — iPhone HEIC uploads not handled
**`src/app/projects/new/page.tsx:24`** advertises HEIC but there's no client-side conversion/validation. iOS photos are HEIC by default; these can fail silently with no feedback.
**Fix:** Convert HEIC→JPEG client-side (e.g. `heic2any`) and show a clear error toast on unsupported files.

### MEDIUM — Faked upload progress causes double-submits on slow mobile
**`src/components/VideoUploader.tsx:125`** increments a fake percentage on a timer rather than tracking real bytes; it can hit 100% while the upload is still in flight, so users re-tap or navigate away.
**Fix:** Track real progress via `XMLHttpRequest.upload.onprogress` (or a client that exposes it) and keep the control disabled until the network request resolves.

### MEDIUM — Transcribe button lacks in-progress text
**`src/components/posting/interview/QuestionCard.tsx:163`** disables correctly during transcription but doesn't say "Transcribing…", so the wait looks like a hang.
**Fix:** Add explicit in-progress label.

---

## 6. Performance Footguns

### HIGH — `Project` model has zero indexes
**`prisma/schema.prisma`** — the `Project` block (≈ lines 409–514) declares **no `@@index`** at all. Postgres does not auto-index foreign keys, so hot lookups by `designerId` / `ownerId` / `designerOrgId` and filters on `isPublic` + `publishedAt` / `status` (feed, dashboard, directory, public profile) table-scan. Fine with 10 designers; it degrades steadily as projects accumulate. (`Product` similarly lacks `vendorId`/`category` indexes; note `ProjectImage` *is* well-indexed, so this is specifically the parent tables.)
**Fix:** Add `@@index([designerId])`, `@@index([ownerId])`, `@@index([designerOrgId])`, `@@index([isPublic, publishedAt])`, `@@index([status])` on `Project`, and `@@index([vendorId])`, `@@index([category])` on `Product`, via a migration. Follow the project's migration-discipline runbook (idempotent DDL, baseline check).

### HIGH — N+1 in the projects list endpoint
**`src/app/api/projects/route.ts:50`** — `include: { images: { include: { tags: { include: { product: true }}}}}` with no `take` and full `product` rows. A project with many tagged images fans out into a query per product and pulls entire product records.
**Fix:** Use `select` to fetch only the product fields the UI needs, and paginate/limit images. Same shape appears in the single-project GET — bound it too.

### MEDIUM — Feed/list queries without explicit caps
**`src/lib/feed/getPublishedProjectPosts.ts`** defaults to `take: 6` (good), but confirm every public list path (directory, products, events) carries a `take`. Any `findMany` on a growing table without one is a latent memory/latency spike.
**Fix:** Enforce a default `take` + cursor pagination on all public list endpoints.

### MEDIUM — Heavy 3D libs in client bundle
**`src/components/orb/OrbScene.tsx`** pulls `three` + `@react-three/fiber` + `@react-three/drei` (~300KB) into the client.
**Fix:** `dynamic(() => import('./OrbScene'), { ssr: false })` so it only loads when actually rendered.

---

## Launch Blockers

The minimum set to fix before designers touch this, ordered by effort-to-impact (cheap, high-impact first):

1. **Cron fail-open → fail-closed** (`cron/dormancy-check`, `cron/process-boost-opportunities`). One-line guard inversion + assert `CRON_SECRET` is set. *(§1, ~5 min)*
2. **Add auth to `/api/profiles` POST or delete it.** Stops unauthenticated account creation. *(§1, minutes)*
3. **Auth + SSRF guard on `/api/scrape-product`.** Session check + private-IP block list. *(§1)*
4. **Verify Resend webhook signature on `/api/email/inbound`.** Prevents forged vendor replies. *(§1)*
5. **Timeouts + try/catch around every `anthropic.messages.create()`**, surfaced to the client. Keeps the Sofia interview from hanging — the most likely first-session failure. *(§4, highest UX impact)*
6. **Guard the two raw `JSON.parse` calls** on model output (`complete-product`, `find-in-folio`). *(§4, minutes)*
7. **Wire approval/rejection notifications** (email or in-app banner) so approved designers aren't stranded on `/pending-approval`. *(§3, funnel-critical)*
8. **Replace the in-memory/filesystem `editorial-submissions` store with a Prisma model.** It silently loses data on Vercel today. *(§3)*
9. **Route project deletes through soft-delete/grace-period; reserve hard cascade for `force-delete`.** Prevents irreversible loss of published work. *(§2)*
10. **Add `Project`/`Product` indexes** via a migration. Cheap now, painful to retrofit under load. *(§6)*
11. **Handle the P2002 race in signup** (return 409, not 500). *(§2)*
12. **Decide on impersonation:** wire it through the JWT or hide the broken admin UI. *(§3)*

Items 1–6 are small, mechanical, and remove the sharpest edges (open endpoints + hung AI). 7–9 protect the designer's actual experience and data. 10–12 are integrity/scale and a loose end.

---

## Corrected / not findings (so we don't chase phantoms)

These were flagged during the sweep but, on reading the code, are **not** real launch issues — recorded so no one re-investigates:

- **"Missing viewport meta = BLOCKER" — false.** `src/app/layout.tsx` exports `metadata` and no `viewport`, but Next.js App Router auto-injects `<meta name="viewport" content="width=device-width, initial-scale=1">` by default. Mobile scaling is fine. (Add an explicit `export const viewport` only if you want to control `maximumScale`.)
- **"`force-delete` does an unguarded hard delete" — false.** `src/app/api/projects/[id]/force-delete/route.ts` requires `assertProjectDelete` **and** that the project is already `archivedAt`. The real gap is the plain `DELETE` route (§2 HIGH).
- **"`/api/ai/complete-product`, `/api/ai/find-in-folio`, `/api/import/product` lack auth" — false.** All three call `getServerSession` and 401 (verified at their respective `~line 53`/`172`). The genuinely unauthenticated AI-adjacent route is `/api/scrape-product`.
- **"Forged impersonation cookie → escalate to any user" — overstated.** The cookie has no data-layer authority; identity comes from the signed JWT and `token.impersonating` is never assigned. Downgraded to LOW (unsigned PII) + a half-wired-feature note (§3).
- **"In-memory rate limiter is broken" — partially true, not a launch blocker.** `src/lib/rateLimit.ts` is per-instance and won't be globally accurate across Vercel instances; the file itself documents this and the limits remain a useful best-effort speed bump. Move to Upstash/Redis post-launch.
- **"User profile update allows role self-escalation" — false.** `/api/auth/me` and `/api/designer/profile` both whitelist writable fields; `role`, `accountStatus`, and `passwordHash` are excluded. JWT also re-hydrates role from the DB on every request, so stale-token escalation isn't possible either.
