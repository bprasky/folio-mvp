# Missing Scripts Audit

**Date:** 2026-09-03
**Scope:** read-only. No file created, no `package.json` edit, no deletion.
**Predecessor:** `docs/audits/PULLQUOTE_PROVENANCE_AUDIT.md` finding 4.

39 files referenced by 46 npm scripts do not exist and were never committed. This audit sorts
them into what gets written, what comes out of `package.json`, and what cannot be decided from
evidence in the repo.

## Summary

| Bucket | Count | Files |
|---|---|---|
| **WRITE** | **4** | `guard-client-imports.js`, `guard-migrations.ts`, `backup-db.ts`, `verify-prisma-sync.ts` |
| **DELETE** | **30** | see §3 |
| **UNCERTAIN** | **5** | `db-check.ts`, `check-env.ts`, `diag.mjs`, `seed-minimal.ts`, `create-demo-user.ts` |

Three results drove the shape of this:

1. **Two of the six "migration safety scripts" are already built, under different names.**
   `scripts/apply-migration-file.mjs` does what `migrate:apply-sql` promised, and
   `scripts/lib/migrationConnection.mjs` enforces what `migrate:direct` promised — for *every*
   script that imports it, not just one. Writing `apply-migration-sql.ts` and
   `migrate-with-direct.ts` would duplicate working tools. Neither existing tool has an npm entry.

2. **`guard:client-imports` is the strongest WRITE case in the set**, and it is not a migration
   script. Two agent definitions name it as a standing gate, one calls it "the canonical rule set,"
   and one requires reporting its pass/fail in every output. That is eight references outside
   `package.json` — more than every other missing file combined.

3. **The absence has not yet caused the damage it was meant to prevent.** A direct sweep for the
   three violation classes `guard-client-imports.js` exists to catch found **zero** real
   violations. That lowers the urgency; it does not change the classification, because nothing
   else in the repo checks for them.

---

## 1. The full inventory

Reference counts exclude `package.json`, `package-lock.json`, and this audit's own predecessor
(`PULLQUOTE_PROVENANCE_AUDIT.md`), which names most of these files and is not independent evidence.

