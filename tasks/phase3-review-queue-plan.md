# Phase 3 — Vendor review queue (PLAN — awaiting approval)

Goal: a claimed vendor reviews the products attributed to them and the
ambiguous brand-only candidates Phase 2 deliberately skipped — Confirm, Correct,
or Reject each — with tag usage/attribution visible. No tag data is ever
mutated.

## What's derived vs. what needs persistence
- "Products I own" = `Product.vendorId === me` → query, no schema.
- "Used in N tags by M designers" = count `ProjectProductTag` → query, no schema.
- "Brand-only candidates" (brand matches org name, domain did not) + their
  Confirm/Reject decision + audit → NEEDS persistence (a queue table).

## Proposed schema (single table, String enums to avoid CREATE TYPE)
```prisma
model ProductClaimCandidate {
  id             String    @id @default(cuid())
  productId      String
  organizationId String
  matchType      String    // "DOMAIN" | "BRAND"
  status         String    @default("PENDING") // "PENDING" | "CONFIRMED" | "REJECTED"
  reviewedById   String?
  reviewedAt     DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  product      Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  reviewedBy   User?        @relation(fields: [reviewedById], references: [id])

  @@unique([productId, organizationId])
  @@index([organizationId, status])
  @@map("product_claim_candidates")
}
```
Inverse relations added to Product, Organization, User (the User block is the
highest-blast-radius edit — review it explicitly per migration discipline).

String fields (not Prisma enums) so the migration is a single idempotent
`CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`, no `CREATE TYPE` —
satisfies the phase5e non-idempotent-DDL check.

## Behavior
1. On vendor claim (extend Phase 2): besides auto-assigning DOMAIN matches,
   insert `ProductClaimCandidate(matchType:"BRAND", status:"PENDING")` for
   unclaimed products whose brand == org name (case-insensitive) and whose
   domain did NOT already match. (DOMAIN matches stay auto-assigned; optionally
   recorded as CONFIRMED rows for audit.)
2. Review queue route (vendor-scoped): list PENDING candidates for my org, each
   with product fields + tag-usage summary (count + distinct designers).
3. Actions:
   - Confirm → `status:"CONFIRMED"`, set `Product.vendorId = me`, stamp
     reviewedBy/At.
   - Reject → `status:"REJECTED"` (stays unclaimed, won't resurface).
   - Correct → existing PUT /api/products/[id] (vendor owns it post-confirm).
4. UI: wire the existing `/admin/products` mock OR a vendor dashboard surface
   to the queue route. (Decide placement at build time.)

## Explicitly deferred (NOT in this phase)
- Per-field provenance (`ProductFieldEdit` log of who set each value). "Who
  tagged" already lives in ProjectProductTag; field-level audit is a later add.
- Unique index on normalized product.url (separate gated migration).

## Migration steps (Folio discipline — only after approval)
1. `cp prisma/schema.prisma /tmp/schema-prisma-backup-phase3.prisma`.
2. Author the idempotent `CREATE TABLE`/`CREATE INDEX` migration; print to chat.
3. Add the model + inverse relations to schema.prisma (User block reviewed).
4. format → validate → generate; apply → resolve → `migrate status`.
5. If any step fails: restore from backup and stop.
6. Then build the route + UI + the claim-flow candidate generation; commit.
