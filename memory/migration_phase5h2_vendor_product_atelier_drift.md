---
name: Vendor ↔ Product & Vendor ↔ Atelier relation drift (Phase 5H2 discovery)
description: Pulled schema implied vendors.products relation, but real schema has Product.vendor → User. AtelierFingerprint/AtelierSignal have vendorId String? scalars with no Prisma relation. Both deferred to future phase — Vendor model in 5H2 intentionally omits these inverses.
type: project
---

# Vendor ↔ Product & Vendor ↔ Atelier structural drift

## Decision

During Phase 5H2 Bucket B restoration, `prisma db pull` surfaced inverse fields on the `vendors` table model that do not reconcile cleanly with existing real-schema declarations:

1. **`products Product[]` inverse:** pulled schema implies `products.vendorId → vendors.id`. But real schema declares `Product.vendor User? @relation("VendorProducts", fields: [vendorId], references: [id])` — `Product.vendorId` is wired to `users.id`, following a historical vendor-as-user-role pattern (vendor users in the User table with a role flag).
2. **`atelier_fingerprint atelier_fingerprint[]` and `atelier_signal atelier_signal[]`:** pulled as inverse relations from vendors to lowercase snake_case atelier models. Real schema has PascalCase `AtelierFingerprint` and `AtelierSignal` (both with `@@map` to the same tables), but both declare only `vendorId String?` scalars with **no Prisma `@relation` fields** on either side.

**Phase 5H2 dropped all three inverse fields from the restored `Vendor` model** and left scalar columns untouched. Prisma Client cannot traverse Vendor↔Product or Vendor↔Atelier relations; app code that does `prisma.vendor.findMany({ include: { products: true } })` will not compile, and raw FKs in the DB continue to work.

**Why:** we don't know prod's actual FK constraint direction for `products.vendorId` without querying `information_schema.table_constraints` — it could point at either `users.id` or `vendors.id`. Declaring the relation wrong would cause Prisma Client to issue queries that fail at the DB layer. For atelier, adding relations would require editing `AtelierFingerprint` and `AtelierSignal` model declarations — scope creep beyond Bucket B restoration.

**How to apply:**
- If a future feature needs `Vendor.products` traversal: first query `SELECT confrelid::regclass FROM pg_constraint WHERE conname LIKE 'products_vendorId_fkey%'` against prod. If the FK points at `vendors`, fix `Product.vendor` in schema.prisma to point at `Vendor` instead of `User` (breaking change for call sites that rely on User-side vendor access). If it points at `users`, remove the misleading prod column or the app code assumption.
- If Vendor↔Atelier relations are needed: declare `vendor Vendor? @relation(fields: [vendorId], references: [id])` on both `AtelierFingerprint` and `AtelierSignal`, plus matching inverses on `Vendor`. Minor edits, ~4 new relation fields total.
- Neither is urgent. The DB layer continues to function; only Prisma Client traversal is impacted.