| # | Missing file | npm script(s) | Other references |
|---|---|---|---|
| 1 | `scripts/guard-client-imports.js` | `guard:client-imports` | **`.claude/agents/folio-next-supabase-specialist.md:3,14,27,49,63,79`** (description, required reading, non-negotiable rule, workflow step, output field); **`.claude/agents/folio-code-reviewer.md:39`**; `tasks/todo.md:1552` |
| 2 | `scripts/guard-migrations.ts` | `db:guard` | `.claude/agents/folio-prisma-guardian.md:19` (non-negotiable rule 1) |
| 3 | `scripts/backup-db.ts` | `db:backup` | `.claude/agents/folio-prisma-guardian.md:19` |
| 4 | `scripts/verify-prisma-sync.ts` | `verify:prisma` | `.claude/agents/folio-prisma-guardian.md:25,34`; `.claude/agents/folio-debugger.md:24,25` |
| 5 | `scripts/db-check.ts` | `db:check` | `.claude/agents/folio-prisma-guardian.md:25,34`; `.claude/agents/folio-debugger.md:25` |
| 6 | `scripts/apply-migration-sql.ts` | `migrate:apply-sql` | none |
| 7 | `scripts/migrate-with-direct.ts` | `migrate:direct` | none |
| 8 | `scripts/check-env.ts` | `check-env` | `.claude/agents/folio-debugger.md:30` |
| 9 | `scripts/diag.mjs` | `diag` | `.claude/agents/folio-debugger.md:30,34` |
| 10 | `scripts/seed-minimal.ts` | `seed:min` | `.claude/agents/folio-test-scaffolder.md:21,37` |
| 11 | `scripts/create-demo-user.ts` | `create:demo` | `.claude/agents/folio-test-scaffolder.md:21,37` |
| 12 | `scripts/auth-detect.ts` | `auth:detect` | `.claude/agents/folio-next-supabase-specialist.md:64`; `.claude/agents/folio-debugger.md:27` |
| 13 | `scripts/test-supabase-service-key.mjs` | `test:service-key` | `.claude/agents/folio-debugger.md:27` |
| 14 | `scripts/clean-prisma-cache.js` | `clean:cache`, `prisma:reset`, `dev:fresh` | `.claude/agents/folio-debugger.md:24` (via `prisma:reset`) |
| 15 | `scripts/fix-null-array-fields.ts` | `fix:null-arrays` | `.claude/agents/folio-debugger.md:26` |
| 16 | `scripts/fix-null-array-elements.ts` | `fix:null-elements` | `.claude/agents/folio-debugger.md:26` |
| 17 | `scripts/audit-dashboard.ts` | `audit:dash`, `audit:dash:json`, `check:audit` | `.claude/agents/folio-debugger.md:28` |
| 18 | `scripts/audit-product.mjs` | `audit:product`, `audit:product:rove` | `.claude/agents/folio-debugger.md:29` |
| 19 | `scripts/audit-events.mjs` | `audit:events` | `.claude/agents/folio-debugger.md:32` |
| 20 | `scripts/lighthouse-test.mjs` | `test:lighthouse` | `.claude/agents/folio-test-scaffolder.md:14,27` |
| 21 | `scripts/readonly-guard.js` | `audit:dash`, `audit:dash:json`, `audit:smoke`, `check:audit` (as `NODE_OPTIONS -r` preload) | **none** |
| 22 | `scripts/readonly-smoke.js` | `audit:smoke` | none |
| 23 | `scripts/backfill-moment-index-fields.ts` | `backfill:moments:fields` | `prisma/migrations/add_searchable_fields_to_moment_index.sql:89` |
| 24 | `scripts/backfill-moment-index.ts` | `backfill:moments`, `backfill:moments:dry`, `backfill:moments:skip-existing` | none |
| 25 | `scripts/check-and-fix-moment-index-schema.ts` | `check:schema` | none |
| 26 | `scripts/backfill-image-classification.ts` | `backfill:classification` | none |
| 27 | `scripts/export-verification-training-data.ts` | `export:training-data` | none |
| 28 | `scripts/check-vendors.mjs` | `check:vendors` | none |
| 29 | `scripts/create-vendor.mjs` | `create:vendor`, `create:vendor:rove` | none |
| 30 | `scripts/create-test-product.mjs` | `create:test-product` | none |
| 31 | `scripts/fix-image-urls.mjs` | `fix:imageurls` | none |
| 32 | `scripts/fix-tola-image.mjs` | `fix:tola` | none |
| 33 | `scripts/fix-null-combined-tags.ts` | `fix:null-tags` | none |
| 34 | `scripts/auth-detect-simple.js` | `auth:detect:simple` | none |
| 35 | `scripts/test-auth-endpoints.js` | `test:auth` | none |
| 36 | `scripts/test-search.ts` | `test:search` | none |
| 37 | `scripts/debug-prisma-types.ts` | `debug:prisma` | none |
| 38 | `scripts/list-buckets.mjs` | `bucket:list` | none |
| 39 | `scripts/create-storage-bucket.mjs` | `bucket:create` | none |

**Reference-class distribution:** 1 file with 8 external references; 3 with 3–4; 12 with 1–2; **23
with none at all** outside the `package.json` line.

---

## 2. Intent, from evidence

Confident calls first. Each rests on the script line's own flags, its position in a chain, or prose
that describes behaviour rather than restating the name.

**`guard-client-imports.js`** — enforces the RSC/client import boundary. The evidence is unusually
complete: the specialist agent carries a four-row table of what each context may and may not import
(`folio-next-supabase-specialist.md:20-25`), says the script "enforces the most dangerous cases"
(`:27`), and lists the specific rules — no `@supabase/supabase-js` direct import in `src/app/**`, no
Prisma in a client component, service-role key only in `scripts/*` and server-only lib files
(`:50-51`, `:33`). `folio-code-reviewer.md:39` narrows to one case: "Supabase service-role key never
imported in client code". This is a specification, not a name.

**`guard-migrations.ts`** — a pre-apply gate. Its position is the specification: first link in all
three of `migrate:safe`, `migrate:create-only` and `migrate:deploy`. `folio-prisma-guardian.md:19`
states the rule it enforces — "Never run `prisma migrate dev` directly." §4 works out what it would
have to check.

**`backup-db.ts`** — a pre-migration snapshot. Position again: between the guard and `prisma migrate
dev` in `migrate:safe`, and absent from `migrate:create-only` (which writes no SQL to the database)
and from `migrate:deploy`. Present exactly where data can be lost.

**`verify-prisma-sync.ts`** — schema-vs-generated-client drift. Two independent uses agree:
`folio-prisma-guardian.md:25,34` pairs it with `db:check` after any schema edit, and
`folio-debugger.md:24` prescribes `prisma:reset` (regenerate the client) *then* `verify:prisma`
against the symptom "Prisma errors, type mismatches, `Unknown arg`" — which is the signature of a
client out of step with the schema. It verifies the client, not the database.

