---
name: Atelier stub overlaps with presale_infrastructure
description: 20251202042801_add_atelier_models stub intentionally includes version+snapshot columns that are technically added later by 20260119_presale_infrastructure; flag for Phase 5 documentation
type: project
originSessionId: f64d0e6e-708a-4b36-9718-25c639f06dcb
---
The `20251202042801_add_atelier_models` stub's `atelier_fingerprints` table definition includes `version INTEGER DEFAULT 1` and `snapshot JSONB` columns. Strictly speaking, those two columns were first added by `20260119_presale_infrastructure` (which runs `ALTER TABLE "atelier_fingerprints" ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1; ADD COLUMN IF NOT EXISTS snapshot JSONB;`). The atelier stub redundantly creates them so that a fresh-DB replay ends up with the same schema regardless of which migration ran first.

**Why:** Phase 2 stubs were authored from prod introspection, not from the original forged SQL. Current prod has version+snapshot on atelier_fingerprints (because presale_infrastructure ran). Including them in the atelier stub guarantees replay correctness on fresh DBs without requiring migrations to be strictly ordered. Presale's `ADD COLUMN IF NOT EXISTS` makes the overlap a no-op on prod.

**How to apply:** Document this pattern during Phase 5 hardening so future engineers don't "clean up" the apparent redundancy. When authoring stubs from prod introspection for any migration whose schema was later extended by a downstream migration, prefer replay-correctness over temporal fidelity — and leave a comment in the stub's migration.sql (already present in this one) explaining why.
