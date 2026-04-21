import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('C:/Users/bpras/AppData/Local/Temp/phase5h2/introspect.json', 'utf8'));

// Ordered list with timestamps (FK dependencies respected)
const order = [
  ['project_product_tags', '103000'],
  ['meeting_notes', '103001'],
  ['vendors', '103002'],
  ['vendor_preview_tokens', '103003'],
  ['pending_rep_invites', '103004'],
  ['vendor_product_match_scores', '103005'],
  ['room_intents', '103006'],
  ['project_lifecycle_scores', '103007'],
  ['project_intents', '103008'],
  ['designer_activity_profiles', '103009'],
  ['proximity_to_purchase_indicators', '103010'],
  ['follows', '103011'],
  ['editorial_drafts', '103012'],
];

function pgType(col) {
  const dt = col.data_type;
  const ut = col.udt_name;
  // User-defined enum types
  if (dt === 'USER-DEFINED') return `"${ut}"`;
  if (dt === 'text') return 'TEXT';
  if (dt === 'character varying') {
    return col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : 'VARCHAR';
  }
  if (dt === 'integer') return 'INTEGER';
  if (dt === 'bigint') return 'BIGINT';
  if (dt === 'smallint') return 'SMALLINT';
  if (dt === 'double precision') return 'DOUBLE PRECISION';
  if (dt === 'real') return 'REAL';
  if (dt === 'numeric') {
    if (col.numeric_precision != null && col.numeric_scale != null) {
      return `NUMERIC(${col.numeric_precision}, ${col.numeric_scale})`;
    }
    return 'NUMERIC';
  }
  if (dt === 'boolean') return 'BOOLEAN';
  if (dt === 'timestamp without time zone') {
    return col.datetime_precision != null ? `TIMESTAMP(${col.datetime_precision})` : 'TIMESTAMP';
  }
  if (dt === 'timestamp with time zone') {
    return col.datetime_precision != null ? `TIMESTAMPTZ(${col.datetime_precision})` : 'TIMESTAMPTZ';
  }
  if (dt === 'date') return 'DATE';
  if (dt === 'jsonb') return 'JSONB';
  if (dt === 'json') return 'JSON';
  if (dt === 'uuid') return 'UUID';
  if (dt === 'ARRAY') {
    // udt_name will be like "_text", "_int4"
    const base = ut.replace(/^_/, '');
    const map = { text: 'TEXT', int4: 'INTEGER', int8: 'BIGINT', float8: 'DOUBLE PRECISION', bool: 'BOOLEAN' };
    return (map[base] || base.toUpperCase()) + '[]';
  }
  return dt.toUpperCase();
}

function columnLine(col) {
  const type = pgType(col);
  const nn = col.is_nullable === 'NO' ? ' NOT NULL' : '';
  const def = col.column_default ? ` DEFAULT ${col.column_default}` : '';
  return `    "${col.column_name}" ${type}${nn}${def}`;
}

function buildMigration(table) {
  const info = data[table];
  const lines = [];
  lines.push(`-- Phase 5H2: record existing ${table} in migration history.`);
  lines.push(`-- Table was created hand-managed prior to reliable migration system.`);
  lines.push(`-- CREATE TABLE IF NOT EXISTS for idempotency — prod is untouched; shadow DB gets the table on replay.`);
  lines.push(`-- Column types lifted from information_schema.columns against prod (2026-04-21).`);
  lines.push('');

  // Special case: pending_rep_invites needs PendingRepInviteStatus type
  if (table === 'pending_rep_invites') {
    lines.push(`DO $$ BEGIN`);
    lines.push(`    CREATE TYPE "PendingRepInviteStatus" AS ENUM ('PENDING', 'CLAIMED', 'CANCELLED');`);
    lines.push(`EXCEPTION`);
    lines.push(`    WHEN duplicate_object THEN null;`);
    lines.push(`END $$;`);
    lines.push('');
  }

  // CREATE TABLE
  lines.push(`CREATE TABLE IF NOT EXISTS "${table}" (`);
  const colLines = info.columns.map(columnLine);
  // Detect primary key columns from indexes (indexname ending _pkey)
  const pkIdx = info.indexes.find(i => i.indexname === `${table}_pkey`);
  let pkCols = [];
  if (pkIdx) {
    // Parse "CREATE UNIQUE INDEX ... ON public.<table> USING btree (<cols>)"
    const m = pkIdx.indexdef.match(/\(([^)]+)\)/);
    if (m) pkCols = m[1].split(',').map(s => s.trim().replace(/"/g, ''));
  }
  lines.push(colLines.join(',\n'));
  if (pkCols.length > 0) {
    lines.push(`    ,`);
    lines.push(`    CONSTRAINT "${table}_pkey" PRIMARY KEY (${pkCols.map(c => `"${c}"`).join(', ')})`);
  }
  lines.push(`);`);
  lines.push('');

  // Indexes (skip _pkey)
  for (const idx of info.indexes) {
    if (idx.indexname === `${table}_pkey`) continue;
    // indexdef is like: CREATE [UNIQUE] INDEX idxname ON schema.table USING ...
    // Rewrite to CREATE [UNIQUE] INDEX IF NOT EXISTS
    let def = idx.indexdef;
    def = def.replace(/^CREATE UNIQUE INDEX /, 'CREATE UNIQUE INDEX IF NOT EXISTS ');
    def = def.replace(/^CREATE INDEX /, 'CREATE INDEX IF NOT EXISTS ');
    lines.push(`${def};`);
  }
  if (info.indexes.filter(i => i.indexname !== `${table}_pkey`).length > 0) lines.push('');

  // Foreign keys via idempotent DO $$
  if (info.foreignKeys.length > 0) {
    lines.push(`DO $$ BEGIN`);
    for (const fk of info.foreignKeys) {
      lines.push(`    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${fk.constraint_name}') THEN`);
      lines.push(`        ALTER TABLE "${table}" ADD CONSTRAINT "${fk.constraint_name}" FOREIGN KEY ("${fk.column_name}") REFERENCES "${fk.foreign_table}"("${fk.foreign_column}") ON DELETE ${fk.delete_rule} ON UPDATE ${fk.update_rule};`);
      lines.push(`    END IF;`);
    }
    lines.push(`END $$;`);
  }

  return lines.join('\n') + '\n';
}

// Generate all 13
for (const [table, timestamp] of order) {
  const folder = `prisma/migrations/20260421${timestamp}_record_bucket_b_${table}`;
  mkdirSync(folder, { recursive: true });
  const sql = buildMigration(table);
  writeFileSync(`${folder}/migration.sql`, sql);
  console.log(`${folder}/migration.sql (${sql.split('\n').length} lines)`);
}
console.log('Done.');
