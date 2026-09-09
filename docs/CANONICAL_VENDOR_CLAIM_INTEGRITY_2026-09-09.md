# Canonical vendor claim integrity — 2026-09-09

Branch: `codex/folio-hardening`. Starting commit: `50388cb430df31045e13594bb7e8061b413754c5`. Main was fetched and had no new commits before implementation.

Designer attribution remains `Product.brand = display text`, `Product.vendorId = null`. Existing-product claims now require an active non-viewer vendor membership and organization verification by a real Folio administrator. A self-created organization, website, work email, client ID, or token cannot independently authorize taking an existing product.

**LEGACY VENDOR PREVIEW CLAIM: RETIRED**

**PRISMA SCHEMA CHANGES: NONE**

No migration, historical data repair, deployment, email delivery, environment change, or parked workstream was performed.

## Claim architecture before

The following map distinguishes product ownership from organization enrollment, discovery signals, and Product Record evidence. “Mounted API” means a routable Next handler, even when no current UI caller was found.

| Flow / entry point | Actor and server identity | Resource / authority check before this task | Product, organization and claim writes | Matching / review | Mounted before task? |
|---|---|---|---|---|---|
| `/vendor/preview/[token]` → `ClaimProductForm` → `/api/vendor/claim-product` | Public token reader; API had no session check; email/name supplied by client | Page looked up token string and expiry; API looked up token **record ID**, checked expiry, ignored usedAt | Historical Vendor create/update, token.vendorId/usedAt, attempted nonexistent Product.vendorRecordId and status | Name/email supplied; no vendor membership, domain proof or review | Page and API mounted; form only used by this page; broken against current Prisma |
| `/api/projects/[id]/notify-vendors` → `sendVendorProductPreviewEmail` | Authenticated project writer via assertProjectWrite | Project write scope | Historical Vendor upsert, VendorPreviewToken create; no canonical Product owner | No claim authorization; generated preview URL | API mounted; NotifyVendorsButton had no source importer; helper only called by this API |
| `/api/vendor/claim` → canClaimOrganization → turnoverUnclaimedProducts | Session user ID/email; client selected org resource | Domain inference; no-domain case allowed; could create membership; inactive membership could survive and still proceed | VendorInvite.claimedByUserId/claimedAt; Organization status; membership; Product.vendorId; ProductClaimCandidate | Domains inferred from website, member emails and owned product URLs; brand-only pending review | API mounted; no current source UI caller found |
| `turnoverUnclaimedProducts` | User ID supplied by the server caller | No internal membership check; Product conditional vendorId:null | Product owner plus CONFIRMED DOMAIN or PENDING BRAND candidate | Naive last-two-label domain collapse; exact case-insensitive brand name | Runtime helper used by organization claim |
| `/vendor/review` → `/api/vendor/review-queue` | Session plus getVendorContext; active VENDOR org membership | Candidate must belong to selected org; no non-viewer/admin-verification gate; no candidate state check | Conditional Product.vendorId write followed by unconditional CONFIRMED/REJECTED candidate | Vendor reviews brand candidates | Page/API mounted, dashboard ReviewQueueBanner links to page |
| `/vendor/products/new` → ProductWizard / StepReview → publishProduct | Server session user; action itself required only sign-in | Owner ID derived from session; no action-level membership gate | New Product.vendorId = session.user.id; no candidate or Product Record claim | Explicit product creation, no matching | Mounted server action |
| `/auth/org-setup` → `/api/auth/org-setup` | Authenticated creator; validated owner/member fork | Creates a new org, does not prove an existing brand | Organization, OrganizationUser OWNER or MEMBER, optional OrgClaimInvite; user role promotion | Self-declaration; no Product claim | Mounted onboarding UI/API |
| `/auth/claim?token=…` → `/api/auth/claim` | Session plus OrgClaimInvite token | Expiry/status; vendor membership and invited-email scope were not checked; org update count ignored | Membership upsert OWNER, Organization status, invite consumed; no Product write | Token acceptance, no product review | Mounted page/API |
| `/api/orgs/[orgId]/claim` | Session; selected org | Any signed-in user could claim UNCLAIMED org and demote owners | Membership OWNER; org status/verification timestamp; no Product write | No meaningful vendor proof | Mounted API |
| `/api/organizations` POST | Client-supplied userId/userRole, no session | No independent creator identity | New Organization plus nested membership | Self-declaration; no Product write | Mounted alternate organization API |
| `/api/orgs` POST | Session user; validated org type | Creates a new org using parameterized SQL; creator membership bound to session | Organization and OrganizationUser OWNER; user role | Self-declaration; no Product write | Mounted organization setup API |
| `/api/onboarding/firm/enroll` join | Professional session user; client org ID | Could upsert/reactivate membership in any existing org | Active MEMBER, onboarding timestamp | No approval required in this older join branch | Mounted professional onboarding API |
| `/api/orgs/[orgId]/join`, `/members`, `/team` | Session requestor; active org admin/authorized manager for approval/add | Join-request org scope, active membership and role hierarchy; team helper uses active memberships | OrgJoinRequest, OrganizationUser; no Product ownership | Approval/invitation, not display-name claim | Mounted organization-management handlers |
| `/api/orgs/[orgId]/claim-invite/email` | Session, active org membership | Token org/status/expiry; any active member could send/retarget | OrgClaimInvite.invitedEmail; delivery through existing sendEmail | Recipient link, no Product write | Mounted from organization setup |
| `/api/invites/[token]/accept` | Session ID/email | TeamMemberInvite token, expiry, pending status and recipient email | OrganizationUser membership; team invite consumed | Existing team invitation authorization; no Product claim | Mounted team invitation API; unchanged |
| `/api/admin/organizations/[orgId]` PATCH | Session resolved to User.role ADMIN from DB | Admin-only allowlist | Organization status, verifiedAt/verifiedBy and profile fields | Administrative review; no Product assignment | Mounted admin organization screen/API |
| `/api/vendor/invite-to-complete` | Authenticated designer/requestor | Product existence | VendorInviteSignal and admin Notification; no ownership/membership/token | Display-name outreach request, requires later action | Mounted product completion request API |
| `/api/vendor/invite-admin` | Session plus active org membership | Organization membership | Notification; log-only email intent, no membership or claim | Outreach only | Mounted rep presentation caller; unchanged |
| Posting status → `notifyTaggedVendors` | Existing server posting flow | Reads tagged Products and current vendors | Notifications/email subject to existing kill-switch; no claim/token/ownership write | Uses existing vendor associations | Mounted helper; onboarding link corrected |
| `VendorProductClaim` → getProductRecord / resolveRecordAudience | Server-side Product Record query | Product and active organization membership for the vendor audience | **Read-only** in current runtime; no create/update/delete writer found | Record state and testimony audience; not the Product owner mutation | Product Record reader mounted; claim writer absent |

