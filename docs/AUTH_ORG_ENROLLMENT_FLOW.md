# Auth + org enrollment flow

Single source of truth for what happens between `/auth/signup` and a designer's first publishable project. Lives alongside `INDIVIDUAL_FIRST_ARCHITECTURE.md` (the foundational philosophy) and `14_MONETIZATION_AND_VERIFICATION.md` (the `OrgStatus` lifecycle).

This doc is the policy. The endpoints, page, and helpers cited below are the implementation.

---

## The journey

```
/auth/signup
   │  (signs up as INDIVIDUAL with APPROVED status, no admin queue)
   │
   ├── "Just browsing"   ──►  /onboarding/diagnostic  (passive use of Folio)
   │
   └── {Designer | Architect | Builder | Vendor}
            │
            ▼
       /auth/org-setup?type=…
            │
   ┌────────┼─────────────────────────────────┐
   │        │                                 │
   │  Scenario A (no orgs)            Scenario B (≥1 org membership)
   │        │                                 │
   │   Search → Request to join            Add capability to existing org (admin-only)
   │   Search → Create new                 Create a separate new org
   │
   └─► "I'll do this later" → /
```

---

## The five actions and the policies for each

### 1. Create new (founder branch)

User clicks "Create one" → picks "Yes, I'm the founder or an admin" → submits name.

- `Organization` is created with `status: UNCLAIMED` and `capabilities: [type]`.
- `OrganizationUser` is created with `role: OWNER`.
- `User.role` auto-promotes from INDIVIDUAL → matching pro role (`DESIGNER`, `ARCHITECT`, `BUILDER`, `VENDOR`). Guarded on `role = 'INDIVIDUAL'` — never overwrites already-promoted users.
- No claim invite minted (the user *is* the admin).
- Redirect → `/onboarding/diagnostic`.

Endpoint: `POST /api/auth/org-setup` with `{ name, type, role: 'owner', ... }`.

### 2. Create new (member branch — "I work here, someone else will set up the page")

Same form, but user picks "I work here". This is the "designer at Studio X, Studio X isn't on Folio, I'm not the founder" case.

- `Organization` is created with `status: UNCLAIMED` and `capabilities: [type]`.
- `OrganizationUser` is created with `role: MEMBER`.
- `User.role` auto-promotes — they really are a DESIGNER even if their firm page isn't claimed yet.
- A single-use `OrgClaimInvite` is minted with a 14-day expiry and a random URL-safe token.
- The page surfaces the claim URL (copy-to-clipboard) and an email-input + "Send setup link" button.
- The member can keep using Folio — save, draft projects, see what posts would look like — but **publishing is blocked** by the org-status gate (see §4) until someone claims the firm.

Endpoint: `POST /api/auth/org-setup` with `{ name, type, role: 'member', ... }`. Returns `{ organizationId, claimInviteToken, claimUrl }`.

### 3. Request to join existing org

User searches, finds their firm, clicks "Request to join".

- `OrgJoinRequest` is created with `status: PENDING`.
- No `OrganizationUser` row yet. `User.role` stays INDIVIDUAL.
- User lands on `/` and can use Folio in INDIVIDUAL mode while they wait.
- An admin of the target org approves via `PATCH /api/orgs/[orgId]/join`. On approval the `OrganizationUser` is created with `role: MEMBER` and `User.role` is promoted from INDIVIDUAL → matching pro role (same guard pattern as create).

Endpoint: `POST /api/orgs/[orgId]/join` with empty body. Re-requesting works if a previous request was REJECTED (the existing row is reused).

### 4. Add capability to an org you already admin (hybrid)

Scenario B only. OWNER/ADMIN of the target org picks an intent that the org doesn't already cover (e.g. their DESIGN_FIRM also sells products → add VENDOR).

- `Organization.capabilities` gains the new `OrgType`.
- No role change on the user (they keep whatever pro role they already have).
- No new OrganizationUser row.
- Admin-only — MEMBER sees the option disabled with an inline explainer.

