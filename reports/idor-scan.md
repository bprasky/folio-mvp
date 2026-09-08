# IDOR / Authorization-Gap Scan Report

_Generated: 2026-09-08T18:51:13.159Z_
_Scanned root: `src/app/api`_
_Files scanned: 558_

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 16 |
| Low | 20 |

### By rule

| Rule | Count |
|---|---|
| IDOR004 | 1 |
| IDOR005 | 26 |
| IDOR006 | 10 |

## High (1)

### `src/app/api/products/route.ts`:161 — IDOR004 [POST]

Mutation prisma.product.updateMany uses where: { id } with no ownership constraint.

```ts
{ id: existing.id, vendorId: null, AND: Object.keys(addOnly).map(field => ({ [field]: existing[field] })) }
```

## Medium (16)

### `src/app/api/admin/festivals/route.ts`:170 — IDOR006 [POST]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const session = await getServerSession(authOptions);
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

### `src/app/api/context/match/route.ts`:30 — IDOR006 [GET]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const session = await getServerSession(authOptions);
```

### `src/app/api/context/match/route.ts`:109 — IDOR006 [POST]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
try {
const session = await getServerSession(authOptions);
```

### `src/app/api/messages/inbox/route.ts`:5 — IDOR006 [GET]

Raw SQL ($queryRaw/$executeRaw) used — scanner cannot reason about ownership.

```ts
{
const userId = await getUserIdFromRequest(req);
if (!userId) {
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

### `src/app/api/scrape-product/route.ts`:33 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const session = await auth();
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

### `src/app/api/vendor/claim-product/route.ts`:6 — IDOR005 [POST]

Mutating route handler POST has no session check.

```ts
{
try {
const body = await req.json();
```

## Low (20)

### `src/app/api/auth/claim/route.ts`:21 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
const token = request.nextUrl.searchParams.get('token');
if (!token || token.length < 8) {
```

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

### `src/app/api/editorial-submissions/route.ts`:127 — IDOR005 [GET]

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

### `src/app/api/export-spec-sheet/route.ts`:6 — IDOR005 [GET]

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

### `src/app/api/projects/handoff/route.ts`:186 — IDOR005 [GET]

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

### `src/app/api/tag-product-to-image/route.ts`:567 — IDOR005 [GET]

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

### `src/app/api/videos/clips/route.ts`:82 — IDOR005 [GET]

Read route handler GET has no session check.

```ts
{
try {
const { searchParams } = new URL(request.url);
```

---

This scanner is a high-recall heuristic linter. Add `// @idor-allow: <token> reason="..."` to the top of a route file to suppress false positives. See `scripts/security/idor-scan.ts` for the full rule catalog.