The old turnover/review code already guarded `vendorId: null`, so it did not overwrite a product owner. Its integrity defect was recording CONFIRMED and reporting attempted counts even when the ownership write lost a race. Rejected/confirmed decisions could also be overwritten by replay.

### Other Product writers and associations

| Source / caller | Ownership effect |
|---|---|
| `/api/designer/products`, `/api/products` | New designer/catalog rows remain unclaimed; spoofed vendor IDs do not become owners. Catalog reuse/enrichment retains its conditional blank-field behavior. |
| `ensureProductForSelection` through selection/import/tagging callers | Reuses a Product or creates name/brand/URL/image/price with null vendorId. No vendor identity creation. |
| Import pending-tag verification and batch-verify | Product creation defaults vendorId null; tag/selection attribution is distinct. |
| `/api/products/[productId]` PATCH | Display/spec allowlist; never assigns vendorId; conditional existing-owner guard retained. |
| Product scrape-bql, generate-3d, project mesh/cutout generation, `triggerMeshGeneration`, `promoteCanonicalMesh`, admin generate-all-meshes | Scrape/media fields only; no ownership transition. |
| `getProductRecord` cache refresh | Denormalized record coverage fields only; not a claim writer. |
| `upsertProductFromScrape` | Callerless legacy helper with schema debt; not a mounted ownership path. |
| `src/scripts/migrate-data.js` | Historical operator-run data import; not imported by mounted application code. Not executed or changed. |
| VendorProductMatchScore, sourcebook rep resolution, vendor shadow profile/name matching, visit/boost/project associations | Recommendations, contacts, attribution or workflow associations. None assigns Product.vendorId. |
| `/vendor/create-product` / ProductUploader | Existing temporary client object/onProductAdded behavior; not the persistent publishProduct path. No new ownership authority added. |

