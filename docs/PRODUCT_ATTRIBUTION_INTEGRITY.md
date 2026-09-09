# Product attribution integrity — 2026-09-09

Branch: `codex/folio-hardening`. Scope: stop synthetic vendor-account creation in designer product submission. No vendor identity redesign, historical data repair, schema changes or endpoint consolidation.

## Confirmed defect and fix

Before:

```text
/designer/products/new → POST /api/designer/products
  → User.create({ email: vendor+<normalized-name><random-number>@folio.local,
                  name: <vendor text>, role: VENDOR, passwordHash: external })
  → Product.create({ vendorId: <new user id>, brand: <vendor text>, ... })
```

Every submission created one User and one Product. The comment said “create or reuse,” but there was no lookup or reuse. Repeated names generated additional accounts (or could fail on a random email collision). No Vendor or Organization was created by this route. The synthetic account incorrectly occupied Product.vendorId, so claim turnover, which selects vendorId null, could not pick up the product.

The marker `external` is not a bcrypt password hash. Credentials authentication uses bcrypt comparison. There is no source path in this submission endpoint that creates real organization membership, verifies a work email or turns the synthetic account into a legitimate vendor login. Historical activity still must be checked before any future repair.

After:

```text
Designer product input → validated product fields
  → unclaimedProductAttribution(vendor display text)
  → Product { brand: display text, vendorId: null }
  → immediate product tagging → canonical project publication
  → later existing authorized claim/review → real vendor user relationship
```

Both `/api/designer/products` and new-row creation in `/api/products` use the same small pure attribution helper. Neither accepts ownership fields from the client. Existing URL deduplication and protected add-only merging in `/api/products` remain unchanged. The designer route keeps its existing `{ ok, productId }` response, `External` category, optional input fields and default display label. SKU remains an ignored legacy form field because Product has no SKU column; it was not persisted before this fix either.

## Attribution policy

| Concept | Current representation / rule |
|---|---|
| Vendor/manufacturer display attribution | Product.brand. A name is text, not authorization. |
| Unclaimed Product | Product.vendorId null. No vendor onboarding required. isPending remains false for ordinary designer creation so tagging/publication is not newly gated. |
| Canonical vendor Organization | Existing Organization and authenticated OrganizationUser membership. Product has no direct vendor Organization foreign key. |
| Product owner | Product.vendorId points to a real User. Organization association is mediated by membership and existing claim/candidate records. |
| Product Record claim state | VendorProductClaim is a separate organization/product relation read by Product Record. This task does not invent claim rows or change that workflow. |
| Historical Vendor model | Separate legacy vendors table with optional userId. The designer submission route does not need or create it. |

Even an exact match to an existing Organization name stays unclaimed at creation. No fuzzy matching, display-name ownership inference, or client-supplied vendor/organization ID is used. Public catalog and Product Record serializers already fall back to brand for vendor display; completeness also accepts brand without vendorId.

## Current creation/import/selection map

Source search found seven Product create sites; each is accounted for below. Runtime callers were checked in routes/components rather than inferred from names.

