// Phase 5A schema parity audit.
// Parses prisma/schema.prisma, queries prod via DIRECT_URL, cross-references every model and enum.
// READ-ONLY: only SELECTs against information_schema and pg_catalog.

import { PrismaClient } from '@prisma/client';
import { migrationConnectionUrl } from './lib/migrationConnection.mjs';
import fs from 'node:fs';

// ----------------------------------------------------------------------
// Parser
// ----------------------------------------------------------------------

function parseSchema(src) {
  const models = {};
  const enums = {};

  // Find model blocks (handles nested braces not required — Prisma's blocks are flat).
  const re = /^(model|enum)\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const kind = m[1], name = m[2], body = m[3];
    if (kind === 'model') models[name] = parseModel(body);
    else enums[name] = parseEnum(body);
  }
  return { models, enums };
}

function parseModel(body) {
  const fields = [];
  const indexes = [];
  const uniques = [];
  let mapName = null;
  let compositeId = null;
  let ignored = false;

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;

    if (line.startsWith('@@map(')) {
      const x = line.match(/@@map\("([^"]+)"\)/);
      if (x) mapName = x[1];
      continue;
    }
    if (line.startsWith('@@index(')) {
      const x = line.match(/@@index\(\[([^\]]+)\]/);
      if (x) indexes.push(x[1].split(',').map(s => s.trim().replace(/^"|"$/g, '')));
      continue;
    }
    if (line.startsWith('@@unique(')) {
      const x = line.match(/@@unique\(\[([^\]]+)\]/);
      if (x) uniques.push(x[1].split(',').map(s => s.trim().replace(/^"|"$/g, '')));
      continue;
    }
    if (line.startsWith('@@id(')) {
      const x = line.match(/@@id\(\[([^\]]+)\]/);
      if (x) compositeId = x[1].split(',').map(s => s.trim());
      continue;
    }
    if (line.startsWith('@@ignore')) { ignored = true; continue; }
    if (line.startsWith('@@')) continue;

    // Field line
    const tokens = line.split(/\s+/);
    if (tokens.length < 2) continue;
    const fieldName = tokens[0];
    const rawType = tokens[1];
    const isArray = rawType.endsWith('[]');
    const isOptional = rawType.endsWith('?');
    const baseType = rawType.replace(/[\?\[\]]/g, '');

    const rest = line.slice(line.indexOf(rawType) + rawType.length);
    const isRelation = /@relation\b/.test(rest);
    const mapMatch = rest.match(/@map\("([^"]+)"\)/);
    const defaultMatch = rest.match(/@default\(([^)]+)\)/);
    const dbTypeMatch = rest.match(/@db\.(\w+)(?:\(([^)]+)\))?/);
    const isId = /@id\b/.test(rest);
    const isUnique = /@unique\b/.test(rest);
    const relationMatch = rest.match(/@relation\(([^)]*)\)/);

    fields.push({
      name: fieldName,
      rawType, baseType,
      optional: isOptional,
      array: isArray,
      isRelation,
      columnName: mapMatch ? mapMatch[1] : fieldName,
      default: defaultMatch ? defaultMatch[1].trim() : null,
      dbType: dbTypeMatch ? (dbTypeMatch[1] + (dbTypeMatch[2] ? '(' + dbTypeMatch[2] + ')' : '')) : null,
      isId, isUnique,
      relationArgs: relationMatch ? relationMatch[1] : null
    });
  }
  return { fields, indexes, uniques, mapName, compositeId, ignored };
}

function parseEnum(body) {
  const values = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
    const x = line.match(/^(\w+)/);
    if (x) values.push(x[1]);
  }
  return { values };
}

// ----------------------------------------------------------------------
// Prisma type → expected Postgres udt_name mapping
// ----------------------------------------------------------------------