Source searches covered Product create/createMany/update/updateMany/upsert sites, nested/SQL assignment patterns, candidate delegates, Product Record claim delegates/table references, preview tokens, invitation callers and vendor identity fields. These are source-reachability findings, not traffic measurements.

## Canonical claim architecture after

```text
Designer creation / tagging
  -> Product.brand display text + Product.vendorId null
  -> designer continues immediately

/auth/org-setup or approved organization enrollment
  -> real OrganizationUser membership
  -> Folio admin verifies the organization via existing admin organization API
  -> /vendor/review -> POST /api/vendor/review-queue { action: "discover" }
  -> turnoverUnclaimedProducts
       exact approved website host -> DOMAIN candidate -> reviewProductClaim(confirm)
       brand-only match            -> PENDING BRAND candidate -> human review
  -> canClaimExistingProducts + transaction + conditional vendorId:null write
  -> Product.vendorId = authenticated acting member's User.id
  -> matching candidate CONFIRMED only in the same successful transaction
```

`vendorClaimMembership` checks active OWNER, ADMIN, MANAGER or MEMBER in VENDOR, MANUFACTURER or SHOWROOM. VIEWER is excluded. `canClaimExistingProducts` additionally requires verifiedAt and verifiedBy resolving to a current ADMIN User. `AUTO`, self-verification and a timestamp alone are insufficient. The existing review UI resolves VENDOR context through getVendorContext; manufacturer/showroom memberships retain support in the server organization-claim helper without broadening unrelated vendor UI context.

Verification is administrative evidence using existing fields, not a new DNS/email challenge system. Self-created organizations may publish their own catalog products after active membership is established; taking existing designer-attributed products requires the stronger gate. Non-admin changes to organization name or website clear verification when the value changes. Member product URLs and member email domains no longer expand the trusted domain set.

Domain matching is exact hostname equality after normalizing case and `www.`. It does not collapse public suffixes, sibling domains or arbitrary subdomains. Ambiguous matches may remain for review; `evil.co.uk` never matches `acme.co.uk` merely through `co.uk`.

`/api/vendor/claim` remains a compatible organization-claim API. It now requires the same verified active membership plus its email/website evidence check, cannot create/reactivate membership, and consumes VendorInvite.claimedAt conditionally. Existing shadow/enrichment follow-ups remain separate. Product turnover is still best-effort there; the review-page discovery action can retry independently without consuming another organization claim.

## Legacy preview disposition

**LEGACY VENDOR PREVIEW CLAIM: RETIRED**

The preview has no unique working claim capability. Repairing it would recreate a second ownership state machine around an unrelated historical Vendor table.

- The old API returns constant HTTP 410 / ENDPOINT_RETIRED before reading request resources or touching the database. It cannot report success.
- The old page renders a generic notice with `/auth/org-setup` and `/vendor/review` links. It performs no token/product/project read and exposes no old private context. Any token value, including invalid, used or expired values, gets the same non-authorizing notice.
- The old project notify API also returns 410. Its callerless button, sole preview-email helper and ClaimProductForm were deleted.
- The current completion request accurately reports **request recorded**, not “invite sent.” It still records the downstream outreach signal without establishing ownership.
- The separate tagged-product email now links to real organization setup, replacing the nonexistent `/vendor/onboarding`. Its delivery flag remains unchanged.

