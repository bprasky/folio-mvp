// Actual matching, authenticated route handlers and room creation; synthetic DB boundary.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { roomNameOptions, suggestRoomNames, roomNameKey, STANDARD_ROOM_NAMES } = require('../src/lib/rooms/roomNames.ts');
const h = require('./core/harness.cjs');
const { memoryDatabase } = require('./core/memory-db.cjs');
const { factories } = require('./core/fixtures.cjs');

async function main() {
  assert(STANDARD_ROOM_NAMES.length >= 250);
  assert.equal(new Set(STANDARD_ROOM_NAMES.map(roomNameKey)).size, STANDARD_ROOM_NAMES.length);
  const options = roomNameOptions([{ id: 'living', name: 'Living room' }], ['Flower Studio', 'LIVING ROOM']);
  assert.equal(options.filter(option => roomNameKey(option.name) === 'living room').length, 1);
  assert.equal(suggestRoomNames('LIV', options).matches[0].roomId, 'living');
  assert.equal(suggestRoomNames('flower', options).matches[0].source, 'saved');
  for (const typo of ['lving room', 'livign room', 'living rom']) assert.equal(suggestRoomNames(typo, options).correction.roomId, 'living');
  for (const custom of ["Luca's bedroom", 'Bedroom 2', 'North Gallery', 'Living Room Upstairs']) assert.equal(suggestRoomNames(custom, options).correction, undefined);
  assert.equal(suggestRoomNames('  LIVING   ROOM ', options).exact.roomId, 'living');
  assert.equal(roomNameKey('Butler’s   Pantry'), roomNameKey("Butler's Pantry"));
  assert.equal(suggestRoomNames('butlers p', options).matches[0].name, "Butler's Pantry");
  assert.equal(suggestRoomNames('cafe', options).matches[0].name, 'Café');
  assert.equal(suggestRoomNames('walk in cl', options).matches[0].name, 'Walk-in Closet');
  assert.equal(suggestRoomNames('kit', options).completion.name, 'Kitchen', 'a typed prefix completes on Enter');
  for (const [typed, offered] of [['Cellar', 'Wine Cellar'], ['Suite', 'Primary Suite'], ['Nook', 'Breakfast Nook'], ['Guest', 'Guest Suite'], ['Hall', 'Hallway']]) {
    const result = suggestRoomNames(typed, options);
    assert.ok(result.matches.some(option => option.name === offered), `${typed} still offers ${offered}`);
    assert.equal(result.completion, undefined, `${typed} is a complete custom name, not a prefix of ${offered}`);
  }
  console.log('PASS prefix, private options, normalization, typo and custom-name matching');

  const db = memoryDatabase(); h.useDatabase(db); const f = factories(db);
  const a = await f.user({ role: 'DESIGNER' }), b = await f.user({ role: 'DESIGNER' });
  const route = h.route('me/room-names');
  assert.equal((await route.GET()).status, 401);
  assert.equal((await route.POST(h.request({ name: 'Flower Studio' }))).status, 401);
  assert.equal((await route.DELETE(h.request({ name: 'Flower Studio' }, 'DELETE'))).status, 401);
  await h.login(a);
  for (const body of [{ name: '' }, { name: ' '.repeat(4) }, { name: 'x'.repeat(121) }, { name: 'Room\nName' }, { name: 'Flower Studio', userId: b.id }]) {
    assert.equal((await route.POST(h.request(body))).status, 400);
  }
  for (const name of ['Flower Studio', '  FLOWER STUDIO  ']) assert.equal((await route.POST(h.request({ name }))).status, 200);
  assert.deepEqual(await (await route.GET()).json(), { names: ['Flower Studio'] });
  assert.equal((await route.GET()).headers.get('cache-control'), 'private, no-store');
  await h.login(b);
  assert.deepEqual(await (await route.GET()).json(), { names: [] });
  await route.DELETE(h.request({ name: 'Flower Studio' }, 'DELETE'));
  assert.deepEqual(await (await route.GET()).json(), { names: [] });
  await h.login(a);
  assert.deepEqual(await (await route.GET()).json(), { names: ['Flower Studio'] });
  await route.DELETE(h.request({ name: 'flower studio' }, 'DELETE'));
  assert.deepEqual(await (await route.GET()).json(), { names: [] });
  console.log('PASS authentication, validation, idempotence and two-account privacy for list/save/remove');

  const { createRoomOnce } = require('../src/lib/projects/createRoom.ts');
  const project = await f.project(a.id), other = await f.project(b.id);
  const room = await f.room(project.id, { name: 'Living Room' });
  let locks = 0;
  db.$queryRaw = async (sql, id) => { assert.match(sql.join('?'), /SELECT id FROM projects WHERE id = \? FOR UPDATE/); assert([project.id, other.id].includes(id)); locks++; return [{ id }]; };
  const reused = await createRoomOnce(a.id, project.id, { name: ' living  room ', requestId: randomUUID(), reuseExisting: true });
  assert.equal(reused.id, room.id);
  const custom = await createRoomOnce(a.id, project.id, { name: "Luca's bedroom", requestId: randomUUID(), reuseExisting: true });
  assert.equal(custom.name, "Luca's bedroom");
  const retry = await createRoomOnce(a.id, project.id, { name: "Luca's bedroom", requestId: randomUUID(), reuseExisting: true });
  assert.equal(retry.id, custom.id);
  const foreign = await createRoomOnce(b.id, other.id, { name: 'Living Room', requestId: randomUUID(), reuseExisting: true });
  assert.notEqual(foreign.id, room.id); assert.equal(locks, 4);
  assert.equal(await db.userRoomName.count(), 0, 'Creating project rooms never saves personal vocabulary');
  assert.equal(h.unexpectedNetwork.length, 0);
  console.log('PASS project-scoped room reuse and partial-assignment retry without implicit saved options');

  // Exercise the real SQL twice, composite uniqueness, cascade and anonymous RLS.
  const { PGlite } = require('@electric-sql/pglite');
  const pg = new PGlite();
  try {
    await pg.exec('CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES (\'a\'), (\'b\');');
    const sql = readFileSync('prisma/migrations/20261117170000_private_room_names/migration.sql', 'utf8');
    await pg.exec(sql); await pg.exec(sql);
    await pg.query('INSERT INTO user_room_names ("userId", "normalizedName", name) VALUES ($1,$2,$3)', ['a', 'flower studio', 'Flower Studio']);
    await assert.rejects(pg.query('INSERT INTO user_room_names ("userId", "normalizedName", name) VALUES ($1,$2,$3)', ['a', 'flower studio', 'Flower Studio']));
    await pg.exec('CREATE ROLE room_anon; GRANT USAGE ON SCHEMA public TO room_anon; GRANT SELECT ON user_room_names TO room_anon; SET ROLE room_anon;');
    assert.equal((await pg.query('SELECT * FROM user_room_names')).rows.length, 0);
    await pg.exec('RESET ROLE; DELETE FROM users WHERE id = \'a\';');
    assert.equal((await pg.query('SELECT * FROM user_room_names')).rows.length, 0);
  } finally { await pg.close(); }
  console.log('PASS real migration replay, unique keys, RLS and user deletion cascade (disposable PostgreSQL)');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