function expectedUdt(field, enumSet) {
  const t = field.baseType;
  const db = field.dbType;
  // Enum references
  if (enumSet.has(t)) return { udt: t, base: 'USER-DEFINED' };
  // @db overrides
  if (db) {
    const lower = db.toLowerCase();
    if (lower.startsWith('varchar')) return { udt: 'varchar', base: 'character varying' };
    if (lower === 'text') return { udt: 'text', base: 'text' };
    if (lower === 'timestamptz' || lower.startsWith('timestamptz')) return { udt: 'timestamptz', base: 'timestamp with time zone' };
    if (lower === 'date') return { udt: 'date', base: 'date' };
    if (lower === 'json') return { udt: 'json', base: 'json' };
    if (lower === 'jsonb') return { udt: 'jsonb', base: 'jsonb' };
    // fall through to base mapping
  }
  switch (t) {
    case 'String': return { udt: 'text', base: 'text' };
    case 'Boolean': return { udt: 'bool', base: 'boolean' };
    case 'Int': return { udt: 'int4', base: 'integer' };
    case 'BigInt': return { udt: 'int8', base: 'bigint' };
    case 'Float': return { udt: 'float8', base: 'double precision' };
    case 'Decimal': return { udt: 'numeric', base: 'numeric' };
    case 'DateTime': return { udt: 'timestamp', base: 'timestamp without time zone' };
    case 'Json': return { udt: 'jsonb', base: 'jsonb' };
    case 'Bytes': return { udt: 'bytea', base: 'bytea' };
    default: return { udt: null, base: null }; // unknown (maybe relation)
  }
}

// ----------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------

const src = fs.readFileSync('prisma/schema.prisma', 'utf8');
const { models, enums } = parseSchema(src);
const modelNames = Object.keys(models);
const enumNames = Object.keys(enums);
const enumSet = new Set(enumNames);
const modelSet = new Set(modelNames);

console.error(`parsed: models=${modelNames.length}, enums=${enumNames.length}`);

const prisma = new PrismaClient({ datasourceUrl: migrationConnectionUrl({ label: 'schema-parity-audit', readOnly: true }) });

