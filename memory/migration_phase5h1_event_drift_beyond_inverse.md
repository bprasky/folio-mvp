---
name: Event model has 4 prod columns not declared in schema.prisma
description: Phase 5H1 surfaced drift on the Event model — prod table has hostProfileId, organization_id, organizations relation, and visibility columns absent from schema.prisma. Only hostProfileId was declared in 5H1 (required for the EventHostProfile relation to validate). Other 3 deferred.
type: project
---

# Event model drift beyond inverse fields (Phase 5H1)

## Decision

Phase 5H1's `prisma db pull` surfaced that the `events` table in prod has **4 columns not declared** in the real `schema.prisma`'s `model Event`:

1. `hostProfileId` — FK to `event_host_profiles(id)`
2. `organization_id` — raw snake_case scalar (likely FK to organizations table)
3. `organizations` — introspected relation field back to the Organization model
4. `visibility` — scalar column (type unknown without reading prod further)

**Phase 5H1 declared only `hostProfileId` and its relation**, because that declaration was strictly required to make the approved `Event.hostProfile EventHostProfile?` inverse field validate — Prisma requires the FK scalar to be present alongside any `@relation(fields: [...])` declaration.

The other 3 (`organization_id`, `organizations`, `visibility`) were **intentionally not declared** in 5H1 — they're unrelated to the Bucket A restoration mandate and would expand scope past the approved plan.

**Why:** sticking to 5H1's scope ("unblock the 22 Bucket A models' call sites") avoids turning a focused restoration into an open-ended Event-model reconciliation. Also: we don't know the intended shape of `organization_id`/`organizations`/`visibility` without reading prod's actual column types, and declaring them wrong could cause `prisma migrate diff` to propose DDL changes that break migrate status.

**How to apply:**
- If future Event-related work (admin tooling, org-scoped event feed, event visibility filters) needs these columns through Prisma, declare them via the same pattern: `prisma db pull` into a scratch file, lift the relevant Event field declarations, merge into real schema.
- Before declaring any of them, verify the exact prod column type via `information_schema.columns` — don't guess.
- For `organization_id` + `organizations` specifically: check whether the relation should reference the existing `Organization` model, and whether the FK should be nullable (most likely yes, given some events won't be org-scoped).
- `visibility` is probably an enum — check `information_schema.columns.udt_name` and `information_schema.enum_range` before declaring.
- After declaring, run `prisma migrate status` to confirm no drift.

Not urgent. Event continues to function at the DB layer with these columns — just not queryable through Prisma Client for the affected fields.
