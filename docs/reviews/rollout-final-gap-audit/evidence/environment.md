# Isolated verification environment

The original environment and commands below describe the 26 October runs. The [release verification](release-verification.md) records the subsequent rebuild and final-code journey against merged `09f92c22`, including the refreshed disposable database.

Application tree: 70636d1f. Final test tree: 5c1d99a8. The final desktop/mobile runs use that committed tree; only documentation/evidence and generated test output were uncommitted. No application changes followed the final prepared build.

- Windows Node/Chrome, repository lockfile dependencies installed locally (`npm ci --ignore-scripts`, then `npx prisma generate`).
- Native PostgreSQL 18.6 and pgvector 0.8.1, plus Redis 8.4.2, in Alpine 3.23 at `/tmp/folio-rollout-root` in the existing WSL `docker-desktop` distribution. No Docker daemon was used.
- PostgreSQL listens on loopback 55440; Redis on loopback 55441. Database `folio_rollout_test`, role `folio_test`, contains synthetic fixtures only. The unused Windows PostgreSQL 17 installation was not used as evidence.
- Schema initialized from unchanged Prisma with `prisma db push --skip-generate` against that disposable URL. This is application behavior verification, not a migration replay.
- The test storage fixture serves real files and Supabase-compatible HTTP. The connected fixture's Upstash REST adapter calls native Redis via WSL/chroot; its host-specific invocation must be adapted on another OS.
- Next binds loopback 55141 and fixture HTTP binds 55142. The connected runner starts/stops its own Next process, gives it only fixture credentials, disables email and preloads a non-loopback network blocker. Browser uses real NextAuth credential exchange and production secure session cookies.
- Source photographic fixtures, generated story text, users, products and firms are synthetic. No real user data was read.

PowerShell prerequisites for core, concurrency, privacy and connected commands:

```powershell
$env:CORE_TEST_DATABASE_URL = 'postgresql://folio_test@127.0.0.1:55440/folio_rollout_test'
$env:CORE_TEST_DATABASE_DISPOSABLE = '1'
$env:GUIDED_TEST_BROWSER = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
Remove-Item Env:DATABASE_URL,Env:DIRECT_URL -ErrorAction SilentlyContinue
node scripts/core/run-db.cjs
node --import tsx --test scripts/core/rollout-concurrency.test.cjs
node --import tsx --test scripts/rollout/privacy-storage.test.cjs
$env:ROLLOUT_EVIDENCE_DIR = '.tmp/connected-desktop-final'
Remove-Item Env:ROLLOUT_MOBILE -ErrorAction SilentlyContinue
node scripts/rollout/connected-journey.cjs
$env:ROLLOUT_MOBILE = '1'
$env:ROLLOUT_EVIDENCE_DIR = '.tmp/connected-mobile-final'
node scripts/rollout/connected-journey.cjs
```

For build preparation and the DB guard, explicitly set DATABASE_URL and DIRECT_URL to that same disposable URL. Do not carry those into the core runner's initial safety check: it deliberately rejects a target matching a configured application DB. No skip or safety gate was disabled.

See [validation.json](validation.json) for all 37 final commands, environment overrides, log/result hashes and timestamps. Result manifests list all captured views; the PR includes selected significant screenshots, while the full local capture directories remain under `.tmp`. Capture timestamps reflect the original local files, not Git commit time.
