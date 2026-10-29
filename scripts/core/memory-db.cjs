// Deterministic orchestration double, NOT a database/persistence emulator.
// Only the query operators exercised by this suite are supported; others throw.
const { Prisma } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

function memoryDatabase() {
  const models = new Map(Prisma.dmmf.datamodel.models.map(m => [m.name, m]));
  const tables = new Map([...models.keys()].map(name => [name, []]));
  const calls = [];
  const clone = value => structuredClone(value);
  const equal = (a, b) => a instanceof Date || b instanceof Date ? +new Date(a) === +new Date(b) : a === b;
  function relation(model, row, field) {
    const target = models.get(field.type);
    if (field.relationFromFields.length) {
      return tables.get(target.name).find(other => field.relationFromFields.every((fk, i) => equal(row[fk], other[field.relationToFields[i]]))) || null;
    }
    const inverse = target.fields.find(f => f.relationName === field.relationName && f.relationFromFields?.length);
    if (!inverse) throw Error(`Unsupported relation ${model.name}.${field.name}`);
    const related = tables.get(target.name).filter(other => inverse.relationFromFields.every((fk, i) => equal(other[fk], row[inverse.relationToFields[i]])));
    return field.isList ? related : related[0] || null;
  }
  function matches(model, row, where = {}) {
    return Object.entries(where).every(([key, value]) => {
      if (value === undefined) return true;
      if (key === 'AND') return [value].flat().every(w => matches(model, row, w));
      if (key === 'OR') return value.some(w => matches(model, row, w));
      if (key === 'NOT') return ![value].flat().some(w => matches(model, row, w));
      const field = model.fields.find(f => f.name === key);
      if (!field) {
        if (model.uniqueFields.some(fields => fields.join('_') === key)) return matches(model, row, value);
        throw Error(`Unknown query field ${model.name}.${key}`);
      }
      const actual = field.kind === 'object' ? relation(model, row, field) : row[key];
      if (field.kind === 'object') {
        const target = models.get(field.type);
        if (value === null) return actual === null;
        if ('some' in value) return actual.some(r => matches(target, r, value.some));
        if ('none' in value) return !actual.some(r => matches(target, r, value.none));
        return actual !== null && matches(target, actual, value.is || value);
      }
      if (value === null || typeof value !== 'object' || value instanceof Date || Array.isArray(value)) return equal(actual, value);
      return Object.entries(value).every(([op, expected]) => {
        const text = v => value.mode === 'insensitive' ? String(v).toLowerCase() : String(v);
        if (op === 'mode') return true;
        if (op === 'equals') {
          if (field.type === 'Json') return expected === Prisma.DbNull ? actual === null : isDeepStrictEqual(actual, expected);
          return text(actual) === text(expected);
        }
        if (op === 'in') return expected.includes(actual);
        if (op === 'notIn') return !expected.includes(actual);
        if (op === 'not') return !equal(actual, expected);
        if (op === 'contains') return text(actual).includes(text(expected));
        if (op === 'gte') return actual >= expected;
        if (op === 'lte') return actual <= expected;
        if (op === 'gt') return actual > expected;
        if (op === 'lt') return actual < expected;
        throw Error(`Unsupported operator ${op}`);
      });
    });
  }
  function project(model, row, args = {}) {
    if (!row) return null;
    const output = args.select ? {} : clone(row);
    for (const [name, spec] of Object.entries(args.select || args.include || {})) {
      if (!spec) continue;
      if (name === '_count') {
        output._count = Object.fromEntries(Object.entries(spec.select).map(([key, selection]) => {
          const field = model.fields.find(f => f.name === key);
          return [key, relation(model, row, field).filter(item => matches(models.get(field.type), item, selection.where)).length];
        }));
        continue;
      }
      const field = model.fields.find(f => f.name === name);
      if (!field) throw Error(`Unknown projection ${model.name}.${name}`);
      if (field.kind !== 'object') output[name] = clone(row[name]);
      else {
        const value = relation(model, row, field), target = models.get(field.type);
        output[name] = Array.isArray(value) ? value.filter(v => matches(target, v, spec.where)).map(v => project(target, v, spec)) : project(target, value, spec);
      }
    }
    return output;
  }
  function apply(model, row, data) {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      const field = model.fields.find(f => f.name === key);
      if (!field) throw Error(`Unknown write field ${model.name}.${key}`);
      if (field.kind === 'object') throw Error(`Nested writes not supported: ${model.name}.${key}`);
      row[key] = field.type !== 'Json' && value && typeof value === 'object' && 'increment' in value ? (row[key] || 0) + value.increment : clone(value);
    }
    if (model.fields.some(f => f.name === 'updatedAt')) row.updatedAt = new Date();
    return row;
  }
  const db = { calls, $disconnect: async () => {}, $transaction: async work => typeof work === 'function' ? work(db) : Promise.all(work),
    $queryRaw: async (sql, first, second) => {
      if (sql.join('').includes('organization_users')) return tables.get('OrganizationUser').filter(m => m.userId === first && m.organizationId === second).map(m => ({ id: m.id }));
      // Enrollment identity lookup only; this double does not implement SQL or locks.
      if (sql.join('').includes("lower(regexp_replace(btrim(name)")) {
        const normalize = name => name.trim().replace(/\s+/g, ' ').toLowerCase();
        return tables.get('Organization').filter(o => normalize(o.name) === first && o.id !== second).sort((a, b) => +a.createdAt - +b.createdAt || a.id.localeCompare(b.id)).slice(0, 1).map(clone);
      }
      if (sql.join('').includes('FROM projects WHERE')) return tables.get('Project').filter(i => i.id === first).map(i => ({ id: i.id })); // lock ordering only
      if (sql.join('').includes('FROM organizations')) return tables.get('Organization').filter(o => o.id === first).map(clone);
      if (sql.join('').includes('operatingAsOrgId')) return tables.get('User').filter(u => u.id === first).map(u => ({ operatingAsOrgId: u.operatingAsOrgId }));
      throw Error('Unexpected raw SQL in local orchestration test');
    },
    $executeRaw: async (sql, orgId, userId) => {
      if (sql.join('').trim() === 'SELECT pg_advisory_xact_lock(73194, 2049)') return 1; // ordering only, no database concurrency proof
      if (!sql.join('').includes('UPDATE users SET "operatingAsOrgId"')) throw Error('Unexpected raw SQL mutation');
      const user = tables.get('User').find(u => u.id === userId); user.operatingAsOrgId = orgId; return 1;
    } };
  for (const model of models.values()) {
    const rows = tables.get(model.name);
    db[model.name[0].toLowerCase() + model.name.slice(1)] = new Proxy({}, { get: (_, method) => async (args = {}) => {
      calls.push({ model: model.name, method, args: clone(args) });
      const found = () => rows.filter(row => matches(model, row, args.where));
      if (method === 'findMany') return found().slice(args.skip || 0, args.take ? (args.skip || 0) + args.take : undefined).map(row => project(model, row, args));
      if (method === 'count') return found().length;
      if (['findUnique', 'findFirst', 'findUniqueOrThrow', 'findFirstOrThrow'].includes(method)) {
        const row = found()[0];
        if (!row && method.endsWith('OrThrow')) throw Error('Record not found');
        return project(model, row, args);
      }
      if (method === 'delete') { const row = found()[0]; if (!row) throw Error('Record not found'); const result = project(model, row, args); rows.splice(rows.indexOf(row), 1); return result; }
      if (method === 'deleteMany') { const selected = found(); selected.forEach(row => rows.splice(rows.indexOf(row), 1)); return { count: selected.length }; }
      if (method === 'updateMany') { const selected = found(); selected.forEach(row => apply(model, row, args.data)); return { count: selected.length }; }
      if (method === 'update' || method === 'upsert' && found().length) {
        const row = found()[0]; if (!row) throw Error('Record not found');
        return project(model, apply(model, row, args.update || args.data), args);
      }
      if (method === 'create' || method === 'upsert') {
        const row = Object.fromEntries(model.fields.filter(f => f.kind !== 'object').map(f => [f.name,
          f.isList ? [] : f.default?.name === 'now' || f.isUpdatedAt ? new Date() : f.default?.name === 'uuid' || f.default?.name === 'cuid' ? randomUUID() : f.default !== undefined && typeof f.default !== 'object' ? f.default : null]));
        apply(model, row, args.create || args.data);
        rows.push(row); return project(model, row, args);
      }
      throw Error(`Unsupported operation ${model.name}.${String(method)}`);
    } });
  }
  return db;
}
module.exports = { memoryDatabase };
