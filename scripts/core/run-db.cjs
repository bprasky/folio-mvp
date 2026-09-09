const { spawnSync } = require('node:child_process');
const { disposableTarget } = require('./fixtures.cjs');
if (!disposableTarget()) {
  console.error('LIVE DATABASE TEST NOT EXECUTED — set CORE_TEST_DATABASE_URL and CORE_TEST_DATABASE_DISPOSABLE=1');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--test', 'scripts/core/safety.test.cjs', 'scripts/core/journeys.test.cjs'], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
