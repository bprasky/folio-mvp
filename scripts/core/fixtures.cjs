const { randomUUID } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { parse } = require('dotenv');

function disposableTarget(env = process.env) {
  const target = env.CORE_TEST_DATABASE_URL;
  if (!target) return null;
  if (env.CORE_TEST_DATABASE_DISPOSABLE !== '1') throw Error('CORE_TEST_DATABASE_DISPOSABLE=1 is required');
  const url = new URL(target);
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw Error('Test target must be PostgreSQL');
  const configured = [env.DATABASE_URL, env.DIRECT_URL];
  for (const file of ['.env', '.env.local']) {
    if (existsSync(file)) { const values = parse(readFileSync(file)); configured.push(values.DATABASE_URL, values.DIRECT_URL); }
  }
  for (const value of configured.filter(Boolean)) {
    const app = new URL(value);
    // Reject shared remote hosts as well as identical DBs. Pooler/direct aliases
    // can refer to the same production database; no schema-name escape hatch.
    if (url.hostname === app.hostname && (url.pathname === app.pathname || !['localhost', '127.0.0.1', '::1'].includes(url.hostname))) {
      throw Error('Refusing configured application database host/identity');
    }
    if (url.username.includes('.') && url.username === app.username) throw Error('Refusing application pooler identity');
  }
  if (!/test|disposable/i.test(url.pathname)) throw Error('Disposable database name must contain test or disposable');
  return target;
}

function factories(db) {
  const user = (overrides = {}) => { const id = randomUUID(); return db.user.create({ data: {
    id, email: `${id}@core.test`, name: 'Core Designer', role: 'DESIGNER', accountStatus: 'APPROVED',
    passwordHash: 'fixture-not-a-login', specialties: [], desiredRooms: [], ...overrides,
  } }); };
  const organization = (overrides = {}) => db.organization.create({ data: { id: randomUUID(), name: 'Core Firm', type: 'DESIGN_FIRM', status: 'CLAIMED', ...overrides } });
  const membership = (userId, organizationId, overrides = {}) => db.organizationUser.create({ data: { userId, organizationId, role: 'OWNER', isActive: true, ...overrides } });
  const product = (overrides = {}) => db.product.create({ data: { id: randomUUID(), name: 'Core Chair', brand: 'Core Workshop', url: 'https://product.test/chair', imageUrl: 'https://storage.test/chair.png', ...overrides } });
  const project = (ownerId, overrides = {}) => db.project.create({ data: { id: randomUUID(), title: 'Core House', ownerId, designerId: ownerId, ...overrides } });
  const room = (projectId, overrides = {}) => db.room.create({ data: { projectId, name: 'Living Room', ...overrides } });
  const image = (projectId, overrides = {}) => db.projectImage.create({ data: { projectId, url: 'https://storage.test/room.png', noProducts: true, ...overrides } });
  return { user, organization, membership, product, project, room, image };
}
module.exports = { disposableTarget, factories };
