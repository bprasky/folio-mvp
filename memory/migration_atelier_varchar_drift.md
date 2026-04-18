---
name: atelier_fingerprints designerId/vendorId are VARCHAR not TEXT
description: Potential shadow-DB drift — designerId and vendorId columns on atelier_fingerprints and atelier_signals are VARCHAR in prod while other id columns are TEXT; flag for review
type: project
originSessionId: f64d0e6e-708a-4b36-9718-25c639f06dcb
---
On prod, `atelier_fingerprints.designerId`, `atelier_fingerprints.vendorId`, `atelier_signals.designerId`, and `atelier_signals.vendorId` are `VARCHAR` (no length specifier). Everywhere else in the schema, id columns are `TEXT`. The `20251202042801_add_atelier_models` stub preserves this as-is to match prod.

**Why:** Likely an artifact of the original hand-written SQL for `add_atelier_models` — someone used VARCHAR instead of TEXT. Probably harmless functionally (Postgres VARCHAR without length is equivalent to TEXT) but Prisma's migrate-dev against a shadow DB may flag this as drift against schema.prisma, since Prisma generates TEXT for `String` fields.

**How to apply:** If Phase 5 `migrate dev` shows drift for these specific columns, the fix is either (a) normalize prod to TEXT with a separate ALTER migration, or (b) mark the fields as `@db.VarChar` in schema.prisma to match prod. Option (a) is preferred for consistency; option (b) if we want zero-risk. Do not change the stub to pretend it was TEXT — that would break the "stub matches prod" invariant.
