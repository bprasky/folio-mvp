# Product health — Phase 3 (governance) · DEFERRED to post-launch

Phases 1–2 shipped in PR #658 (graceful dedup + `assessProductHealth()` + live
flags in the dedup card / edit modal + scrape-time pre-flag + a non-blocking
`[product-health]` degradation log on PUT).

Phase 3 was scoped and **approved to build post-launch** (not now — premature at
solo-founder / pre-PMF volume). Build the three pieces below when there's real
multi-user editing volume. Each needs a small schema change, so follow the
migration discipline in CLAUDE.md (audit prod → idempotent migration → approve →
apply → resolve).

## 1. Admin review queue (foundation — build first)
Persist degrading/suspicious events instead of only logging them.

- **Schema:** new table `ProductHealthEvent` (timestamped folder, idempotent SQL):
  `id, productId (FK), userId (FK, the editor), kind ('IMPORT_FLAGGED' |
  'EDIT_DEGRADED'), scoreBefore Int?, scoreAfter Int, flags Json, resolvedAt
  DateTime?, resolvedById String?`. Index `productId`, `userId`, `(resolvedAt)`.
- **Write sites:** replace the two `console.warn('[product-health] …')` calls
  (PUT `/api/products/[id]` degradation; scrape-bql import flag) with a row insert
  (keep them non-blocking / try-catch).
- **Admin surface:** `/admin/product-health` mirroring the existing
  `/admin/editorial-review` queue — list unresolved events, show before/after
  flags + the product, "mark resolved". Gate on `session.user.role === 'ADMIN'`.

## 2. Revoke edit capability (needs the queue)
- **Schema:** `User.canEditProducts Boolean @default(true)` (additive, idempotent
  `ADD COLUMN IF NOT EXISTS … DEFAULT true`).
- **Enforce:** in PUT `/api/products/[id]` and the `?force=1` re-scrape route,
  reject with 403 when `!canEditProducts && !isAdmin && !isVendorOwner`. The
  tagger should hide the edit/refresh affordances when the capability is off
  (surface via session or a small `/api/me/capabilities` read).
- **Revoke UI:** a toggle on the admin product-health queue (and/or an admin user
  view) so an admin can revoke/restore per user. Record who/when.

## 3. Auto abuse heuristics (most speculative — build last, behind a flag)
- Trigger: N `EDIT_DEGRADED` events for a user within a rolling window
  (e.g. ≥3 in 24h) → auto-set `canEditProducts = false` AND open a high-priority
  admin event, OR (softer) just escalate/notify without auto-revoking.
- Keep thresholds in one config constant; default conservative; make the
  auto-revoke itself flag-gated so it can be turned off if it misfires.
- Always reversible by an admin (ties back to #2).

## Notes / open decisions for later
- "Persist health flags on the Product row (Json column)" was considered and NOT
  selected — admin filtering can run off `ProductHealthEvent` instead, avoiding a
  hot-path column. Revisit only if you want "show all currently-suspicious
  products" without scanning events.
- The health rules live in `src/lib/products/productHealth.ts` — tune
  thresholds/messages there; every surface reads from it.
