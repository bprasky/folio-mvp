#!/usr/bin/env node
// Phase 5E migration discipline check.
// Usage:
//   node scripts/phase5e-check-plan.mjs              # human-readable report
//   node scripts/phase5e-check-plan.mjs --ci         # CI mode: compares to baseline, exits 1 if any count exceeds
//   node scripts/phase5e-check-plan.mjs --emit-baseline  # emit JSON to stdout for seeding .github/workflows/phase5e-baseline.json
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CI = process.argv.includes('--ci');
const EMIT_BASELINE = process.argv.includes('--emit-baseline');
const BASELINE_PATH = '.github/workflows/phase5e-baseline.json';

function walk(dir, exts) {
  const out = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) out.push(...walk(full, exts));
      else if (exts.some((e) => full.endsWith(e))) out.push(full);
    }
  } catch {}
  return out;
}

// ---------------- CHECK 1: Loose SQL at prisma/migrations/ root ----------------
const looseSqlFiles = readdirSync('prisma/migrations', { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.sql'))
  .map((e) => `prisma/migrations/${e.name}`);

// ---------------- CHECK 2: Phantom prisma.<model>.X calls ----------------
const schemaText = readFileSync('prisma/schema.prisma', 'utf8');
const declaredModels = new Set();
for (const m of schemaText.matchAll(/^model\s+(\w+)\s*\{/gm)) {
  // Prisma Client exposes camelCase delegates: first letter lower-case
  declaredModels.add(m[1].charAt(0).toLowerCase() + m[1].slice(1));
}
const PRISMA_API = new Set([
  '$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe',
  '$transaction', '$connect', '$disconnect', '$use', '$on', '$extends',
  '$runCommandRaw', '$metrics',
]);
function stripComments(src) {
  // Remove /* ... */ block comments (non-greedy, multi-line)
  let s = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove // line comments (to end of line)
  s = s.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  return s;
}
const srcFiles = walk('src', ['.ts', '.tsx']);
const phantomCalls = [];
for (const f of srcFiles) {
  const raw = readFileSync(f, 'utf8');
  const text = stripComments(raw);
  for (const m of text.matchAll(/\bprisma\.(\w+)/g)) {
    const delegate = m[1];
    if (PRISMA_API.has('$' + delegate)) continue; // tolerate $ prefix without backtick
    if (delegate.startsWith('$')) continue;
    if (!declaredModels.has(delegate)) {
      phantomCalls.push({ file: f.replace(/\\/g, '/'), model: delegate });
    }
  }
}
const phantomByModel = {};
for (const c of phantomCalls) phantomByModel[c.model] = (phantomByModel[c.model] || 0) + 1;

// ---------------- CHECK 3: Migration folders without migration.sql ----------------
const migrationDirs = readdirSync('prisma/migrations', { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\d{14}/.test(e.name));
const missingSqlFolders = migrationDirs
  .filter((d) => !existsSync(`prisma/migrations/${d.name}/migration.sql`))
  .map((d) => d.name);

// ---------------- CHECK 4: Non-idempotent patterns in last 20 migrations ----------------
const recentMigrations = migrationDirs
  .map((d) => d.name)
  .sort()
  .slice(-20);
const nonIdempotent = [];
for (const name of recentMigrations) {
  const sqlPath = `prisma/migrations/${name}/migration.sql`;
  if (!existsSync(sqlPath)) continue;
  const sql = readFileSync(sqlPath, 'utf8');
  const hasRawCreateTable =
    /CREATE TABLE\s+"[^"]+"\s*\(/i.test(sql) &&
    !/CREATE TABLE\s+IF NOT EXISTS/i.test(sql);
  const hasRawCreateIndex =
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+"[^"]+"\s+ON/i.test(sql) &&
    !/CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF NOT EXISTS/i.test(sql);
  const hasRawCreateType =
    /CREATE TYPE\s+"[^"]+"\s+AS\s+ENUM/i.test(sql) &&
    !/DO\s+\$\$[\s\S]*?CREATE TYPE/i.test(sql);
  const issues = [
    hasRawCreateTable && 'CREATE TABLE without IF NOT EXISTS',
    hasRawCreateIndex && 'CREATE INDEX without IF NOT EXISTS',
    hasRawCreateType && 'CREATE TYPE without DO $$',
  ].filter(Boolean);
  if (issues.length > 0) nonIdempotent.push({ name, issues });
}

const counts = {
  looseSql: looseSqlFiles.length,
  phantomCalls: phantomCalls.length,
  missingSql: missingSqlFolders.length,
  nonIdempotent: nonIdempotent.length,
};

if (EMIT_BASELINE) {
  const baseline = { ...counts, generatedAt: new Date().toISOString() };
  console.log(JSON.stringify(baseline, null, 2));
  process.exit(0);
}

if (CI) {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`[phase5e-check] baseline missing: ${BASELINE_PATH}`);
    console.error('Run: node scripts/phase5e-check-plan.mjs --emit-baseline > ' + BASELINE_PATH);
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const violations = [];
  for (const key of ['looseSql', 'phantomCalls', 'missingSql', 'nonIdempotent']) {
    if (counts[key] > baseline[key]) {
      violations.push({ key, current: counts[key], baseline: baseline[key] });
    }
  }
  if (violations.length === 0) {
    console.log('[phase5e-check] OK — all counts at or below baseline.');
    console.log(`  looseSql=${counts.looseSql}/${baseline.looseSql} phantomCalls=${counts.phantomCalls}/${baseline.phantomCalls} missingSql=${counts.missingSql}/${baseline.missingSql} nonIdempotent=${counts.nonIdempotent}/${baseline.nonIdempotent}`);
    process.exit(0);
  }
  console.error('[phase5e-check] FAIL — migration discipline regression detected:');
  for (const v of violations) {
    console.error(`  ${v.key}: current=${v.current} > baseline=${v.baseline}`);
  }
  console.error('');
  console.error('If the increase is intentional (e.g., legitimate technical-debt entry),');
  console.error('update .github/workflows/phase5e-baseline.json in the same PR.');
  console.error('See memory/migration_phase5e_ci_enforcement.md for rationale.');
  process.exit(1);
}

// ---------------- Default: human-readable report ----------------
console.log(`Check 1 — Loose SQL at prisma/migrations/ root: ${counts.looseSql} file(s)`);
for (const f of looseSqlFiles) console.log(`  - ${f}`);

console.log(`\nCheck 2 — Phantom prisma.<model> calls (model not in schema.prisma): ${counts.phantomCalls} reference(s)`);
for (const [m, n] of Object.entries(phantomByModel)) {
  console.log(`  - prisma.${m}: ${n} call(s)`);
}

console.log(`\nCheck 3 — Migration folders without migration.sql: ${counts.missingSql}`);
for (const name of missingSqlFolders) console.log(`  - ${name}`);

console.log(`\nCheck 4 — Non-idempotent patterns in last 20 migrations: ${counts.nonIdempotent}`);
for (const { name, issues } of nonIdempotent) {
  console.log(`  - ${name}: ${issues.join(', ')}`);
}

console.log('\n---');
console.log('Current counts become CI baseline. CI fails on any increase.');