### What the retired path actually did

The generator upserted historical Vendor by email, then attempted VendorPreviewToken creation with a UUID token, 14-day expiry, productId/projectId/vendorId. Both create payloads omitted required IDs in today's schema. It only logged a preview URL; no email provider was called.

The page looked up the token string; the form submitted `{ previewTokenId, vendorName, vendorEmail, website }`. The API used the database token **ID**, not the secret token string. Its includes `product`/`vendor` do not match today's `products`/`Vendor` relations. Product.vendorRecordId/vendorRecord also no longer exist. Current Prisma rejects these invalid query shapes; a successful preview or claim was not possible. This conclusion comes from regenerated schema metadata and source validation, not invoking the unsafe old handler against live data.

If somebody merely fixed the first relation names, the handler would write historical Vendor and token.vendorId before reaching the invalid Product mutation; there was no transaction. It also ignored usedAt. This partial-write risk is removed by retirement, not by interpreting the token as ownership proof.

## Ownership semantics

| Concept | Model/field | Who may set it | Meaning | Is it authorization? |
|---|---|---|---|---|
| Brand | Product.brand | Authorized product creator/editor | Manufacturer/vendor display attribution | No |
| Canonical product owner | Product.vendorId → User.id | Active vendor member creating a new catalog product; verified active member through conditional claim for an existing product | The concrete user granted existing product editing/vendor control; **not** Organization.id or Vendor.id | Yes, existing owner gates consume it; membership is checked when establishing it |
| Organization | Organization | Authenticated creator; authorized org/admin editors | Firm/vendor identity and verification/status context | A name, website or client-selected ID alone is not authority |
| Membership | OrganizationUser | Server-created new-org membership or approved org membership/invitation | Active role-specific right to act for that org | Yes; inactive and viewer memberships cannot claim products |
| Candidate | ProductClaimCandidate | Authenticated verified discovery; scoped review via reviewProductClaim | Product/org proposal, match evidence and review decision; PENDING is not an owner | No independent ownership; confirmation accompanies the successful Product write |
| Product Record claim | VendorProductClaim | No mounted runtime writer found in this source revision | Separate organization/product Record state TAGGED/CLAIMED/COLLABORATING and free collaboration-request timestamps | Used for Record vendor audience/testimony access; **does not assign Product.vendorId** |
| Historical Vendor | Vendor | Remaining historical/operator paths; retired preview no longer writes it | Separate legacy identity table | No canonical Product ownership authority |

VendorProductClaim and Product.vendorId are different facts. `resolveRecordAudience` first grants ADMIN/professional designer audiences, then recognizes the actual Product vendor user or an active member of an organization with a VendorProductClaim. `getProductRecord` computes the highest Record state and gates testimony server-side. This task creates no VendorProductClaim and changes none of those reader semantics or entitlements.

Historical Vendor still has schema relations from EventVendorEdge, InterviewSession, VendorBoostRequest and VendorPreviewToken. The callerless `resolveOrCreateShadowVendor` helper also remains. The separate vendor-boost request route still has obsolete vendorRecord reads; it is not an ownership writer and was not repaired as part of this claim task. No table consolidation or broad vendor identity migration was attempted.

## Token security

Old preview tokens have no surviving claim capability and no new producer. The retained URL does not log, consume or dereference its token.

Organization claim invitations remain distinct: org-setup mints 24 random bytes encoded base64url, with a 14-day expiry and one server-stored organization scope. The vendor acceptance branch requires authenticated active non-viewer membership in that organization; an emailed invitation must also match session email. Payload user/org IDs cannot override token scope. Joining first uses existing approval/invitation flows.

