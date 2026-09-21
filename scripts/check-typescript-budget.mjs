#!/usr/bin/env node
// Structured compiler diagnostics: no CLI-output parser, no line-number budget.
import ts from 'typescript';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const baselinePath = 'tools/typescript-baseline.json';
const slash = value => value.replaceAll('\\', '/');
const key = row => JSON.stringify(row.slice(0, 3));
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

// Exact reviewed alternative renderings, not a wildcard or a dropped type field.
// Full source-span/type/assignability proofs accompany the reviewed display changes.
// Truncated compiler messages cannot safely be generically property-sorted.
const displays = JSON.parse(readFileSync(new URL('../tools/typescript-display-equivalences.json', import.meta.url), 'utf8'));
if (displays.version !== 1 || !Array.isArray(displays.entries)) throw new Error('Invalid diagnostic display equivalences');
const displayKeys = new Map();
for (const row of displays.entries) {
  if (typeof row.file !== 'string' || !Number.isInteger(row.code) || typeof row.before !== 'string' || typeof row.after !== 'string') throw new Error('Invalid diagnostic display equivalence');
  const alternative = key([row.file, row.code, row.after]);
  if (displayKeys.has(alternative)) throw new Error('Duplicate diagnostic display equivalence');
  displayKeys.set(alternative, key([row.file, row.code, row.before]));
}
const comparisonKey = row => ts.version === displays.compilerVersion ? displayKeys.get(key(row)) || key(row) : key(row);

function comparisonGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    const id = comparisonKey(row);
    const previous = groups.get(id);
    groups.set(id, previous ? [...previous.slice(0, 3), previous[3] + row[3]] : [...row]);
  }
  return groups;
}

export function normalizeMessage(message, root) {
  return slash(message).split(slash(resolve(root)) + '/').join('<root>/').replace(/\s+/g, ' ').trim();
}

export function measure(root = process.cwd()) {
  const configPath = resolve(root, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, {
    noEmit: true, incremental: false,
  }, configPath);
  if (parsed.errors.length) throw new Error(ts.formatDiagnostics(parsed.errors, {
    getCanonicalFileName: name => name, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options, projectReferences: parsed.projectReferences });
  const diagnostics = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error);
  const rows = new Map();
  for (const d of diagnostics) {
    const row = [d.file ? slash(relative(root, d.file.fileName)) : '<global>', d.code,
      normalizeMessage(ts.flattenDiagnosticMessageText(d.messageText, '\n'), root), 1];
    const id = key(row);
    if (rows.has(id)) rows.get(id)[3]++;
    else rows.set(id, row);
  }
  return { total: diagnostics.length, diagnostics: [...rows.values()].sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) };
}

export function validateBaseline(value) {
  if (value.version !== 1 || !Array.isArray(value.diagnostics)) throw new Error('Invalid TypeScript baseline format');
  const seen = new Set();
  let total = 0;
  for (const row of value.diagnostics) {
    if (!Array.isArray(row) || row.length !== 4 || typeof row[0] !== 'string' || !Number.isInteger(row[1]) ||
        typeof row[2] !== 'string' || !Number.isInteger(row[3]) || row[3] < 1 || seen.has(key(row))) {
      throw new Error('Invalid or duplicate TypeScript fingerprint');
    }
    seen.add(key(row));
    total += row[3];
  }
  if (total !== value.total) throw new Error('Baseline total does not match fingerprint multiplicities');
  return value;
}

export function compare(baseline, current) {
  const known = comparisonGroups(baseline.diagnostics);
  const added = [...comparisonGroups(current.diagnostics)].flatMap(([id, row]) => {
    const count = row[3] - (known.get(id)?.[3] || 0);
    return count > 0 ? [[...row.slice(0, 3), count]] : [];
  });
  return { pass: current.total <= baseline.total && added.length === 0, delta: current.total - baseline.total, added };
}

export function summarize(current) {
  const codes = new Map(), files = new Map();
  for (const [file, code, , count] of current.diagnostics) {
    codes.set(code, (codes.get(code) || 0) + count);
    files.set(file, (files.get(file) || 0) + count);
  }
  const top = map => [...map].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, 10);
  console.log('Top codes: ' + top(codes).map(([code, count]) => `TS${code}=${count}`).join(', '));
  console.log('Top files:\n' + top(files).map(([file, count]) => `  ${count} ${file}`).join('\n'));
}

