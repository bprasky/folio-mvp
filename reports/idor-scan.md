# IDOR / Authorization-Gap Scan Report

_Generated: 2026-04-13T18:44:30.328Z_
_Scanned root: `src/app/api`_
_Files scanned: 523_

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 40 |
| Low | 20 |

### By rule

| Rule | Count |
|---|---|
| IDOR005 | 50 |
| IDOR006 | 10 |

## Medium (40)

### `src/app/api/admin/festivals/route.ts`:168 — IDOR006 [POST]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
rateLimit({
```

### `src/app/api/analytics/concierge/route.ts`:5 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const analyticsData = await request.json();
```

### `src/app/api/assign-projects/route.ts`:47 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const projects = loadProjects();
```

### `src/app/api/auth/me/avatar/route.ts`:21 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
const userId = await getUserId(req);
if (!userId) {
```

### `src/app/api/auth/me/route.ts`:79 — IDOR005 [PUT]

Mutating route handler PUT has no session check.

```ts
{
const id = await getUserId(req);
if (!id) return NextResponse.json({ ok: false }, { status: 401 });
```

### `src/app/api/buyer/auth/route.ts`:96 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/buyer/auth/route.ts`:159 — IDOR005 [DELETE]

Mutating route handler DELETE has no session check.

```ts
{
try {
const searchParams = req.nextUrl.searchParams;
```

### `src/app/api/consultations/route.ts`:14 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/context/match/route.ts`:103 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/context/match/route.ts`:28 — IDOR006 [GET]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const { searchParams } = new URL(req.url);
```

### `src/app/api/context/match/route.ts`:103 — IDOR006 [POST]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/editorial-submissions/route.ts`:51 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const { projectId, designerId } = await request.json();
```

### `src/app/api/editorial-submissions/route.ts`:161 — IDOR005 [PUT]

Mutating route handler PUT has no session check.

```ts
{
try {
const { submissionId, action, rejectionReason, reviewedBy } = await request.json();
```

### `src/app/api/event-concierge/parse/route.ts`:135 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const { input } = await request.json();
```

### `src/app/api/export/spec-html/route.ts`:6 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
const { projectId } = await req.json();
if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });
```

### `src/app/api/instagram/campaign/generate/route.ts`:24 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body: GenerateCampaignRequest = await request.json();
```

### `src/app/api/instagram/campaign/preview/route.ts`:11 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body: PreviewRequest = await request.json();
```

### `src/app/api/messages/inbox/route.ts`:5 — IDOR006 [GET]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
const userId = await getUserIdFromRequest(req);
if (!userId) {
```

### `src/app/api/orb-agent/route.ts`:136 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body: OrbAgentRequest = await request.json();
```

### `src/app/api/orgs/route.ts`:16 — IDOR006 [GET]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const url = new URL(request.url);
```

### `src/app/api/orgs/route.ts`:122 — IDOR006 [POST]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const session = await getServerSession(authOptions);
```

### `src/app/api/photographer/dashboard/route.ts`:12 — IDOR006 [GET]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const session = await getServerSession(authOptions);
```

### `src/app/api/projects/[id]/rooms/[roomId]/gen-image/feedback/route.ts`:10 — IDOR006 [POST]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const session = await getServerSession();
```

### `src/app/api/projects/handoff/route.ts`:121 — IDOR005 [PUT]

Mutating route handler PUT has no session check.

```ts
{
try {
const body = await request.json();
```

### `src/app/api/quotes/route.ts`:8 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const formData = await request.formData();
```

### `src/app/api/selections/route.ts`:7 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await request.json();
```

### `src/app/api/set-active-profile/route.ts`:5 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const { profileId, role } = await request.json();
```

### `src/app/api/support/chat/route.ts`:60 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
if (!process.env.ANTHROPIC_API_KEY) {
```

### `src/app/api/update-designer-profile/route.ts`:5 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const profileData = await request.json();
```

### `src/app/api/upload-spec-sheet/route.ts`:8 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const formData = await request.formData();
```

### `src/app/api/user/workspace-context/route.ts`:16 — IDOR006 [POST]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const session = await getServerSession(authOptions);
```

### `src/app/api/user/workspace-context/route.ts`:99 — IDOR006 [GET]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const session = await getServerSession(authOptions);
```

### `src/app/api/vendor-actions/create-appreciation-dinner/route.ts`:92 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/vendor-actions/create-discovery-lunch/route.ts`:93 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/vendor-analytics/chat/route.ts`:75 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = (await req.json()) as VendorAnalyticsChatRequest;
```

### `src/app/api/vendor/ai-actions/route.ts`:9 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/vendor/ai-analyst/route.ts`:10 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/vendor/claim-product/route.ts`:6 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

### `src/app/api/vendors/events/create/route.ts`:8 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
// Debug: Log the content type and try to parse the body
```

### `src/app/api/videos/clips/route.ts`:7 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await request.json();
```

## Low (20)

### `src/app/api/auth/me/route.ts`:15 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
const id = await getUserId(req);
if (!id) return NextResponse.json({ ok: false }, { status: 401 });
```

### `src/app/api/auth/rep-onboarding/validate/route.ts`:13 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/buyer/auth/route.ts`:13 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const searchParams = req.nextUrl.searchParams;
```

### `src/app/api/context/match/route.ts`:28 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(req.url);
```

### `src/app/api/editorial-submissions/route.ts`:121 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const url = new URL(request.url);
```

### `src/app/api/event-import/route.ts`:84 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/export-all-tagged-products/route.ts`:22 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const projects = loadProjects();
```

### `src/app/api/export-project-tags/route.ts`:43 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/export-spec-sheet/route.ts`:8 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/export-tearsheet/route.ts`:22 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/get-designer-profile/route.ts`:5 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/health/llm/route.ts`:5 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
// Match generator logic: key must exist AND ANTHROPIC_ENABLED !== "false"
const enabled = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== "false";
```

### `src/app/api/instagram/proxy-image/route.ts`:10 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const searchParams = request.nextUrl.searchParams;
```

### `src/app/api/orb-faqs/route.ts`:6 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const searchParams = request.nextUrl.searchParams;
```

### `src/app/api/projects/handoff/route.ts`:182 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/search/all/route.ts`:10 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/tag-product-to-image/route.ts`:542 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

### `src/app/api/vendor/qbr/route.ts`:12 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
// For now, use demo state. In production, this would fetch from DB based on vendorId
```

### `src/app/api/vendor/visits/route.ts`:127 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const t = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
```

### `src/app/api/videos/clips/route.ts`:76 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

---

This scanner is a high-recall heuristic linter. Add `// @idor-allow: <token> reason="..."` to the top of a route file to suppress false positives. See `scripts/security/idor-scan.ts` for the full rule catalog.