Organization status and invitation consumption are conditional writes within the acceptance transaction. Used/revoked/expired/missing invitations fail safely; an already-claimed organization cannot be taken over. Claim email sending requires the creator or an active org owner/admin. Once set, recipient email cannot be changed by resending; status/expiry/recipient are rechecked conditionally. Neither organization token acceptance nor team invite acceptance assigns Product ownership.

The existing TeamMemberInvite flow is separate membership enrollment, with scoped token, session-email match and expiry/status checks. Its global token design was not rewritten. No live invitations were sent in this session.

## Concurrency and replay

`reviewProductClaim` locks the decision through conditional PENDING → terminal updateMany inside a Prisma transaction, then assigns the Product only where vendorId is null. Any lost product race throws ClaimConflict and rolls back the candidate transition. A candidate is never recorded CONFIRMED solely because an assignment was attempted.

- Two competing org candidates: one owner and one confirmed decision; losing candidate remains pending and the caller gets a conflict.
- Confirm versus reject on the same candidate: only one terminal transition succeeds.
- Replay of CONFIRMED or REJECTED: HTTP 409, no decision rewrite and no transfer.
- Already-owned Product: unchanged; losing confirmation is rolled back.
- Domain turnover after a competing assignment: reports matched=0 for the loss; no false confirmed record.
- Repeated discovery preserves existing rejected/confirmed decisions. Counts distinguish successful assignments from pending candidates; pending candidate count is not necessarily new inserts.

Regression tests supply a serialized transaction/rollback double and inject a losing assignment between discovery and confirmation. They prove application handling and transaction intent, **not PostgreSQL lock scheduling under load**. No generalized lock service was added and no concurrency test wrote to the application database.

## Existing data — aggregate read-only evidence

The configured application database was inspected in a transaction marked READ ONLY. Relevant information_schema columns were checked against current Prisma mappings. No row IDs, emails, tokens or private content are included in this report.

| Measurement | Result |
|---|---:|
| Products with vendorId null | 175 |
| Products with vendorId non-null | 16 |
| ProductClaimCandidate rows, all statuses | 0 |
| VendorProductClaim rows, all states | 0 |
| VendorPreviewToken rows | 0 |
| Used / expired preview tokens | 0 / 0 |
| OrgClaimInvite rows, all statuses | 0 |
| Confirmed candidate without Product owner | 0 |
| Confirmed candidate reviewer differs from owner | 0 |
| Candidate missing Product or Organization | 0 |
| Vendor-type organizations verified by a current ADMIN | 0 |

No historical claim remediation is indicated by these empty claim/token tables. This is a point-in-time audit of one configured database, not a guarantee about other environments. The 16 existing owner associations are preserved; their provenance was not reclassified.

Operational prerequisite: before the first existing-product claim, a Folio admin must verify the vendor organization through the existing admin organization screen/API. No existing org was automatically blessed or changed during this task.

## Schema

**PRISMA SCHEMA CHANGES: NONE**

No migration or generated schema diff. Existing models express the claim policy. Prisma validation and migration discipline passed.

## Tests and verification

| Check | Result |
|---|---|
| Product attribution | 8 passed. Unknown brands remain unclaimed, no synthetic identities, authorized domain/review path retained. Replay expectation strengthened from fake success to 409. |
| Vendor claims | 17 passed. Retirement/no DB access/rendered guidance, domain suffix isolation, brand review, revoked/viewer/self-verified authority, spoofing, completed/rejected replay, competing claims and rollback, actual turnover counts, server-owned vendor creation, organization/token/email scope, onboarding bypass and discovery action. |
| Core journeys | All five green: 8 tests passed; one separate disposable-DB group skipped because CORE_TEST_DATABASE_URL is unavailable. Journey 5 now submits spoofed vendor organization/user IDs and verifies the real server organization. |
| Product Record invariants | Passed: targeting firewall, serializer gate placement, gate/ladder truth table; 0 violations. |
| IDOR | 558 routes, 0 Critical / 1 existing High / 15 Medium / 11 Low. Medium decreased from 16. No new High. |
| Client-import guard | Passed, no boundary violations. |
| TypeScript ratchet tests | 5 passed. |
| Changed-file lint | Passed, 0 errors; 15 existing warnings across changed source files. |
| Prisma validation | Passed. |
| Migration discipline | Passed: 32/32 loose SQL; 0 phantom delegates, missing SQL or new non-idempotent DDL. |
| Production build | Passed: production build exit 0, including final onboarding link and review discovery action. |