// Bulk queries
const tables = await prisma.$queryRawUnsafe(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
  ORDER BY table_name
`);
const prodTables = new Set(tables.map(r => r.table_name));

const columns = await prisma.$queryRawUnsafe(`
  SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default, ordinal_position
  FROM information_schema.columns
  WHERE table_schema='public'
  ORDER BY table_name, ordinal_position
`);
const colsByTable = {};
for (const c of columns) {
  (colsByTable[c.table_name] ||= []).push(c);
}

const prodEnums = await prisma.$queryRawUnsafe(`
  SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname='public' AND t.typtype='e'
  GROUP BY t.typname
  ORDER BY t.typname
`);
const prodEnumMap = {};
for (const e of prodEnums) prodEnumMap[e.typname] = e.values;

const checks = await prisma.$queryRawUnsafe(`
  SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE contype='c' AND connamespace='public'::regnamespace
  ORDER BY tbl, conname
`);
const checksByTable = {};
for (const c of checks) {
  (checksByTable[c.tbl] ||= []).push(c);
}

const indexes = await prisma.$queryRawUnsafe(`
  SELECT schemaname, tablename, indexname, indexdef
  FROM pg_indexes
  WHERE schemaname='public'
  ORDER BY tablename, indexname
`);
const idxByTable = {};
for (const i of indexes) (idxByTable[i.tablename] ||= []).push(i);

// ----------------------------------------------------------------------
// Classification
// ----------------------------------------------------------------------

const results = {
  aligned: [],
  missing_in_prod: [],
  drift_shape: [],
  drift_semantic: [],
  extra_in_prod_tables: [],
  extra_in_prod_enums: [],
  enum_missing: [],
  enum_drift: [],
  enum_aligned: []
};

// Check each model
for (const [modelName, model] of Object.entries(models)) {
  if (model.ignored) continue;
  const tableName = model.mapName || modelName;
  if (!prodTables.has(tableName)) {
    results.missing_in_prod.push({ modelName, tableName });
    continue;
  }
  // Cross-reference columns
  const prodCols = colsByTable[tableName] || [];
  const prodColMap = Object.fromEntries(prodCols.map(c => [c.column_name, c]));
  const driftReasons = [];
  const shapeDrifts = [];
  const semanticDrifts = [];

  for (const f of model.fields) {
    if (f.isRelation) continue; // Prisma relation fields don't produce columns
    const colName = f.columnName;
    const prodCol = prodColMap[colName];
    if (!prodCol) {
      shapeDrifts.push(`missing column: ${colName}`);
      continue;
    }
    const exp = expectedUdt(f, enumSet);
    if (!exp.udt) {
      // Unknown type (maybe a model reference used oddly — skip)
      continue;
    }
    // For arrays, prod udt_name is prefixed with _
    const expectedProdUdt = f.array ? '_' + exp.udt : exp.udt;

    // Nullability
    const prodNullable = prodCol.is_nullable === 'YES';
    if (prodNullable !== f.optional && !f.isId) {
      // id fields from Prisma may not be marked optional but prod may differ
      shapeDrifts.push(`nullability ${colName}: prisma=${f.optional ? 'nullable' : 'NOT NULL'} prod=${prodNullable ? 'nullable' : 'NOT NULL'}`);
    }

    // Type shape — check udt_name roughly
    if (prodCol.udt_name !== expectedProdUdt) {
      // Special handling: VARCHAR vs TEXT semantic drift
      if ((exp.udt === 'text') && (prodCol.udt_name === 'varchar' || prodCol.data_type === 'character varying')) {
        semanticDrifts.push(`${colName}: VARCHAR in prod, expected TEXT`);
      } else if ((exp.udt === 'timestamp') && (prodCol.udt_name === 'timestamptz' || prodCol.data_type === 'timestamp with time zone')) {
        semanticDrifts.push(`${colName}: TIMESTAMPTZ in prod, expected TIMESTAMP(3)`);
      } else if ((exp.udt === 'timestamptz') && (prodCol.udt_name === 'timestamp' || prodCol.data_type === 'timestamp without time zone')) {
        semanticDrifts.push(`${colName}: TIMESTAMP in prod, expected TIMESTAMPTZ`);
      } else if (exp.base === 'USER-DEFINED' && prodCol.data_type === 'text') {
        // Enum-declared field stored as TEXT — check if CHECK constraint shadows
        const shadow = (checksByTable[tableName] || []).find(c =>
          c.def.includes(`(${colName} = ANY`) || c.def.includes(`("${colName}" = ANY`)
        );
        semanticDrifts.push(`${colName}: declared enum ${f.baseType} but column is TEXT${shadow ? ` (shadow CHECK: ${shadow.conname})` : ''}`);
      } else if (exp.base === 'USER-DEFINED' && prodCol.udt_name !== exp.udt) {
        shapeDrifts.push(`${colName}: expected enum ${f.baseType}, got ${prodCol.udt_name}`);
      } else {
        shapeDrifts.push(`${colName}: expected ${expectedProdUdt}, got ${prodCol.udt_name} (${prodCol.data_type})`);
      }
    }
  }

  // Indexes declared via @@index or @@unique in schema.prisma
  const prodIdxNames = new Set((idxByTable[tableName] || []).map(i => i.indexname));
  // We don't enforce naming exactly, just check at least the index on the declared columns exists
  // Prisma's naming convention: <table>_<col1>_<col2>_idx / _key
  function checkIndex(fieldsArr, suffix) {
    const colPart = fieldsArr.join('_');
    const expectedName = `${tableName}_${colPart}_${suffix}`;
    return prodIdxNames.has(expectedName);
  }
  for (const idx of model.indexes) {
    if (!checkIndex(idx, 'idx')) {
      // Try alternate name conventions; soft-warn
      shapeDrifts.push(`index declared @@index([${idx.join(', ')}]) — expected name ${tableName}_${idx.join('_')}_idx not found`);
    }
  }
  for (const u of model.uniques) {
    if (!checkIndex(u, 'key')) {
      shapeDrifts.push(`unique declared @@unique([${u.join(', ')}]) — expected name ${tableName}_${u.join('_')}_key not found`);
    }
  }

  if (shapeDrifts.length === 0 && semanticDrifts.length === 0) {
    results.aligned.push({ modelName, tableName });
  } else {
    if (shapeDrifts.length > 0) results.drift_shape.push({ modelName, tableName, issues: shapeDrifts });
    if (semanticDrifts.length > 0) results.drift_semantic.push({ modelName, tableName, issues: semanticDrifts });
  }
}

// Enums: check existence + value match
for (const [enumName, enumDef] of Object.entries(enums)) {
  const prodVals = prodEnumMap[enumName];
  if (!prodVals) {
    results.enum_missing.push({ enumName, schemaValues: enumDef.values });
    continue;
  }
  const schemaStr = enumDef.values.join(',');
  const prodStr = prodVals.join(',');
  if (schemaStr === prodStr) {
    results.enum_aligned.push(enumName);
  } else {
    results.enum_drift.push({
      enumName,
      schemaValues: enumDef.values,
      prodValues: prodVals,
      schemaMinusProd: enumDef.values.filter(v => !prodVals.includes(v)),
      prodMinusSchema: prodVals.filter(v => !enumDef.values.includes(v))
    });
  }
}

// Extras: prod objects not in schema.prisma
const schemaTableNames = new Set(modelNames.map(n => models[n].mapName || n));
for (const t of prodTables) {
  // Exclude prisma internal
  if (t.startsWith('_prisma_') || t === '_Migration') continue;
  if (!schemaTableNames.has(t)) {
    results.extra_in_prod_tables.push({ tableName: t, columnCount: (colsByTable[t] || []).length });
  }
}
for (const en of Object.keys(prodEnumMap)) {
  if (!enumSet.has(en)) {
    results.extra_in_prod_enums.push({ enumName: en, values: prodEnumMap[en] });
  }
}

// Known-concern specific checks
const knownConcerns = {};

// 1. project_participants.role
const ppChecks = checksByTable['project_participants'] || [];
knownConcerns.project_participants_role = {
  checkConstraints: ppChecks.filter(c => c.def.toLowerCase().includes('role')),
  roleColumn: (colsByTable['project_participants'] || []).find(c => c.column_name === 'role')
};

// 2. atelier VARCHAR
knownConcerns.atelier_varchar = [];
for (const tbl of ['atelier_fingerprints', 'atelier_signals']) {
  for (const col of (colsByTable[tbl] || [])) {
    if ((col.column_name === 'designerId' || col.column_name === 'vendorId')) {
      knownConcerns.atelier_varchar.push({ table: tbl, column: col.column_name, udt_name: col.udt_name, data_type: col.data_type });
    }
  }
}

// 3. priceUsd
const priceUsdCol = (colsByTable['event_invite_lists'] || []).find(c => c.column_name === 'priceUsd');
knownConcerns.priceUsd = priceUsdCol ? { udt_name: priceUsdCol.udt_name, data_type: priceUsdCol.data_type } : 'COLUMN NOT FOUND';

// 4. Timestamp distribution
const tsCounts = { 'timestamp without time zone': 0, 'timestamp with time zone': 0, 'timestamp': 0, 'timestamptz': 0 };
for (const c of columns) {
  if (c.data_type === 'timestamp without time zone' || c.data_type === 'timestamp with time zone') {
    tsCounts[c.data_type]++;
  }
}
knownConcerns.timestamp_distribution = tsCounts;

// 5. All shadow CHECK constraints pattern
const shadowChecks = [];
for (const [tbl, cs] of Object.entries(checksByTable)) {
  for (const c of cs) {
    if (/= ANY \(ARRAY\[/.test(c.def)) {
      shadowChecks.push({ table: tbl, name: c.conname, def: c.def });
    }
  }
}
knownConcerns.shadow_checks = shadowChecks;

// ----------------------------------------------------------------------
// Output
// ----------------------------------------------------------------------

console.log(JSON.stringify({
  counts: {
    modelsInSchema: modelNames.length,
    enumsInSchema: enumNames.length,
    tablesInProd: prodTables.size,
    enumsInProd: Object.keys(prodEnumMap).length
  },
  classificationSummary: {
    aligned: results.aligned.length,
    missing_in_prod: results.missing_in_prod.length,
    drift_shape: results.drift_shape.length,
    drift_semantic: results.drift_semantic.length,
    extra_in_prod_tables: results.extra_in_prod_tables.length,
    enum_aligned: results.enum_aligned.length,
    enum_missing: results.enum_missing.length,
    enum_drift: results.enum_drift.length,
    extra_in_prod_enums: results.extra_in_prod_enums.length
  },
  missing_in_prod: results.missing_in_prod,
  drift_shape: results.drift_shape,
  drift_semantic: results.drift_semantic,
  extra_in_prod_tables: results.extra_in_prod_tables,
  enum_missing: results.enum_missing,
  enum_drift: results.enum_drift,
  extra_in_prod_enums: results.extra_in_prod_enums,
  knownConcerns
}, null, 2));

await prisma.$disconnect();
