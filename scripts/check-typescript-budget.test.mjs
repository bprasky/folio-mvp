import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compare, measure, normalizeMessage, validateBaseline } from './check-typescript-budget.mjs';

test('47 reviewed display equivalents preserve counts and reject changed errors', () => {
  const { entries } = JSON.parse(readFileSync(new URL('../tools/typescript-display-equivalences.json', import.meta.url), 'utf8'));
  assert.equal(entries.length, 47);
  for (const e of entries) {
    const old = [e.file,e.code,e.before,e.count], current = [e.file,e.code,e.after,e.count];
    const baseline = { total:e.count,diagnostics:[old] };
    assert.equal(compare(baseline,{total:e.count,diagnostics:[current]}).pass,true);
    for (const changed of [
      [e.file,e.code,e.after+' A new constraint failed.',e.count],
      ['src/new-location.ts',e.code,e.after,e.count],
      [e.file,e.code+1,e.after,e.count],
    ]) assert.equal(compare(baseline,{total:e.count,diagnostics:[changed]}).pass,false);
    assert.equal(compare(baseline,{total:e.count+1,diagnostics:[[e.file,e.code,e.after,e.count+1]]}).pass,false);
    assert.equal(compare(baseline,{total:e.count*2,diagnostics:[old,current]}).pass,false,'Both renderings of an error must consume their combined multiplicity');
  }
});

test('reviewed displays cannot spend removed debt on a same-total duplicate or new property type', () => {
  const { entries:[e] } = JSON.parse(readFileSync(new URL('../tools/typescript-display-equivalences.json', import.meta.url), 'utf8'));
  const old=[e.file,e.code,e.before,1], current=[e.file,e.code,e.after,1];
  const baseline={total:2,diagnostics:[old,['src/unrelated.ts',2322,'historical error',1]]};
  assert.equal(compare(baseline,{total:2,diagnostics:[old,current]}).pass,false);
  assert.equal(compare(baseline,{total:1,diagnostics:[[e.file,e.code,e.after.replace('id: string','id: number'),1]]}).pass,false);
});

test('root paths and line wrapping normalize without erasing diagnostic content', () => {
  assert.equal(normalizeMessage('import("C:\\repo\\src\\a")\n  has no field', 'C:/repo'),
    normalizeMessage('import("C:/repo/src/a") has no field', 'C:/repo'));
  assert.notEqual(normalizeMessage("Type 'A' is invalid", process.cwd()), normalizeMessage("Type 'B' is invalid", process.cwd()));
  assert.equal(normalizeMessage(`import("${process.cwd()}/src/a")`, process.cwd()), 'import("<root>/src/a")');
});

