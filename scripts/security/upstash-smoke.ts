import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { checkRateLimit } from '../../src/lib/rateLimit';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
process.env.NODE_ENV = 'production';

async function main() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN before running this smoke test.');
    process.exitCode = 2; return;
  }
  const child = process.argv.indexOf('--attempt');
  if (child !== -1) {
    const result = await checkRateLimit(process.argv[child + 1], { max: 2, windowMs: 60000 });
    console.log(JSON.stringify(result)); return;
  }
  // Each attempt starts a fresh process. Shared state must come from Redis.
  const key = `p0-smoke:${randomUUID()}`;
  const results: Array<{ success: boolean; remaining: number; reset: number }> = [];
  for (let i = 0; i < 3; i++) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', resolve('scripts/security/upstash-smoke.ts'), '--attempt', key], { encoding: 'utf8', env: process.env, timeout: 15000 });
    if (result.status !== 0) throw Error('Smoke child failed');
    results.push(JSON.parse(result.stdout.trim()));
  }
  if (new Set(results.map(r => r.reset)).size !== 1) throw Error('Test crossed a window boundary; rerun');
  if (results.map(r => r.success).join(',') !== 'true,true,false' || results.map(r => r.remaining).join(',') !== '1,0,0') throw Error('Distributed limit did not match expected results');
  console.log('PASS: three independent processes share a two-request limit (allow, allow, reject). Smoke key expires automatically.');
}
main().catch(() => { console.error('FAIL: distributed smoke test. Inspect safe rate-limit outcome logs; no credentials are printed.'); process.exitCode = 1; });