The unchanged High scan finding is `/api/products` conditional add-only updateMany: it includes vendorId:null and blank-field guards, but the static scanner does not recognize that ownership model. Attribution tests preserve its behavior. No scanner suppression or baseline relaxation was introduced for that existing finding.

Core and claim suites use real handlers/session authorization with controlled service/database boundaries. They do not prove a live browser session, real outbound email, process-restart durability, or production database concurrency. The read-only aggregate audit is the only live application-database interaction.

## TypeScript

| Metric | Before | After |
|---|---:|---:|
| Diagnostics | 985 | 972 |
| Fingerprints | 622 | 609 |
| Files with diagnostics | 251 | 247 |
| New fingerprints | — | 0 |

`typecheck:prepare`, `typecheck`, and `typecheck:baseline:update` passed. The baseline was lowered, not widened. Build configuration skips its embedded type/lint passes; the separate compiler ratchet and changed-file lint are the evidence for those checks.

## Exact changes

Application files modified:

- `src/app/api/auth/claim/route.ts`
- `src/app/api/onboarding/firm/enroll/route.ts`
- `src/app/api/organizations/route.ts`
- `src/app/api/orgs/[orgId]/claim-invite/email/route.ts`
- `src/app/api/orgs/[orgId]/claim/route.ts`
- `src/app/api/orgs/[orgId]/route.ts`
- `src/app/api/projects/[id]/notify-vendors/route.ts`
- `src/app/api/vendor/claim-product/route.ts`
- `src/app/api/vendor/claim/route.ts`
- `src/app/api/vendor/invite-to-complete/route.ts`
- `src/app/api/vendor/review-queue/route.ts`
- `src/app/vendor/preview/[token]/page.tsx`
- `src/app/vendor/products/actions.ts`
- `src/app/vendor/review/ReviewQueueClient.tsx`
- `src/lib/email/notifyVendorTagged.ts`
- `src/lib/vendor/claimTurnover.ts`
- `src/lib/vendor/domain-verification.ts`

Application files added:

- `src/lib/vendor/claimAuthorization.ts`
- `src/lib/vendor/reviewProductClaim.ts`

Deleted:

- `src/components/projects/NotifyVendorsButton.tsx`
- `src/components/vendor/ClaimProductForm.tsx`
- `src/lib/email/sendVendorProductPreviewEmail.ts`

Tests, baseline and documentation:

- `package.json` — test:vendor-claims command.
- `scripts/core/vendor-claims.test.cjs` — new focused suite.
- `scripts/core/product-attribution.test.cjs` — verified organization fixtures and honest replay response.
- `scripts/core/journeys.test.cjs` — Journey 5 spoofing assertion input.
- `tools/typescript-baseline.json` — lower protected debt.
- `tasks/todo.md` — plan and verification review.
- `docs/CANONICAL_VENDOR_CLAIM_INTEGRITY_2026-09-09.md` — this report.

Local evidence logs/scripts under `tasks/claim-*` are not staged as application changes. Pre-existing untracked user artifacts are preserved.

## Final status

Implementation and required local verification complete. Disposable PostgreSQL concurrency/browser/email delivery are not claimed as tested.

VENDOR CLAIM INTEGRITY COMPLETE