test('CLI updates only downward, rejects missing preparation and committed baseline expansion', () => {
  const root = mkdtempSync(join(tmpdir(), 'folio-ts-cli-'));
  const cli = fileURLToPath(new URL('./check-typescript-budget.mjs', import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, TYPESCRIPT_BUDGET_BASE_REF: '' } });
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  try {
    git('init');
    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { types: [], skipLibCheck: true }, include: ['*.ts'] }));
    writeFileSync(join(root, 'a.ts'), 'export const historical: number = "old";\n');
    git('add', '.');
    git('-c', 'user.name=Ratchet Test', '-c', 'user.email=ratchet@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Fixture baseline');
    assert.equal(run('--init').status, 1, 'missing generated inputs fail closed');
    for (const path of ['.next/types', 'prisma', 'node_modules/.prisma/client']) mkdirSync(join(root, path), { recursive: true });
    writeFileSync(join(root, '.next/types/package.json'), '{"type":"module"}\n');
    for (const path of ['prisma/schema.prisma', 'node_modules/.prisma/client/schema.prisma']) writeFileSync(join(root, path), '// fixture schema\n');
    assert.equal(run('--init').status, 0);
    const path = join(root, 'tools/typescript-baseline.json');
    const baseline = readFileSync(path, 'utf8');
    assert.equal(JSON.parse(baseline).total, 1);
    git('add', 'tools/typescript-baseline.json');
    git('-c', 'user.name=Ratchet Test', '-c', 'user.email=ratchet@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Record fixture debt');
    const originalCommit = git('rev-parse', 'HEAD').toString().trim();
    assert.equal(run('--init').status, 1);
    writeFileSync(join(root, 'b.ts'), 'export const regression: boolean = 1;\n');
    const increase = run('--update');
    assert.equal(increase.status, 1);
    assert.match(increase.stdout, /Delta: \+1/);
    assert.match(increase.stdout, /b.ts TS2322/);
    assert.equal(readFileSync(path, 'utf8'), baseline);
    rmSync(join(root, 'b.ts'));
    writeFileSync(join(root, 'a.ts'), 'export const historical: number = 1;\n');
    assert.equal(run('--update').status, 0);
    assert.equal(JSON.parse(readFileSync(path, 'utf8')).total, 0);
    assert.equal(run('--base-ref', 'HEAD').status, 0);
    const raised = JSON.parse(baseline);
    raised.total = 2;
    raised.diagnostics[0][3] = 2;
    writeFileSync(path, JSON.stringify(raised));
    assert.equal(run('--base-ref', 'HEAD').status, 1, 'manual baseline inflation fails');
    git('add', 'tools/typescript-baseline.json');
    git('-c', 'user.name=Ratchet Test', '-c', 'user.email=ratchet@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Simulate PR baseline inflation');
    const againstBase = run('--base-ref', originalCommit);
    assert.equal(againstBase.status, 1, 'committed PR inflation fails against merge base');
    assert.match(againstBase.stdout, /Baseline integrity against merge base/);
    assert.equal(run('--base-ref', 'nonexistent-ref').status, 1);
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'folio-ts-cli-')));
    rmSync(root, { recursive: true, force: true });
  }
});

test('same-count substitutions and repeated identical errors cannot spend removed debt', () => {
  const baseline = { total: 2, diagnostics: [['src/a.ts', 2322, 'old', 2]] };
  assert.equal(compare(baseline, { total: 1, diagnostics: [['src/a.ts', 2322, 'new', 1]] }).pass, false);
  assert.equal(compare(baseline, { total: 3, diagnostics: [['src/a.ts', 2322, 'old', 3]] }).pass, false);
  assert.equal(compare(baseline, { total: 2, diagnostics: [['src/new.ts', 2322, 'old', 2]] }).pass, false);
  assert.equal(compare(baseline, { total: 1, diagnostics: [['src/a.ts', 2322, 'old', 1]] }).pass, true);
});

test('corrupt totals and duplicate fingerprint rows fail closed', () => {
  const row = ['a.ts', 2322, 'message', 1];
  assert.throws(() => validateBaseline({ version: 1, total: 0, diagnostics: [row] }));
  assert.throws(() => validateBaseline({ version: 1, total: 2, diagnostics: [row, row] }));
  assert.throws(() => validateBaseline({ version: 99, total: 0, diagnostics: [] }));
});

test('real compiler: baseline, artificial +1, line movement and reduction', () => {
  const root = mkdtempSync(join(tmpdir(), 'folio-ts-ratchet-'));
  try {
    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { types: [], skipLibCheck: true }, include: ['*.ts'] }));
    const source = 'export const historical: number = "old debt";\n';
    writeFileSync(join(root, 'example.ts'), source);
    const baseline = measure(root);
    assert.equal(baseline.total, 1);
    assert.equal(compare(baseline, measure(root)).pass, true);
    writeFileSync(join(root, 'example.ts'), '\n\n\n' + source);
    assert.deepEqual(measure(root), baseline);
    writeFileSync(join(root, 'new.ts'), 'export const regression: boolean = 1;\n');
    const increased = compare(baseline, measure(root));
    assert.equal(increased.delta, 1);
    assert.equal(increased.pass, false);
    assert.equal(increased.added[0][0], 'new.ts');
    rmSync(join(root, 'new.ts'));
    writeFileSync(join(root, 'example.ts'), 'export const historical: number = 1;\n');
    const reduced = measure(root);
    assert.equal(reduced.total, 0);
    assert.equal(compare(baseline, reduced).pass, true);
  } finally {
    // Only this test's freshly created, absolute temp directory is removed.
    assert.ok(root.startsWith(join(tmpdir(), 'folio-ts-ratchet-')));
    rmSync(root, { recursive: true, force: true });
  }
});
