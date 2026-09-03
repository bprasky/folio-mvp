#!/usr/bin/env node
/**
 * The RSC / client import boundary, enforced.
 *
 * `.claude/agents/folio-next-supabase-specialist.md` calls this file "the
 * canonical rule set for what can be imported where", makes running it a
 * non-negotiable step after any edit under `src/app/`, and reserves a
 * `guard:client-imports: <passed / failed>` line in its required output format.
 * The file did not exist, so that line has been unanswerable on every run and
 * none of the rules below were checked by anything.
 *
 * WHY NOT `server-only`. Next 14 aliases the `server-only` package to its own
 * bundled stub per webpack layer and errors at build time when a server-only
 * module is pulled into a client layer, so the mechanism does work — but only
 * for files that import it, and exactly one file in this repo does
 * (`src/lib/auth/getSigninHero.ts`). The package is in neither dependency block
 * and does not resolve outside a Next build, so `node`, `tsc` and this script
 * cannot see it at all. It is not a boundary this guard can lean on.
 *
 * WHAT THE BUILD ALREADY CATCHES. A genuine runtime Prisma import in a client
 * bundle fails `next build`. Rules 1 and 2 below are NOT caught by the build,
 * which is why they matter most: a service-role key reaching a client bundle is
 * a published secret, and the build is happy to ship it.
 *
 * Exit 0 clean, 1 on any violation. No allowlist, deliberately — the agent
 * definition's instruction is "If it fails, fix the import, don't silence the
 * guard."
 *
 * Run: npm run guard:client-imports
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const APP = path.join(ROOT, 'src', 'app');
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);

// ---------------------------------------------------------------------------
// File walk
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

/**
 * A file is a client module when its FIRST statement is the directive. Next
 * ignores it anywhere else, so matching it loose would mark server files client
 * on the strength of a mention in a comment.
 */
function isClientModule(source) {
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
    return /^['"]use client['"]\s*;?$/.test(line);
  }
  return false;
}

/**
 * Line numbers of code lines, with `//` and `/* *\/` comment bodies dropped.
 *
 * A rule that fires on a comment teaches people to write the violation in a
 * comment, and a guard nobody trusts gets silenced. Block-comment tracking is
 * line-granular, which is enough: an import statement never shares a line with
 * the end of a block comment in code anyone would commit.
 */
function codeLines(source) {
  const out = [];
  let inBlock = false;
  source.split('\n').forEach((raw, i) => {
    let line = raw;
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end === -1) return;
      line = line.slice(end + 2);
      inBlock = false;
    }
    const open = line.indexOf('/*');
    if (open !== -1) {
      const close = line.indexOf('*/', open + 2);
      if (close === -1) { inBlock = true; line = line.slice(0, open); }
      else line = line.slice(0, open) + line.slice(close + 2);
    }
    const slash = line.indexOf('//');
    if (slash !== -1) line = line.slice(0, slash);
    if (line.trim()) out.push({ n: i + 1, text: line });
  });
  return out;
}

const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const violations = [];
const record = (rule, file, line, detail, why) =>
  violations.push({ rule, file: rel(file), line, detail, why });

// An import of `mod`, in any form the codebase actually uses: static import,
// bare side-effect import, `export … from`, dynamic `import()`, and `require()`.
const importsFrom = (text, mod) => {
  const m = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?:^|[^\\w])(?:from\\s*|import\\s*\\(\\s*|require\\s*\\(\\s*)['"]${m}['"]`
  ).test(text) || new RegExp(`^\\s*import\\s+['"]${m}['"]`).test(text);
};

/** True for `import type …` and `export type …`, which erase at compile time. */
const isTypeOnly = (text) => /^\s*(?:import|export)\s+type\b/.test(text);

function checkFile(file, source) {
  const underApp = file.startsWith(APP + path.sep);
  const isClient = isClientModule(source);
  const lines = codeLines(source);

  for (const { n, text } of lines) {
    // ── Rule 1 ── the Supabase client factory is the only way in, under src/app.
    // Not caught by the build. `folio-next-supabase-specialist.md:50`.
    if (underApp && importsFrom(text, '@supabase/supabase-js')) {
      record('supabase-js-in-app', file, n, text.trim(),
        'construct the client through the factory, not directly');
    }

    // ── Rule 2 ── the service-role key never appears under src/app.
    // Not caught by the build, and the failure ships the secret to browsers.
    // `folio-next-supabase-specialist.md:33`, `folio-code-reviewer.md:39`.
    if (underApp && /SERVICE_ROLE/.test(text)) {
      record('service-role-in-app', file, n, text.trim(),
        'service-role key belongs in scripts/ or a server-only lib, never under src/app');
    }

    // ── Rule 3 ── no runtime Prisma in a client module.
    // `folio-next-supabase-specialist.md:51`.
    if (isClient && !isTypeOnly(text) && importsFrom(text, '@/lib/prisma')) {
      record('prisma-runtime-in-client', file, n, text.trim(),
        'fetch in the server parent and pass the result as a prop');
    }

    // ── Rule 4 ── `@prisma/client` in a client module must be `import type`.
    // A type used in value position is elided today, which makes this inert
    // until someone adds one value import to the same statement and pulls the
    // engine into a browser bundle. The `type` keyword makes the erasure a
    // guarantee instead of an accident.
    if (isClient && importsFrom(text, '@prisma/client') && !isTypeOnly(text)) {
      record('prisma-client-value-import', file, n, text.trim(),
        'write `import type { … } from "@prisma/client"` so the erasure is guaranteed');
    }
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

if (!fs.existsSync(SRC)) {
  console.error('guard:client-imports — no src/ directory at ' + ROOT);
  process.exit(1);
}

const files = walk(SRC);
let clientCount = 0;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (isClientModule(source)) clientCount++;
  checkFile(file, source);
}

const RULES = {
  'supabase-js-in-app': '@supabase/supabase-js imported directly under src/app/',
  'service-role-in-app': 'service-role key referenced under src/app/',
  'prisma-runtime-in-client': 'runtime Prisma import in a client module',
  'prisma-client-value-import': '@prisma/client imported into a client module without `type`',
};

console.log(`\nguard:client-imports — ${files.length} files under src/, ${clientCount} client modules\n`);

if (violations.length === 0) {
  for (const [, label] of Object.entries(RULES)) console.log(`  PASS  ${label}`);
  console.log('\nNo client-boundary violations.\n');
  process.exit(0);
}

const byRule = new Map();
for (const v of violations) {
  if (!byRule.has(v.rule)) byRule.set(v.rule, []);
  byRule.get(v.rule).push(v);
}
for (const [rule, label] of Object.entries(RULES)) {
  const hits = byRule.get(rule);
  if (!hits) { console.log(`  PASS  ${label}`); continue; }
  console.error(`  FAIL  ${label} — ${hits.length}`);
  for (const v of hits) {
    console.error(`        ${v.file}:${v.line}`);
    console.error(`          ${v.detail}`);
    console.error(`          → ${v.why}`);
  }
}
console.error(`\n${violations.length} violation(s). Fix the import; do not silence the guard.\n`);
process.exit(1);