Endpoint: `POST /api/auth/org-setup/add-capability` with `{ organizationId, capability }`.

### 5. "I'll do this later"

User clicks the foot link. No DB changes. Lands on `/`. User can return to `/auth/org-setup` any time.

### 6. Claim accept (the recipient of a member-branch invite)

Recipient clicks the URL `/auth/claim?token=…`:

- **NOT_FOUND / EXPIRED / CLAIMED / REVOKED** → terminal-state page with "Continue to Folio".
- **PENDING + not signed in** → "Sign up to claim {Org}" / "Sign in" — both flows return to the same `/auth/claim?token=…` URL.
- **PENDING + signed in** → "Claim {Org}" button. On POST:
  - `OrganizationUser` upserted with `role: OWNER` (or upgraded from existing MEMBER).
  - `Organization.status` flips UNCLAIMED → CLAIMED, with `verifiedAt` + `verifiedBy = claimerId`.
  - `OrgClaimInvite.status` → CLAIMED, `claimedById` + `claimedAt` recorded.
  - `User.role` promoted if still INDIVIDUAL.
- Redirect → `/onboarding/diagnostic`.

Endpoints: `GET /api/auth/claim?token=...` (public, returns org info + state) and `POST /api/auth/claim` (session-gated).

---

## Role-promotion table

The `User.role` enum is single-valued. Promotion fires once, at the moment of the first qualifying org action, and is never overwritten thereafter.

| User action                                | When `User.role` flips                                                |
|---|---|
| Sign up (any intent)                       | Stays `INDIVIDUAL`.                                                   |
| Create new — founder branch                | Immediately on create (transaction with org + membership).            |
| Create new — member branch                 | Immediately on create — they are a designer, the firm page isn't.    |
| Request to join an existing org            | Stays `INDIVIDUAL`. Promotes when admin **approves** the request.    |
| Add capability to an org you already admin | No change — user already has a pro role from their original org.     |
| Claim a pending invite                     | Promotes on claim (transaction with status flip + membership upsert).|

OrgType → Role mapping lives in `src/lib/onboarding/role-org-mapping.ts:roleForOrgType` and is used by every promotion site so the rules don't drift.

```
DESIGN_FIRM         → DESIGNER
ARCHITECTURE_FIRM   → ARCHITECT
CONTRACTOR          → BUILDER
VENDOR | MANUFACTURER | SHOWROOM → VENDOR
PHOTOGRAPHY_STUDIO  → PHOTOGRAPHER
DEVELOPER           → DEVELOPER
```

Promotion is always guarded as `WHERE role = 'INDIVIDUAL'` — never overwrite. Cross-org transitions (e.g. a DESIGNER joining a VENDOR org) keep the user's original role; the hybrid-capabilities path covers the "designer who also sells products" case at the org level instead.

---

## Publishing gate

**Rule:** publishing requires the backing organization to be `CLAIMED` or `PROFESSIONAL`. Drafts are always allowed. UNCLAIMED is a placeholder state — the firm's actual admin hasn't claimed the page yet, so we don't broadcast on it.

**Implementation:** central utility `canPublishFromOrg(userId, organizationId | null)` in `src/lib/permissions.ts`. Returns `{ ok: true } | { ok: false, reason: 'org_unclaimed' | 'no_org' | 'org_not_found' | 'not_a_member' }`.

- If `organizationId` is provided, gate that org's status directly.
- If `organizationId` is null (user-scoped content), fall back to `User.operatingAsOrgId`, then to "any CLAIMED+ membership". INDIVIDUAL users with no claimed memberships always deny.

**Wired into:**

- `PATCH /api/posting/project/[projectId]/status` — gates publish transitions (`targetStatus === 'PUBLISHED'`).
- `POST /api/collaboration/stories/[id]/publish` — gates publish on the vendor org.

