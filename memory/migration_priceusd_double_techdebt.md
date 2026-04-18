---
name: event_invite_lists.priceUsd should be DECIMAL(10,2) not DOUBLE PRECISION
description: Tech debt — currency column priceUsd is DOUBLE PRECISION in prod; should eventually migrate to DECIMAL for exact money arithmetic
type: project
originSessionId: f64d0e6e-708a-4b36-9718-25c639f06dcb
---
`event_invite_lists.priceUsd` is `DOUBLE PRECISION` in prod (preserved in the `20251202043216_add_events_engine_models` stub). Floating-point is the wrong type for money — it accumulates rounding error and violates "never use float for currency" convention.

**Why:** The original forged migration used DOUBLE PRECISION. The Phase 2 stub had to match prod exactly, so we can't fix it there without introducing drift. This is a genuine data-model mistake that should be corrected with a dedicated migration.

**How to apply:** Do NOT change the stub. During Phase 5 hardening (or whenever this feature ships paid invite lists), author a separate migration that `ALTER COLUMN priceUsd TYPE DECIMAL(10,2) USING priceUsd::DECIMAL(10,2)`. Confirm no existing rows have precision loss before migrating. Update schema.prisma to use `Decimal @db.Decimal(10, 2)`.
