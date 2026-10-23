# Development guide

## Prerequisites

- Node.js 22 and npm. The checked-in GitHub Actions workflows currently use Node.js 20.
- Repository access; Folio is a private application repository.
- For the full application: a separate development PostgreSQL/Supabase environment, storage configuration, and the credentials needed by the features you enable.

The root `package-lock.json` is the dependency lockfile. Use npm and the installed Prisma CLI to keep versions aligned with it.

## Run the local regression suites

These commands do not require a production database or live AI credentials:

```sh
git clone https://github.com/bprasky/folio-mvp.git
cd folio-mvp
npm ci
npm exec -- prisma generate
npm run test:core
npm run test:guided
npm run guard:client-imports
node scripts/phase5e-check-plan.mjs --ci
```

Prisma client generation reads the schema and generates local code; it does not apply migrations. The core suite replaces service credentials and uses synthetic fixtures by default. Live database cases are skipped unless deliberately configured. See [core regression journeys](CORE_REGRESSION_JOURNEYS.md) for the mocked boundaries and the optional database runner.

## Configure the application

Copy the template into a git-ignored `.env` file at the repository root. Both Next.js and the Prisma CLI can read that file:

```sh
# macOS / Linux / Git Bash
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Next.js also loads `.env.local`; if you use that existing convention, make sure standalone Prisma commands receive the same database variables through their environment or `.env`. Keep credentials out of tracked files and screenshots.

| Configuration | Purpose |
| --- | --- |
| `DATABASE_URL` | Application PostgreSQL connection; use the transaction pooler for serverless Supabase runtime connections |
| `DIRECT_URL` | Direct/session connection for database administration and migration tooling |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Session configuration; use a generated local secret and `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-accessible Supabase project configuration |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase operations |
| `ANTHROPIC_API_KEY` | Interview and editorial model calls |
| `OPENAI_API_KEY` | Features using transcription or embeddings |

The template also includes optional integrations. Live avatar interviews have additional Tavus and reachable-callback requirements described in [LIVE_INTERVIEWS.md](LIVE_INTERVIEWS.md). Saved recordings and media exports require their own storage and worker setup. Those capabilities are not prerequisites for running the local regression suites.

**Database setup requires a development environment prepared for this schema.** The repository includes historical SQL and a project-specific migration process; it does not provide a verified, one-command fresh database bootstrap. Coordinate a development database with the maintainer and follow the [migration guide](../prisma/README.md). Do not point setup, seed, reset, or schema-push commands at production.

With the development services configured:

```sh
npm exec -- prisma generate
npm run dev
```

Open [localhost:3000](http://localhost:3000). Model-backed features make paid external API calls when used.

## Verification and current constraints

| Command | Purpose |
| --- | --- |
| `npm run test:core` | Synthetic application regression journeys |
| `npm run test:guided` | Interview prompts, controller, service, and provenance checks |
| `npm run guard:client-imports` | Server/client import boundary checks |
| `node scripts/phase5e-check-plan.mjs --ci` | Migration and Prisma delegate discipline |
| `npm run lint` | Next.js lint checks; CI also invokes ESLint directly |
| `npm run typecheck:prepare` then `npm run typecheck` | Generate types and check diagnostics against the existing baseline |
| `npm run build` | Next.js production build; full application configuration may be required |

`next.config.js` skips TypeScript and ESLint checks during the application build. CI runs them separately. The [TypeScript ratchet](TYPESCRIPT_RATCHET.md) tracks existing diagnostics and prevents expansion; a passing ratchet is not a zero-error typecheck. Existing lint warnings are also tracked separately from blocking errors.

Browser suites require a supported Chrome/Chromium installation. Database, live-model, recording, and worker checks have additional requirements in their respective guides. Read a script's setup instructions before running operational or live-service commands.

## Database migrations and the shadow database

Use the locally installed Prisma version from `package-lock.json`; do not install or invoke an unpinned replacement for this repository.

For migration development, the project provides a pgvector-enabled shadow PostgreSQL container on port 5433. Docker is optional unless you are doing this work:

```sh
npm run prisma:shadow:up
npm run prisma:status
npm run prisma:shadow:down
```

Set `SHADOW_DATABASE_URL=postgresql://shadow:shadow@localhost:5433/shadow` in your local environment. `prisma:status` reads the configured database's migration state. The shadow database is disposable; `npm run prisma:shadow:reset` deletes its local volume. Follow the [migration guide](../prisma/README.md) before creating or applying migrations.