**`readonly-guard.js`** — a Node preload (`NODE_OPTIONS='-r ./scripts/readonly-guard.js'`) that makes
a process incapable of writing. Confirmed by `check:audit`, which brackets the audit run with
`git diff --quiet` and exits 3 with the message "Files changed during audit (read-only violation)".
Belt-and-braces around the same property.

**`audit-dashboard.ts`** — a read-only dashboard-data audit, `JSON=1` for machine output
(`audit:dash:json`), matched to the symptom "Dashboard data wrong" (`folio-debugger.md:28`).

**`audit-product.mjs`** — a single-product audit taking `AUDIT_NAME` and `AUDIT_VENDOR` env vars;
`audit:product:rove` pins them to "Terra Travertine Side Table" / "Rove Concepts". Symptom: "Product
page wrong / missing".

**`backfill-moment-index.ts`** — accepts `--dry-run` and `--skip-existing`, so it is an idempotent
batch writer over the moment index with a rehearsal mode.

**`backfill-moment-index-fields.ts`** — the only missing file named by a *migration*:
`prisma/migrations/add_searchable_fields_to_moment_index.sql:89` says "The actual backfill should be
done via a separate script (backfill-moment-index-fields.ts)". The SQL added the columns; this fills
them.

**`clean-prisma-cache.js`** — clears the generated-client cache. Composition proves it:
`prisma:reset = clean-prisma-cache && prisma generate`, `dev:fresh` adds `npm run dev`.

**`auth-detect.ts`** — auth configuration drift detection, per
`folio-next-supabase-specialist.md:64`: "run `npm run auth:detect` to catch config drift."

**`seed-minimal.ts` / `create-demo-user.ts`** — fixture data.
`folio-test-scaffolder.md:21,37` says they "exist so tests don't have to reinvent fixture data" and
recommends integration tests against a seeded dev Supabase. Note the agent asserts they exist; they
do not.

**Evidence does not support a confident answer for these**, and inferring from the name alone would
be guessing:

- **`db-check.ts`** — used in two different pairings: with `verify:prisma` after a schema edit
  (client-side concern) and against "Can't find column / migration drift" (database-side concern).
  Connectivity probe, schema comparison, and migration-state reader are all consistent with what is
  written. §3 says what would settle it.
- **`check-env.ts`** and **`diag.mjs`** — paired for "Is my env set up?", and `diag` is also the
  blanket first step ("run `npm run diag` first as a sanity check"). Which does what, and whether
  they overlap, is not recoverable.
- **`test-search.ts`**, **`debug-prisma-types.ts`**, **`test-auth-endpoints.js`**,
  **`auth-detect-simple.js`**, **`readonly-smoke.js`**, **`check-vendors.mjs`**,
  **`check-and-fix-moment-index-schema.ts`**, **`export-verification-training-data.ts`**,
  **`list-buckets.mjs`**, **`create-storage-bucket.mjs`**, **`fix-image-urls.mjs`**,
  **`test-supabase-service-key.mjs`**, **`lighthouse-test.mjs`** — the npm line restates the
  filename and nothing else describes them. `auth-detect-simple.js` is presumably a reduced
  `auth-detect.ts`; that is an inference from the name and is not evidence.
- **`fix-tola-image.mjs`** — "tola" appears nowhere else in the repository. A one-off fix for a
  record that may no longer exist.
- **`fix-null-array-fields.ts` / `fix-null-array-elements.ts` / `fix-null-combined-tags.ts`** — data
  repairs for null-vs-empty-array states. `folio-debugger.md:26` offers the first two
  interchangeably ("`fix:null-arrays` or `fix:null-elements`") without saying how they differ.

---

## 3. Classification

### WRITE — 4

Something real depends on it, and the dependency is not another dead script.

| File | Why WRITE |
|---|---|
| **`scripts/guard-client-imports.js`** | Eight references across three files. Two agent definitions require running it as a non-negotiable step; the specialist's required output format has a `guard:client-imports: <passed / failed>` field, so every run of that agent either reports a result it cannot have obtained or silently omits it. `folio-next-supabase-specialist.md:14` calls it "the canonical rule set for what can be imported where" and instructs the agent to read it first — a rule set that does not exist. **Nothing else in the repo covers it** (§5). |
| **`scripts/guard-migrations.ts`** | First link in all three migration chains. While absent, `migrate:safe`, `migrate:create-only` and `migrate:deploy` all fail before touching Prisma, leaving only the unguarded `migrate:create`. Writing this one file revives three chains (§6). The pre-apply half of the migration discipline has no other home (§4). |
| **`scripts/backup-db.ts`** | Second link in `migrate:safe`, the only chain that applies destructive SQL. Writing `guard-migrations.ts` alone leaves `migrate:safe` dead; these two are the pair. |
| **`scripts/verify-prisma-sync.ts`** | Four references across two agents, prescribed after every schema edit and as the second step of the standard Prisma-error recovery. Partially covered but not replaced: `scripts/schema-parity-audit.mjs` compares `schema.prisma` against the **live database**, which is a different question from schema against the **generated client** — and it needs a live `DIRECT_URL`, so it cannot answer "is my local client stale". |