| Path and mounted callers | Actor / inputs | Created fields and attribution | Identity, dedup and claim behavior |
|---|---|---|---|
| `/designer/products/new` → `/api/designer/products` | Signed-in submitter; name, vendorName, URL, image URL, priceCents; SKU sent but not stored | name, brand, URL, imageUrl, price, category External; vendorId null after fix | Before: new synthetic User per request. After: no identity creation. No product dedup added; repeats may create distinct Products but never vendor accounts. Existing claims apply later. |
| Project page → TaggingSection → ProductTagPicker → `/api/products` | Signed-in designer; search selection or URL/manual name, description, brand, category, image, price, URL and pending scrape state | Standard Product fields; brand text, vendorId null for new products | Normalized URL reuse; existing claimed rows are preserved, unclaimed rows accept only blank-field enrichment with conditional writes. No User/Organization/Vendor creation. |
| Project setup/media → ProjectCreationModal → `/api/import/product`, then `/api/products` and tag endpoint | Signed-in project creator; imported or selected product fields | Import returns metadata; `/api/products` persists as above | Selection reuses IDs; manual/imported creation follows the shared unclaimed policy. |
| `/api/import/product` called by ProjectCreationModal, ProductForm in EditProductDrawer, and vendor ProductUploader | Signed-in actor; URL and optional project/room context | CachedProduct fields include productName, brand, vendorName, SKU, price/spec metadata; BrandRegistry and search/fingerprint metadata may also be written | Does not itself create Product, User, Organization or Vendor. Cache keyed by normalized URL, unique races reused. BrandRegistry normalization is lookup metadata, not ownership. |
| `/api/scrape-product` → aiExtractProduct; product scrape-bql/lookup routes | Current URL tagging/editing surfaces | Shared CachedProduct enrichment and existing Product scrape fields | Cache lookup/write does not confer a vendor claim. Product creation is a separate caller step. |
| Selection creation/update → ensureProductForSelection | Designer/vendor selection routes, room selections, selection save-to-project, extraction confirmation, visit-token destination, posting auto-tag/tag-diagnostic | name, brand from vendorName, imageUrl, price, URL; vendorId defaults null | Reuses a Product by case-insensitive exact name; otherwise creates unclaimed. No identity creation. Name-only product dedup is an existing policy difference, not an ownership rule; not redesigned here. |
| Import verification queue / TaggingSection → pending-tag verify and import batch-verify | Import owner; confirm suggestion or correct with an existing product ID | Suggestion name, brand/vendor text, URL, category; isPending true; ProductTag when an image is present | Reuses URL or name+brand match; new rows have null vendorId. No identity creation. Existing pending-state behavior retained. |
| `/vendor/products/new` → ProductWizard → StepReview → publishProduct server action | Page requires vendor role and feature flag; action uses signed-in user; name, description, brand/category, image/source URL | Product.vendorId = session.user.id; display fields from payload | Real current session identity, never a vendor ID from the payload. No duplicate entity creation; product rows are not deduplicated. Action authorization is not expanded in this scoped fix. |
| `/vendor/create-product` → ProductUploader | Mounted page; imports metadata then calls onProductAdded | Client constructs a temporary object with vendorId `current-vendor` | Parent currently logs the object and redirects; this branch does not persist a Product or account. Preserved as an existing separate limitation. |
| upsertProductFromScrape helper | No current source importer found | Would create sourceUrl/sourceType/origin and other legacy Product fields | Callerless helper, with fields outside the current Product schema. Not a mounted creation path; left untouched. |

Selection helper callers include `/api/selections`, `/api/selections/[selectionId]`, selection save-to-project, designer/vendor project selections, project room selections, extraction confirmation, visit-token choose-destination and posting auto-tag/tag-diagnostic. Their identity decision is already unclaimed; this task does not consolidate their unrelated authorization or product-dedup behavior.

## Claim compatibility and limits

The current organization-claim route calls canClaimOrganization before membership/claim mutation, then turnoverUnclaimedProducts. Its existing domain rules use organization website and associated product/member domains. Domain-matched unclaimed products receive the real claiming User ID; a conditional vendorId-null write prevents replacing an already assigned owner. Exact brand-only matches produce PENDING ProductClaimCandidate rows without assigning ownership.

The review queue resolves the caller's actual active vendor membership, checks the candidate organization, and conditionally assigns only a still-unclaimed product. The focused tests exercise those real boundaries: wrong-domain designer rejected; matching-domain vendor accepted; brand-only assignment deferred; designer and another organization denied review; real member can confirm; stale/replayed confirmation cannot replace an assigned owner. Tag rows survive turnover/review.

No claim endpoint or helper was modified. These tests do not certify every pre-existing claim policy: for example the domain verifier has an existing permissive fallback for organizations with no inferred domains. Product Record's separate VendorProductClaim creation workflow is not added here.

