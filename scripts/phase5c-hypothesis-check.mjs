import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

// Call-site counts from Follow-up B (model, call_sites, files)
const callData = [
  ['interviewSession', 23, 12],
  ['eventHostProfile', 14, 5],
  ['vendorBoostRequest', 12, 7],
  ['eventRelationshipEdge', 11, 4],
  ['projectProductTag', 10, 8],
  ['eventVendorEdge', 10, 4],
  ['eventDesignerEdge', 10, 6],
  ['threeDAsset', 9, 3],
  ['meetingNote', 9, 6],
  ['noteAttachment', 8, 2],
  ['eventProductEdge', 8, 4],
  ['vendor', 7, 3],
  ['quoteHighlight', 6, 4],
  ['eventContact', 6, 2],
  ['actionItem', 6, 3],
  ['vendorPreviewToken', 5, 3],
  ['vendorDiscoveryBudget', 5, 3],
  ['pendingRepInvite', 5, 3],
  ['vendorInviteCandidate', 4, 2],
  ['roomIntent', 4, 2],
  ['mediaAsset', 4, 2],
  ['eventRepEdge', 4, 1],
  ['eventInviteList', 4, 2],
  ['designerActivityProfile', 4, 3],
  ['projectLifecycleScore', 3, 2],
  ['follow', 3, 3],
  ['eventEngagementMetrics', 3, 2],
  ['vendorProductMatchScore', 2, 2],
  ['proximityToPurchaseIndicator', 2, 1],
  ['projectIntent', 2, 2],
  ['post', 2, 2],
  ['editorialDraft', 2, 1],
  ['analyticsEvent', 2, 1],
  ['vendorInviteContact', 1, 1],
  ['transcriptSegment', 1, 1],
  ['projectMember', 1, 1],
  ['postItem', 1, 1],
  ['eventTargetingProfile', 1, 1],
  ['eventMetrics', 1, 1],
  ['eventInvite', 1, 1],
  ['affiliateLink', 1, 1],
];

// camelCase → snake_case. Handles acronym runs like ABCFoo → a_b_c_foo? No — standard is abc_foo.
// Two-pass: insert underscore between (lower)(Upper) AND between (Upper)(Upper+lower).
function camelToSnake(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function pluralize(s) {
  if (s.endsWith('s')) return s;
  if (/[^aeiou]y$/.test(s)) return s.slice(0, -1) + 'ies';
  return s + 's';
}

function pascalCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function variants(model) {
  const snake = camelToSnake(model);
  const plural = pluralize(snake);
  const lower = model.toLowerCase();
  const lowerPlural = pluralize(lower);
  const set = new Set([plural, snake, lower, lowerPlural]);
  // Special-case threeDAsset-style: also try collapsed forms
  if (/[A-Z][A-Z]/.test(model) || /[a-z][A-Z][A-Z]/.test(model) || model.includes('D')) {
    set.add(model.replace(/([A-Z])/g, '_$1').replace(/^_/, '').toLowerCase());
    set.add(pluralize(model.replace(/([A-Z])/g, '_$1').replace(/^_/, '').toLowerCase()));
  }
  return [...set];
}

function clusterHint(model) {
  if (/^event/i.test(model)) return 'events';
  if (/^interview|transcript|quote|mediaAsset/i.test(model)) return 'interviews';
  if (/^vendor|pendingRep/i.test(model)) return 'vendor-intake';
  if (/^post/i.test(model)) return 'posts';
  if (/meetingNote|actionItem|noteAttachment|projectProductTag/i.test(model)) return 'project-collab';
  if (/^project|^room/i.test(model)) return 'project-core';
  if (/designerActivityProfile|proximityToPurchase|analyticsEvent/i.test(model)) return 'analytics';
  return 'other';
}

// 1) Query prod for all candidate table names in one shot
const allVariants = [...new Set(callData.flatMap(([m]) => variants(m)))];
const prodRows = await prisma.$queryRawUnsafe(
  `select table_name from information_schema.tables
     where table_schema = 'public' and table_name = ANY($1::text[])`,
  allVariants,
);
const prodTables = new Set(prodRows.map((r) => r.table_name));

// 2) Read schema.prisma (text scan for @@map and model declarations)
const schemaText = readFileSync('prisma/schema.prisma', 'utf8');
function schemaHas(model, tableVariants) {
  const pascal = pascalCase(model);
  const modelDecl = new RegExp(`^model\\s+${pascal}\\b`, 'm').test(schemaText);
  const mapHit = tableVariants.find((t) =>
    new RegExp(`@@map\\("${t}"\\)`).test(schemaText),
  );
  return { modelDecl, mapHit: mapHit ?? null };
}

// 3) Walk migration folders for CREATE TABLE "<name>"
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.sql')) out.push(full);
  }
  return out;
}
const sqlFiles = walk('prisma/migrations');
function migrationHas(tableVariants) {
  for (const t of tableVariants) {
    for (const f of sqlFiles) {
      const txt = readFileSync(f, 'utf8');
      if (new RegExp(`CREATE TABLE(\\s+IF NOT EXISTS)?\\s+"${t}"`, 'i').test(txt)) {
        // distinguish timestamped folder vs loose root file
        const isFolder = /migrations[\\/][0-9]{14}_[^\\/]+[\\/]migration\.sql$/.test(f);
        return { found: true, table: t, file: f, isFolder };
      }
    }
  }
  return { found: false };
}