**Deliberately not padded.** `db:backup` earns WRITE only because `migrate:safe` is a chain worth
reviving. If the decision were to drop `migrate:safe` and keep `migrate:create-only` +
`migrate:deploy`, `backup-db.ts` moves to DELETE and one file revives both survivors.

### DELETE — 30

The `package.json` line comes out. Grouped by why.

**Superseded by a tool that already exists (2).** Writing these would duplicate working code.

| File | Superseded by |
|---|---|
| `scripts/apply-migration-sql.ts` (`migrate:apply-sql`) | **`scripts/apply-migration-file.mjs`** — applies a hand-authored `.sql` over `DIRECT_URL` via `migrationConnectionUrl`, splitting statements while respecting `DO $$` blocks and comments. Exactly the described job, already built, with no npm entry. |
| `scripts/migrate-with-direct.ts` (`migrate:direct`) | **`scripts/lib/migrationConnection.mjs`** — enforces the direct-vs-pooled rule for every script that imports it (7 do), and `scripts/check-migration-connection.ts` asserts its exit-code contract in CI-runnable form. A per-command wrapper would cover one caller where the library covers all of them. |

**Dead chain — the only thing referencing it is another missing script (2).**

| File | Chain |
|---|---|
| `scripts/readonly-guard.js` | Preload for `audit:dash`, `audit:dash:json`, `check:audit` (all → missing `audit-dashboard.ts`) and `audit:smoke` (→ missing `readonly-smoke.js`). **Every consumer is itself dead.** Zero references anywhere outside `package.json`. |
| `scripts/readonly-smoke.js` | `audit:smoke` is its only caller, and that line also needs `readonly-guard.js`. Two missing files, one dead chain, no external reference. |

**One-off data repair, target unknown or gone (7).** `fix-tola-image.mjs` (subject appears nowhere
else in the repo), `fix-image-urls.mjs`, `fix-null-combined-tags.ts`, `fix-null-array-fields.ts`,
`fix-null-array-elements.ts`, `backfill-image-classification.ts`, `check-and-fix-moment-index-schema.ts`.
A backfill is written against a specific data state; re-authoring one years later without knowing
the rows it was for produces a script nobody can safely run. `fix:null-arrays` / `fix:null-elements`
are named in `folio-debugger.md:26` — a symptom-to-command table entry, not a dependency.

**Moment-index group (2).** `backfill-moment-index.ts`, `backfill-moment-index-fields.ts`. The
second is named by `prisma/migrations/add_searchable_fields_to_moment_index.sql:89` — the strongest
non-agent reference in the set, and still a *comment in a migration* describing work to be done, not
a caller. DELETE with a caveat: **if the searchable columns that migration added are still null in
production, the backfill is unfinished work, not a dead script.** That is a data question, not a
code question; §7 says what to run.

**Fixture/dev utility, superseded by the working seed path (2).** `create-vendor.mjs`,
`create-test-product.mjs`. `prisma.seed` is configured and `prisma/seed.js` exists, so `npm run
seed` and `npm run db:sync-and-seed` work today; neither of these has any reference outside its
`package.json` line. (`seed-minimal.ts` and `create-demo-user.ts` are the same shape but are named
by an agent definition, which puts them in UNCERTAIN rather than here.)

**Diagnostic with no dependency (14).** `audit-dashboard.ts`, `audit-product.mjs`,
`audit-events.mjs`, `check-vendors.mjs`, `test-search.ts`, `debug-prisma-types.ts`,
`test-auth-endpoints.js`, `auth-detect.ts`, `auth-detect-simple.js`,
`test-supabase-service-key.mjs`, `lighthouse-test.mjs`, `list-buckets.mjs`,
`create-storage-bucket.mjs`, `export-verification-training-data.ts`. Each is a convenience command. Several appear in
`folio-debugger.md`'s symptom table, which is a menu of suggestions, not a gate: the agent's own
fallback is "if none of these apply, fall back to reading the code." A menu entry pointing at
nothing costs one failed command, and the repo has 55 working scripts including
`scripts/diagnose-fix-ownership.ts` and eight `phase5*` probes.