**Documented but not yet wired** (will use the same utility when each is next touched):

- `POST /api/designer/posts` (collections) — needs to look up the designer's operating org.
- `POST /api/products` (vendor products) — needs to map `Product.vendorId` (User) to the vendor org.
- The unmapped Story-create endpoint (per the routing audit).
- VendorPost publish transition (the create endpoint currently only emits DRAFT).

When a publisher hits 403, the client should render the reason as actionable copy. For `org_unclaimed`, the current copy is *"Your firm page isn't set up yet — drafts only until it's claimed."* with a "Send the setup link" affordance back to the user's pending `OrgClaimInvite`.

---

## What stays INDIVIDUAL

- Just-browsing signups.
- Users with only PENDING `OrgJoinRequest` rows (no membership yet).
- Users who clicked "I'll do this later".
- Anyone whose org was deleted or whose membership was deactivated (no automatic demotion — but no further promotion either since the guard requires INDIVIDUAL).

---

## Known gaps / follow-ups

- **Admin review UI** for pending join requests. The `PATCH /api/orgs/[orgId]/join` endpoint is admin-gated and live; an admin can approve/reject via API. The in-app surface (a "Pending requests" list on the org settings page) ships separately.
- **Claim-token trust model.** `OrgClaimInvite.token` is a bearer credential — anyone who has the URL can claim. We do persist `invitedEmail` on the invite so we know who was *meant* to receive it, but we don't enforce email-match at claim time. Tighten if abuse surfaces.
- **Transactional email.** `sendEmail()` (Resend) is wired but returns success without delivering when `RESEND_API_KEY` is unset. The claim-link email endpoint already records `invitedEmail` on the invite row regardless of delivery, so we have an audit trail when real sending lands.
- **Notification model entries** when a join request is filed. The Notifications model exists; wiring it is its own task.
- **Photographer / Developer intents** in the signup chip picker. Roles exist in the enum, OrgTypes exist, mapping is in place — just not surfaced in the UI yet.
- **Two-org merge.** Admin-of-Org-A + Admin-of-Org-B → combined hybrid. Out of scope; current hybrid only adds a capability to a single org the admin already owns.

---

## File map

| File | Role |
|---|---|
| `src/app/auth/signup/page.tsx` | The split editorial signup with user-type chips. |
| `src/app/auth/org-setup/page.tsx` | Server Component; counts memberships and routes to scenario A or B. |
| `src/app/auth/org-setup/_ScenarioA.tsx` | Search + create (with founder/member fork) + member-branch confirmation panel. |
| `src/app/auth/org-setup/_ScenarioB.tsx` | Hybrid add-capability + create-separate paths. |
| `src/app/auth/claim/page.tsx` | Claim-invite landing page (Server Component). |
| `src/app/auth/claim/_ClaimAcceptButton.tsx` | Client component that POSTs the claim accept. |
| `src/app/api/auth/org-setup/route.ts` | Create new org. Branches on `role: 'owner' \| 'member'`. |
| `src/app/api/auth/org-setup/add-capability/route.ts` | Hybrid add capability (admin-only). |
| `src/app/api/orgs/[orgId]/join/route.ts` | Phase 2 request-based join + admin PATCH approve/reject (with role promotion on approve). |
| `src/app/api/orgs/[orgId]/claim-invite/email/route.ts` | Send the invite URL to a recipient email. |
| `src/app/api/auth/claim/route.ts` | GET (validate) + POST (claim accept). |
| `src/lib/permissions.ts` | `canPublishFromOrg()` and the rest of the permission utilities. |
| `src/lib/onboarding/role-org-mapping.ts` | `orgTypeForRole` and `roleForOrgType` — the canonical mapping in both directions. |
| `prisma/schema.prisma` | `Organization.capabilities`, `OrgClaimInvite`, `ClaimStatus`, `OrgStatus`, `OrgJoinRequest`. |