function printComparison(label, baseline, current) {
  const result = compare(baseline, current);
  console.log(`\n${label}\nBaseline: ${baseline.total}\nCurrent: ${current.total}\nDelta: ${result.delta >= 0 ? '+' : ''}${result.delta}`);
  console.log(result.pass ? `PASS — ${result.delta < 0 ? 'TypeScript debt decreased by ' + -result.delta : 'No new TypeScript diagnostics'}.` : 'FAIL — TypeScript debt increased or new fingerprints appeared.');
  for (const [file, code, message, count] of result.added.slice(0, 20)) console.log(`  +${count} ${file} TS${code} ${message.slice(0, 600)}`);
  if (result.added.length > 20) console.log(`  ... ${result.added.length - 20} more new fingerprints; run tsc for full details.`);
  return result.pass;
}

function readAtRef(root, ref) {
  // Missing baseline is allowed only for the initial rollout. Invalid refs fail.
  const files = git(root, ['ls-tree', '--name-only', ref, '--', baselinePath]);
  return files ? validateBaseline(JSON.parse(git(root, ['show', `${ref}:${baselinePath}`]))) : null;
}

function assertPrepared(root) {
  if (!existsSync(resolve(root, '.next/types/package.json'))) throw new Error('Next route types missing. Run npm run typecheck:prepare first.');
  const generated = resolve(root, 'node_modules/.prisma/client/schema.prisma');
  const clean = value => value.replaceAll('\r\n', '\n').trim();
  if (!existsSync(generated) || clean(readFileSync(generated, 'utf8')) !== clean(readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8'))) {
    throw new Error('Prisma client missing or stale. Run npm run typecheck:prepare first.');
  }
}

export function main(args = process.argv.slice(2), root = process.cwd()) {
  const unknown = args.filter(arg => !['--update', '--init', '--base-ref'].includes(arg) && args[args.indexOf(arg) - 1] !== '--base-ref');
  if (unknown.length || (args.includes('--update') && args.includes('--init'))) throw new Error('Usage: check-typescript-budget.mjs [--update | --init] [--base-ref REF]');
  const refIndex = args.indexOf('--base-ref');
  const ref = refIndex >= 0 ? args[refIndex + 1] : process.env.TYPESCRIPT_BUDGET_BASE_REF;
  if (refIndex >= 0 && (!ref || ref.startsWith('--'))) throw new Error('--base-ref requires a git ref');
  const path = resolve(root, baselinePath);
  const baseline = existsSync(path) ? validateBaseline(JSON.parse(readFileSync(path, 'utf8'))) : null;
  const head = readAtRef(root, 'HEAD');
  if (args.includes('--init')) {
    if (baseline || head) throw new Error('Initialization refused: a baseline already exists. Use --update to lower it.');
  } else if (!baseline) throw new Error('Committed TypeScript baseline missing');
  if (baseline && head && !printComparison('Baseline integrity against HEAD', head, baseline)) return 1;
  if (ref && !/^0+$/.test(ref)) {
    const base = git(root, ['merge-base', 'HEAD', ref]);
    const previous = readAtRef(root, base);
    if (previous && baseline && !printComparison('Baseline integrity against merge base', previous, baseline)) return 1;
    if (!previous) console.log('Initial rollout: merge base has no TypeScript baseline; review the new artifact.');
  }
  assertPrepared(root);
  const current = measure(root);
  summarize(current);
  if (baseline && !printComparison('TypeScript diagnostic budget', baseline, current)) return 1;
  if (args.includes('--init') || args.includes('--update')) {
    if (baseline && current.total === baseline.total) {
      console.log('Baseline unchanged. No update needed.');
      return 0;
    }
    const metadata = { version: 1, baselineCommit: git(root, ['rev-parse', 'HEAD']), compilerVersion: ts.version,
      command: 'tsc --noEmit --pretty false --incremental false', total: current.total };
    mkdirSync(dirname(path), { recursive: true });
    // One readable fingerprint per line; count preserves repeated identical errors.
    writeFileSync(path, JSON.stringify(metadata, null, 2).slice(0, -2) + ',\n  "diagnostics": [\n' +
      current.diagnostics.map(row => '    ' + JSON.stringify(row)).join(',\n') + '\n  ]\n}\n');
    console.log(`Baseline written: ${baseline?.total ?? 'none'} -> ${current.total} (${baselinePath})`);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); }
  catch (error) { console.error('FAIL — ' + error.message); process.exitCode = 1; }
}