`auth-detect.ts` is the closest call in this group. `folio-next-supabase-specialist.md:64` makes it
workflow step 6 — "for auth-adjacent changes … also run `npm run auth:detect` to catch config
drift" — which is a conditional suggestion, not the unconditional gate and mandatory output field
that put `guard:client-imports` in WRITE. If the intent is that auth config drift be checked on
every auth-adjacent edit rather than when someone remembers, it moves to WRITE.

**Prisma cache utility (1).** `clean-prisma-cache.js` — kills `clean:cache`, `prisma:reset` and
`dev:fresh`. `rm -rf node_modules/.prisma && npx prisma generate` is the whole job and the
`session-start` hook already runs `prisma generate` on every session.

### UNCERTAIN — 5

| File | What would settle it |
|---|---|
| `scripts/db-check.ts` | Whether it checks the client or the database. The two agent pairings point opposite ways. **Ask the author what it printed.** If it read the database, `scripts/schema-parity-audit.mjs` and `scripts/introspect-tables.mjs` already do that and it is DELETE; if it read the client, it belongs with `verify-prisma-sync.ts` and is WRITE. |
| `scripts/check-env.ts` | Whether it duplicates `diag.mjs`. Both answer "Is my env set up?" in the same table row. One of the two is redundant; the evidence does not say which. |
| `scripts/diag.mjs` | Same, plus: `folio-debugger.md:34` makes it the universal first step, which is a stronger claim than the symptom table. If that instruction is meant to stand, this is WRITE. |
| `scripts/seed-minimal.ts` | Whether a test suite is going to exist. `folio-test-scaffolder.md` is the only caller and it presupposes a runner the repo does not have. Decide the test story first; the script follows it. |
| `scripts/create-demo-user.ts` | Same as above; same decision. |

---

## 4. The migration group

### What the surviving chain expects of each

```
migrate:safe        = npm run db:guard && npm run db:backup && prisma migrate dev
migrate:create-only = npm run db:guard && prisma migrate dev --create-only
migrate:deploy      = npm run db:guard && prisma migrate deploy
migrate:create      = prisma migrate dev --create-only            ← no guard, only survivor
```

**`db:guard` → `scripts/guard-migrations.ts`.**
*Contract:* exit 0 to proceed, non-zero to abort — `&&` is the only mechanism. *Arguments:* none;
all three chains invoke it bare, so it must decide from the environment alone (`DATABASE_URL`,
`DIRECT_URL`, `NODE_ENV`) and the repository state. It cannot know which of the three chains
invoked it, so it must be safe as a precondition for a dev apply, a create-only, and a production
deploy alike — i.e. it can only assert things true before *any* of them. *Position:* before Prisma
opens a connection, so it is the last point at which an unsafe target or an unclean migration state
can be refused without partial application.

**`db:backup` → `scripts/backup-db.ts`.**
*Contract:* exit 0 to proceed. *Arguments:* none. *Position:* after the guard passes, before
`prisma migrate dev` — the only chain that applies destructive SQL to a database with data in it.
Absent from `migrate:create-only` (writes no SQL) and `migrate:deploy` (production, where a backup
is presumably infrastructure). Its position says it protects a **developer's** database.

**`migrate:direct` → `scripts/migrate-with-direct.ts`.** Not in any chain; a standalone entry point.
No exit-code contract is imposed on it by anything.

**`migrate:apply-sql` → `scripts/apply-migration-sql.ts`.** Not in any chain. Takes no arguments in
its npm line, so a path would arrive via `npm run migrate:apply-sql -- <path>`.

**`db:check` → `scripts/db-check.ts`** and **`verify:prisma` → `scripts/verify-prisma-sync.ts`.**
Neither is in a chain. Both are invoked *after* a schema edit by `folio-prisma-guardian.md:25,34`,
which states "Do not claim done until both pass" — an exit-code contract imposed by an agent
definition rather than by `package.json`.

### What the pre-apply half would need to enforce

`.github/workflows/migration-discipline.yml` runs `node scripts/phase5e-check-plan.mjs --ci` against
`.github/workflows/phase5e-baseline.json` (`{looseSql: 32, phantomCalls: 0, missingSql: 0,
nonIdempotent: 0}` — and `prisma/migrations/*.sql` is 32 today, so the baseline is current). It
covers four checks, all of them **repository-state** questions answerable from files alone:

| CI already covers | How |
|---|---|
| New loose `.sql` at `prisma/migrations/` root | Check 1, count vs baseline |
| `prisma.<model>` calls with no model in `schema.prisma` | Check 2, baseline 0 |
| Timestamped folders without `migration.sql` | Check 3, baseline 0 |
| `CREATE TABLE/INDEX/TYPE` without `IF NOT EXISTS`/`DO $$` in the last 20 migrations | Check 4, baseline 0 |

