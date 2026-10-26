const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createProjectDraftWriter } = require('../../src/lib/projects/saveProjectDraft.ts');

test('draft, autosave and continue retain one project and the latest saved values', async () => {
  const rows = new Map(), calls = [];
  let release;
  const first = new Promise(resolve => { release = resolve; });
  const save = createProjectDraftWriter(async (url, request) => {
    assert.equal(url, '/api/projects');
    const data = JSON.parse(request.body);
    calls.push(request.method);
    if (request.method === 'POST') {
      await first;
      rows.set('fixture-project', { ...data, id: 'fixture-project', isPublic: false });
      return Response.json({ id: 'fixture-project' }, { status: 201 });
    }
    assert.equal(data.id, 'fixture-project');
    rows.set(data.id, { ...rows.get(data.id), ...data });
    return Response.json(rows.get(data.id));
  });
  const draft = save({ title: 'Fixture home', projectStatus: 'new_project' });
  const edits = { title: 'Fixture home revised', completedYear: 2020, completedMonth: null, city: 'Fixture city' };
  const autosave = save(edits);
  edits.city = 'Not submitted';
  const continuation = save({ title: 'Fixture home final', completedYear: 2021, completedMonth: 4 });
  assert.deepEqual(calls, ['POST'], 'writes wait for the first persisted identity');
  release();
  assert.deepEqual(await Promise.all([draft, autosave, continuation]), Array(3).fill('fixture-project'));
  assert.deepEqual(calls, ['POST', 'PUT', 'PUT']);
  assert.equal(rows.size, 1);
  assert.equal(rows.get('fixture-project').title, 'Fixture home final');
  assert.equal(rows.get('fixture-project').city, 'Fixture city');
  assert.equal(rows.get('fixture-project').completedYear, 2021);
  assert.equal(rows.get('fixture-project').completedMonth, 4);
  assert.equal(rows.get('fixture-project').isPublic, false);
});

test('failed updates reject without forgetting the saved ID; retry updates the same project', async () => {
  let fail = false;
  const calls = [], row = { id: 'fixture-project', title: 'Saved' };
  const save = createProjectDraftWriter(async (_url, request) => {
    calls.push(request.method);
    if (fail) return Response.json({ error: 'Fixture outage' }, { status: 503 });
    Object.assign(row, JSON.parse(request.body));
    return Response.json(row);
  });
  await save({ title: 'Saved' });
  fail = true;
  await assert.rejects(save({ title: 'Unsaved' }), /Fixture outage/);
  assert.equal(row.title, 'Saved');
  fail = false;
  await save({ title: 'Retried' });
  assert.deepEqual(calls, ['POST', 'PUT', 'PUT']);
  assert.equal(row.title, 'Retried');
});

test('successful HTTP without confirmed identity cannot acknowledge a saved draft', async () => {
  for (const response of [Response.json({}), Response.json({ id: 42 }), new Response('not json')]) {
    await assert.rejects(createProjectDraftWriter(async () => response)({ title: 'Fixture' }), /did not confirm/);
  }
  let count = 0;
  const save = createProjectDraftWriter(async () => Response.json({ id: ++count === 1 ? 'fixture-project' : 'wrong-project' }));
  await save({ title: 'Fixture' });
  await assert.rejects(save({ title: 'Edited' }), /did not confirm/);
});

test('network rejection and server validation errors never report success', async () => {
  await assert.rejects(createProjectDraftWriter(async () => { throw new Error('Fixture offline'); })({}), /Fixture offline/);
  await assert.rejects(createProjectDraftWriter(async () => Response.json({ message: 'Invalid completion date' }, { status: 422 }))({}), /Invalid completion date/);
});