The legacy `/vendor/preview/[token]` → ClaimProductForm → `/api/vendor/claim-product` path still references old relation/field names such as product.vendorRecordId that are absent from the current schema. It is not the canonical compatibility path proved here, and fixing it would be a separate task.

## Historical records — read-only evidence

A read-only transaction against the configured application database on 2026-09-09 found:

- Users matching `vendor+…@folio.local`: **0**.
- Exact source fingerprint (same email pattern, VENDOR role, passwordHash external): **0**.
- Products owned by matching users: **0**.
- Matching users' organization memberships, onboarded records and historical Vendor links: **0**.

Only aggregate results were retained. No rows were changed. This is a point-in-time measurement of the configured database, not proof that another environment or an account with edited identifiers contains no historical synthetic records. JWT sessions do not supply durable login history in the Prisma schema.

See `SYNTHETIC_VENDOR_REMEDIATION.md` for the separate, unexecuted future remediation proposal.

## Regression evidence

The focused test was run against the old route first and failed on synthetic vendor IDs and increasing User count. After the fix, all eight tests pass (seven scenarios plus the parent): unknown vendor, repeated/known/spoofed identity input, protected catalog reuse, immediate tagging, domain/review claim boundaries, malformed attribution and anonymous rejection.

Core journey 2 now creates its product through the corrected designer API and asserts brand preservation, null vendorId and unchanged User count before tagging. All five core journeys pass: onboarding; project/room/image/product tagging; ownership isolation; interview → ProjectPost → publication/withdrawal; vendor/designer collaboration. The suite retains its explicit live-database skip; fixture-backed handler tests do not replace live database execution.

Local verification artifacts: `tasks/attribution-*`. No live LLM was called by these regression tests, and no browser/microphone transport verification was added.

## Exact changed files

- `src/app/api/designer/products/route.ts`: validates the product input and creates an unclaimed Product without creating any identity.
- `src/app/api/products/route.ts`: uses the same attribution policy for new Products; claimed-row reuse and conditional enrichment are unchanged.
- `src/lib/products/unclaimedAttribution.ts`: small pure helper returning brand text and null vendorId.
- `scripts/core/product-attribution.test.cjs`: focused creation/tagging/claim regressions using the existing memory harness and real application handlers.
- `scripts/core/journeys.test.cjs`: core journey 2 now exercises designer product creation before tagging.
- `package.json`: adds `test:product-attribution`; no dependencies changed.
- `tasks/todo.md`: plan and completion evidence.
- `docs/PRODUCT_ATTRIBUTION_INTEGRITY.md`: this source audit and result record.
- `docs/SYNTHETIC_VENDOR_REMEDIATION.md`: separate unexecuted historical repair proposal.

## Verification results

| Check | Result |
|---|---|
| `npm run test:product-attribution` | PASS: 8 tests, no skips |
| `npm run test:core` | PASS: 8 tests, 1 explicitly skipped live-DB group |
| Product Record invariants (`--ci`) | PASS: targeting firewall, testimony gate placement, gate/ladder truth table; zero violations |
| Product naming | PASS |
| Type preparation and TypeScript ratchet | PASS: 988 diagnostics / 625 fingerprints / 253 files before and after; zero new fingerprints |
| Ratchet guard tests | PASS: 5 tests |
| Client-import guard | PASS: zero violations |
| Changed-file lint | PASS: zero errors; four pre-existing explicit-any warnings in the catalog route |
| Production build | PASS |
| IDOR | Unchanged: 558 routes, 0 Critical / 1 existing High / 16 Medium / 19 Low |
| Migration discipline | PASS: all counts at or below baseline; no Prisma or migration changes |

No TypeScript baseline update is needed because debt did not change. No Prisma schema edit or data repair was performed.

After the fix, in the corrected designer creation path: **FAKE USER CREATION: NO. FAKE ORGANIZATION CREATION: NO. DISPLAY-NAME OWNERSHIP INFERENCE: NO.**

PRODUCT ATTRIBUTION INTEGRITY COMPLETE