Every one of those is a property of the diff. **None of them requires a database.** That is the
line: CI checks what was written; only a pre-apply script can check what it is about to be written
*to*.

What only a pre-apply script can catch, drawn from CLAUDE.md's own runbook and from the drift the
Phase 1–5D history describes:

1. **Connection safety** — that DDL is not about to go through a transaction pooler. **Already
   solved**, in `scripts/lib/migrationConnection.mjs`: it refuses a transaction-pooled URL
   (port 6543, or `pgbouncer=true`) for write work, because transaction pooling voids `prisma
   migrate`'s advisory lock and can half-apply multi-statement DDL "reporting success while leaving
   the schema in a state nobody wrote down." `scripts/check-migration-connection.ts` asserts that
   contract in subprocesses. **But `prisma migrate dev` does not import that library** — it reads
   `DIRECT_URL`/`DATABASE_URL` from `schema.prisma` itself. So the protection exists for the
   repo's own scripts and *not* for the three chains a `db:guard` sits in front of. This is the
   single clearest thing `guard-migrations.ts` should do, and the logic is already written: call
   `migrationConnectionUrl({ label: 'migrate', readOnly: false })` and exit non-zero if it throws.
2. **Bookkeeping state** — `prisma migrate status` clean before starting. CLAUDE.md's session
   discipline opens with it ("Re-run `prisma migrate status` after sync to confirm the merge didn't
   introduce drift") and its runbook is built on the three-way check *declared in `schema.prisma` /
   exists in prod / recorded in `_prisma_migrations`*. Only the first of those three is visible to
   CI.
3. **Target identity** — that the URL about to be migrated is the one the operator intended.
   Nothing in the repo checks this. It is the difference between a dev apply and an accident.
4. **Environment sanity** — `DIRECT_URL` present when required, rather than silently falling back.

Checks 1, 2 and 4 are all answerable from the environment with no arguments, which fits the bare
invocation all three chains use. Check 3 needs operator input and probably does not belong in a
non-interactive gate.

**Relevance to C1 stage two.** The provenance audit's recommendation lands on
`galleryChapters[].pullQuote` — a `Json` column, so the pointer is additive within existing JSON and
may need no migration at all. If it does need one (a `TranscriptWord` table is already flagged as a
future promotion in `EditorialInterviewAnswer.wordTimings`' comment), the apply path today is
`migrate:create` (unguarded) plus the existing `apply-migration-file.mjs` (guarded, but with no npm
entry and no `migrate status` precondition). That is workable and it is not the discipline CLAUDE.md
describes.

---

## 5. `guard:client-imports`

### What it was meant to guard

Three rules, stated in the agent definitions rather than inferable from the name:

1. **No `@supabase/supabase-js` imported directly under `src/app/**`** — go through the factory in
   `src/lib/supabase/` (`folio-next-supabase-specialist.md:50`).
2. **No Prisma imported from a client component** — fetch in the server parent, pass as props
   (`:51`).
3. **Service-role key only in `scripts/*.mjs`, `scripts/*.ts` and server-only lib files; never in
   `src/app/`, route handlers, or client code** (`:33`). `folio-code-reviewer.md:39` isolates this
   one as its own review item.

### Is it covered by anything else? No.

- **ESLint** (`.eslintrc.json`) extends `next/core-web-vitals` and adds three rules —
  `react/no-unescaped-entities`, `react/jsx-no-comment-textnodes`,
  `react-hooks/rules-of-hooks`. **No import-boundary rule, no `no-restricted-imports`.**
- **No check script covers it.** A grep across `scripts/*.ts` and `scripts/*.mjs` for `use client`,
  `@supabase/supabase-js` or `SERVICE_ROLE` returns nothing.
- **The `server-only` package is not installed.** `src/lib/auth/getSigninHero.ts:1` imports
  `'server-only'`, `node_modules/server-only` is absent, and the package is in neither
  `dependencies` nor `devDependencies` — so the one file reaching for the ecosystem's standard
  mechanism is not actually protected by it. (`next build` passes, so the import is being resolved
  or elided somewhere; worth a look on its own, and outside this audit's scope.)
- **`next build` catches a subset** — a genuine runtime Prisma import in a client bundle fails the
  build. It does not catch the service-role rule, which is the one the code reviewer singles out.

### What has been unguarded — and what actually happened

Direct sweep of all three rules:

| Rule | Violations found |
|---|---|
| `@supabase/supabase-js` imported under `src/app/**` | **0 files** |
| `SERVICE_ROLE` referenced under `src/app/**` | **0 files** |
| Runtime `@/lib/prisma` import in a `"use client"` file | **0 files** |

**The absence has not produced the damage it was meant to prevent.** Four client components import
from `@prisma/client`:

```
src/components/project/ProjectMediaHub.tsx:4   import type { ProjectModule } from "@prisma/client";
src/components/vendor/BoostReviewPanel.tsx:6   import type { Product } from '@prisma/client';
src/app/projects/ProjectsGridView.tsx:3        import { Project } from '@prisma/client';
src/app/projects/ProjectsKanbanBoard.tsx:3     import { Project } from '@prisma/client';
```

The first two are explicit `import type` and are erased. The last two import a type in value
position — inert today because the compiler elides an import used only as a type, and a hazard
precisely because that inertness is incidental: adding one value import from `@prisma/client` to
either file pulls the client into a browser bundle. **This is the exact shape a guard would flag,
and it is the only shape present.**

So: the rule set is clean, and nothing is keeping it clean. Every clean result above was produced by
this audit, not by anything that runs.

---

## 6. Chains and ordering

### Chains broken by a missing link

```
migrate:safe        →  db:guard ✗  &&  db:backup ✗  &&  prisma migrate dev ✓
                       ^^^^^^^^ breaks here, first link

migrate:create-only →  db:guard ✗  &&  prisma migrate dev --create-only ✓
                       ^^^^^^^^ breaks here, first link

migrate:deploy      →  db:guard ✗  &&  prisma migrate deploy ✓
                       ^^^^^^^^ breaks here, first link

migrate:create      →  prisma migrate dev --create-only ✓        ← intact, unguarded

prisma:reset        →  clean-prisma-cache.js ✗  &&  prisma generate ✓
                       ^^^^^^^^^^^^^^^^^^^^^ first link

dev:fresh           →  clean-prisma-cache.js ✗  &&  prisma generate ✓  &&  npm run dev ✓
                       ^^^^^^^^^^^^^^^^^^^^^ first link

check:audit         →  git diff --quiet ✓ ; NODE_OPTIONS=-r readonly-guard.js ✗ ts-node audit-dashboard.ts ✗ ; git diff ✓
                       both the preload and the target are missing

audit:dash          →  NODE_OPTIONS=-r readonly-guard.js ✗  ts-node audit-dashboard.ts ✗
audit:dash:json     →  NODE_OPTIONS=-r readonly-guard.js ✗  JSON=1 ts-node audit-dashboard.ts ✗
audit:smoke         →  NODE_OPTIONS=-r readonly-guard.js ✗  node readonly-smoke.js ✗

db:sync-and-seed    →  schema:push ✓  &&  seed ✓                 ← intact
```

### Revived by writing one file

| Write | Revives |
|---|---|
| `guard-migrations.ts` | **`migrate:create-only`** and **`migrate:deploy`** — two chains, one file. Both have `db:guard` as their only missing link. |
| `clean-prisma-cache.js` | `prisma:reset` and `dev:fresh` — two chains, one file. (Classified DELETE; noted because the arithmetic is favourable if the decision goes the other way.) |

### Needs several

| Chain | Needs |
|---|---|
| `migrate:safe` | **2** — `guard-migrations.ts` + `backup-db.ts` |
| `audit:dash`, `audit:dash:json` | **2** — `readonly-guard.js` + `audit-dashboard.ts` |
| `audit:smoke` | **2** — `readonly-guard.js` + `readonly-smoke.js` |
| `check:audit` | **2** — `readonly-guard.js` + `audit-dashboard.ts` (shares both with `audit:dash`) |

### Dead at the first link with no callers

**Every one of the four `audit:*` / `check:audit` chains.** `readonly-guard.js` is required by all
four, has **zero references anywhere outside `package.json`**, and each of its consumers is itself
missing. Reviving the group costs three files to restore commands nothing invokes; `audit:dash` and
`audit:product` appear only in `folio-debugger.md`'s suggestion table, whose own fallback is to read
the code instead.

`migrate:direct` and `migrate:apply-sql` are not chains — single commands, no callers, and both
superseded (§3).

---

## 7. Risk of the absence — WRITE set only

**`guard-client-imports.js`.** *Unenforced:* the entire RSC/client import boundary, for as long as
the repo has existed. Nothing else checks any of its three rules (§5). *Evidence of the damage:*
**none for the two security-adjacent rules** — zero direct `@supabase/supabase-js` imports and zero
`SERVICE_ROLE` references under `src/app/`. For the third, four client components import from
`@prisma/client`, two of them without `import type`; all four are inert today. The rule set is
clean and unpoliced. A second-order effect is measurable: `folio-next-supabase-specialist.md:79`
requires a `guard:client-imports: <passed / failed>` line in every report that agent produces, so
that field has been unanswerable on every invocation.

**`guard-migrations.ts`.** *Unenforced:* every pre-apply check. In its absence the only working
apply path is `migrate:create`, which the guardian agent's first non-negotiable rule tells the
operator never to use — so the documented procedure and the working procedure have been in direct
contradiction. *Evidence of the damage:* the repository is the evidence. CLAUDE.md's migration
discipline section exists because "Phase 1-5D spent weeks unwinding exactly these patterns," and
`migrationConnection.mjs` describes half-applied multi-statement DDL as "the shape of drift Phases
1-5D spent weeks unwinding." **32 grandfathered loose `.sql` files sit at `prisma/migrations/`
root** — the baseline calls them "historical bookkeeping," i.e. migrations applied outside
`prisma migrate`. That is what an unguarded apply path produces. Counter-evidence, and it matters:
the CI baseline reads `phantomCalls: 0, missingSql: 0, nonIdempotent: 0`, so the three drift classes
CI *can* see are all at zero right now, and the CI half has been holding since Phase 5E.

**`backup-db.ts`.** *Unenforced:* the pre-migration snapshot on the one chain that applies
destructive SQL. *Evidence of the damage:* **none found.** No incident report, no restore script, no
`.sql.gz`/dump artefact, nothing in `memory/` describing data loss. Partly because `migrate:safe`
has been dead the whole time — an operator following the documented path ran nothing at all, which
is a different failure from running an unbacked migration.

**`verify-prisma-sync.ts`.** *Unenforced:* schema-vs-client drift detection after a schema edit.
*Evidence of the damage:* indirect but real. The provenance audit measured **1008 pre-existing
TypeScript errors**, a large share of them exactly the `Unknown arg` / "Property X does not exist on
type" shape `folio-debugger.md:24` prescribes this script for — e.g.
`src/lib/spend/resolveCollaboration.ts:30` (`'collaborationStatus' does not exist in type
'ProjectParticipantWhereInput'`), `src/lib/server/repUtils.ts:16` (`Property 'workEmail' does not
exist`). Those are the signature of code written against a schema the generated client does not
have. Whether a working `verify:prisma` would have caught them at the time, or whether they are
intentional drift awaiting a migration, **cannot be determined without running it** — which is the
point.

### What I would run, and what it would tell us

Everything below needs a live `DATABASE_URL`/`DIRECT_URL`; none is available in this environment.

| Command | Answers |
|---|---|
| `npx prisma migrate status` | Whether `_prisma_migrations` is currently clean. Settles whether `guard-migrations.ts` would be writing into a healthy state or a drifted one, and gives it its first concrete check. |
| `node --env-file=.env.local scripts/schema-parity-audit.mjs` | Every model/enum in `schema.prisma` missing from prod and vice versa. Read-only, already written. Would tell us how much of `db-check.ts`'s job is already done — the UNCERTAIN call in §3. |
| `SELECT count(*) FROM moment_index WHERE <searchable column> IS NULL;` (columns per `prisma/migrations/add_searchable_fields_to_moment_index.sql`) | Whether `backfill-moment-index-fields.ts` is unfinished work or a dead script. The one DELETE call in §3 that turns on live data. |
| `npx tsc --noEmit` diffed against the 1008-error baseline, per file | Which of those errors are schema-vs-client drift and which are genuine type bugs. Scopes what `verify-prisma-sync.ts` would have to report to be useful. |

---

## Appendix — method

- Inventory generated from `package.json` by regex over each script line for
  `scripts/…|src/scripts/…|prisma/…` paths, then `fs.existsSync`. 83 scripts reference a repo file;
  46 reference at least one missing one; 39 distinct files.
- Reference search run twice over the whole tree (excluding `node_modules`, `.next`, `.git`): once
  by basename, once by npm script name. `PULLQUOTE_PROVENANCE_AUDIT.md` excluded from counts as
  non-independent.
- Never-committed status is from the predecessor audit (`git log --all --diff-filter=A` per file,
  no add commit for any; `.gitignore` does not cover `scripts/`). Not re-run here.
- Violation sweeps in §5 and §7 are greps over `src/`, reported as counts with the matching lines.
- No script was executed against a database. `npm run db:guard` and `npm run check:vendors` were
  run in the predecessor audit and failed with `MODULE_NOT_FOUND`.