// 4) Build matrix
const matrix = callData.map(([model, calls, files]) => {
  const vs = variants(model);
  const matchedProd = vs.filter((v) => prodTables.has(v));
  const schema = schemaHas(model, vs);
  const migration = migrationHas(vs);
  return {
    model,
    expected: vs.find((v) => v.endsWith('s')) ?? vs[0], // canonical: snake + plural
    allVariants: vs,
    tableInProd: matchedProd.length > 0 ? matchedProd[0] : null,
    migrationFolder:
      migration.found && migration.isFolder ? migration.file.replace(/.*migrations[\\/]/, '') : null,
    migrationLoose:
      migration.found && !migration.isFolder ? migration.file.replace(/.*migrations[\\/]/, '') : null,
    schemaModelDecl: schema.modelDecl,
    schemaMap: schema.mapHit,
    calls,
    files,
    cluster: clusterHint(model),
  };
});

// 5) Bucket
const buckets = {
  restoration: matrix.filter(
    (r) => r.tableInProd && (r.migrationFolder || r.migrationLoose) && !r.schemaModelDecl && !r.schemaMap,
  ),
  phantom: matrix.filter(
    (r) => !r.tableInProd && !r.migrationFolder && !r.migrationLoose && !r.schemaModelDecl && !r.schemaMap,
  ),
  anomaly: matrix.filter(
    (r) =>
      // declared in schema but no table? (shouldn't happen — would be on generated client)
      (r.schemaModelDecl || r.schemaMap) ||
      // table in prod but no migration recorded?
      (r.tableInProd && !r.migrationFolder && !r.migrationLoose) ||
      // migration exists but table not in prod?
      (!r.tableInProd && (r.migrationFolder || r.migrationLoose)),
  ),
};

// 6) Print markdown-ish output
console.log('## Matrix (sorted by call-site count desc)');
console.log(
  '| model | expected | in_prod | in_migration | in_schema | calls | files | cluster |',
);
console.log('|---|---|:-:|:-:|:-:|-:|-:|---|');
for (const r of matrix) {
  const migCol = r.migrationFolder
    ? `Y (folder)`
    : r.migrationLoose
      ? 'loose-only'
      : 'N';
  const schemaCol = r.schemaModelDecl || r.schemaMap ? 'Y' : 'N';
  console.log(
    `| \`${r.model}\` | \`${r.expected}\` | ${r.tableInProd ? 'Y' : 'N'} | ${migCol} | ${schemaCol} | ${r.calls} | ${r.files} | ${r.cluster} |`,
  );
}

console.log('\n## Buckets');
console.log(`\n### Restoration candidates (${buckets.restoration.length})`);
console.log('Table + migration folder exist; no schema.prisma declaration.');
for (const r of buckets.restoration)
  console.log(`- \`${r.model}\` → \`${r.tableInProd}\` (${r.calls} calls, ${r.cluster})`);

console.log(`\n### Pure phantoms (${buckets.phantom.length})`);
console.log('No table, no migration, no schema declaration. App code references nothing.');
for (const r of buckets.phantom)
  console.log(`- \`${r.model}\` (${r.calls} calls, ${r.cluster})`);

console.log(`\n### Anomalies (${buckets.anomaly.length})`);
console.log('Mixed state — worth investigating individually.');
for (const r of buckets.anomaly)
  console.log(
    `- \`${r.model}\`: prod=${r.tableInProd || 'N'} mig_folder=${r.migrationFolder || 'N'} mig_loose=${r.migrationLoose || 'N'} schema_model=${r.schemaModelDecl} schema_map=${r.schemaMap || 'N'}`,
  );

console.log('\n## Cluster summary');
const byCluster = {};
for (const r of matrix) {
  byCluster[r.cluster] ||= { models: 0, calls: 0, restoration: 0, phantom: 0, anomaly: 0 };
  byCluster[r.cluster].models += 1;
  byCluster[r.cluster].calls += r.calls;
  if (buckets.restoration.includes(r)) byCluster[r.cluster].restoration += 1;
  if (buckets.phantom.includes(r)) byCluster[r.cluster].phantom += 1;
  if (buckets.anomaly.includes(r)) byCluster[r.cluster].anomaly += 1;
}
console.log('| cluster | models | calls | restoration | phantom | anomaly |');
console.log('|---|-:|-:|-:|-:|-:|');
for (const [k, v] of Object.entries(byCluster).sort((a, b) => b[1].calls - a[1].calls))
  console.log(
    `| ${k} | ${v.models} | ${v.calls} | ${v.restoration} | ${v.phantom} | ${v.anomaly} |`,
  );

await prisma.$disconnect();
