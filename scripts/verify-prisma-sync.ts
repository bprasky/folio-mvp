/**
 * Is the generated Prisma client in step with schema.prisma?
 *
 * `folio-prisma-guardian.md:25,34` prescribes this after every schema edit and
 * says "Do not claim done until both pass"; `folio-debugger.md:24` prescribes it
 * against "Prisma errors, type mismatches, `Unknown arg`" — the signature of code
 * written against a schema the client does not have.
 *
 * SCHEMA VS CLIENT, NOT SCHEMA VS DATABASE. Those are different questions and
 * conflating them is why this needed writing rather than aliasing:
 * `scripts/schema-parity-audit.mjs` already compares schema.prisma against the
 * live database and needs DIRECT_URL to do it. This needs no database at all,
 * which is the point — "my client is stale" is the failure you hit before you
 * have a connection, usually right after a git pull.
 *
 * Reads the generated client's own DMMF rather than its .d.ts, because the DMMF
 * is what Prisma actually built and the types are a projection of it.
 *
 * Exit 0 in step, 1 on drift.
 *
 * Run: npm run verify:prisma
 */

import { readFileSync, existsSync } from 'fs';

let failures = 0;
const fail = (name: string, detail: string) => {
  failures++;
  console.error(`  FAIL  ${name}\n        ${detail.split('\n').join('\n        ')}`);
};
const pass = (name: string, detail?: string) => {
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
};

console.log('\nverify:prisma — schema.prisma vs the generated client\n');

// ── The schema, parsed for declarations rather than fully ────────────────────
// Model and enum names are what the client exposes, and they are unambiguous on
// a single line. A full parse would buy nothing this check can use.
const SCHEMA_PATH = 'prisma/schema.prisma';
if (!existsSync(SCHEMA_PATH)) {
  console.error(`  FAIL  schema.prisma exists\n        ${SCHEMA_PATH} not found`);
  console.error('\n1 check(s) failed.\n');
  process.exit(1);
}
const schema = readFileSync(SCHEMA_PATH, 'utf8');
const declared = {
  models: new Set([...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1])),
  enums: new Set([...schema.matchAll(/^enum\s+(\w+)\s*\{/gm)].map((m) => m[1])),
};

// ── The generated client ─────────────────────────────────────────────────────
let dmmf: any;
try {
  // Required lazily and by name so a missing client is reported as drift with an
  // instruction, rather than as an unhandled module-resolution stack trace.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Prisma } = require('@prisma/client');
  dmmf = Prisma?.dmmf;
} catch (err) {
  console.error(
    `  FAIL  the Prisma client is generated\n` +
    `        @prisma/client could not be loaded: ${(err as Error).message}\n` +
    `        Run: npx prisma generate`,
  );
  console.error('\n1 check(s) failed.\n');
  process.exit(1);
}

if (!dmmf?.datamodel) {
  console.error(
    `  FAIL  the generated client exposes its datamodel\n` +
    `        Prisma.dmmf is missing. The client is present but was not generated\n` +
    `        from this schema. Run: npx prisma generate`,
  );
  console.error('\n1 check(s) failed.\n');
  process.exit(1);
}

const generated = {
  models: new Set<string>(dmmf.datamodel.models.map((m: any) => m.name)),
  enums: new Set<string>(dmmf.datamodel.enums.map((e: any) => e.name)),
};

// ── The comparison, both directions ──────────────────────────────────────────
// Missing-from-client is the stale-client case: code written against a new model
// fails at the type level with "Unknown arg". Missing-from-schema is the reverse
// and is worse — a delegate the client still offers that the schema no longer
// declares is a call that type-checks and cannot work.
const diff = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x)).sort();

for (const kind of ['models', 'enums'] as const) {
  const missingFromClient = diff(declared[kind], generated[kind]);
  const missingFromSchema = diff(generated[kind], declared[kind]);

  if (missingFromClient.length === 0) {
    pass(`every ${kind.slice(0, -1)} in schema.prisma is in the client`, `${declared[kind].size}`);
  } else {
    fail(
      `every ${kind.slice(0, -1)} in schema.prisma is in the client`,
      `${missingFromClient.length} declared but not generated — the client is stale:\n` +
      missingFromClient.map((n) => `  ${n}`).join('\n') +
      `\n\nRun: npx prisma generate`,
    );
  }

  if (missingFromSchema.length === 0) {
    pass(`every ${kind.slice(0, -1)} in the client is in schema.prisma`);
  } else {
    fail(
      `every ${kind.slice(0, -1)} in the client is in schema.prisma`,
      `${missingFromSchema.length} generated but no longer declared — calls against\n` +
      `these type-check and cannot work:\n` +
      missingFromSchema.map((n) => `  ${n}`).join('\n') +
      `\n\nRun: npx prisma generate`,
    );
  }
}

// ── Field-level drift on the models both sides agree exist ───────────────────
// The name-level check above misses the common case entirely: a field added to
// an existing model. That is what produces "Property 'workEmail' does not exist"
// and "'collaborationStatus' does not exist in type WhereInput".
const fieldPattern = (model: string) => {
  const block = schema.match(new RegExp(`^model\\s+${model}\\s*\\{([\\s\\S]*?)^\\}`, 'm'));
  if (!block) return null;
  return new Set(
    block[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
      // `Unsupported(...)` columns are deliberately absent from the client —
      // Prisma cannot type them, so it omits them and offers raw SQL instead.
      // Counting them as drift would report `centroid` and `themeEmbedding`,
      // the two pgvector columns, as stale on a perfectly current client.
      .filter((l) => !/\bUnsupported\s*\(/.test(l))
      .map((l) => l.split(/\s+/)[0])
      .filter((n) => /^\w+$/.test(n)),
  );
};

const fieldDrift: string[] = [];
for (const model of [...declared.models].filter((m) => generated.models.has(m))) {
  const declaredFields = fieldPattern(model);
  if (!declaredFields) continue;
  const genModel = dmmf.datamodel.models.find((m: any) => m.name === model);
  const generatedFields = new Set<string>(genModel.fields.map((f: any) => f.name));
  const missing = [...declaredFields].filter((f) => !generatedFields.has(f));
  if (missing.length) fieldDrift.push(`${model}: ${missing.join(', ')}`);
}

if (fieldDrift.length === 0) {
  pass('no field declared in schema.prisma is missing from the client');
} else {
  fail(
    'no field declared in schema.prisma is missing from the client',
    `${fieldDrift.length} model(s) with fields the client does not have:\n` +
    fieldDrift.map((l) => `  ${l}`).join('\n') +
    `\n\nRun: npx prisma generate`,
  );
}

console.log(
  failures === 0
    ? '\nThe generated client is in step with schema.prisma.\n'
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
