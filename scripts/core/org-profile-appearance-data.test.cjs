const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const h = require('./harness.cjs');
const { getOrgProfileAppearanceData } = require(resolve('src/lib/server/org-profile-appearance.ts'));
const { defaultOrgAppearance } = require(resolve('src/lib/org-profile-appearance.ts'));

const imageId = '19c69c1b-940f-445b-bca4-f43a9e405a23';
const photo = { id: imageId, url: 'https://storage.test/public-cover.jpg' };
const project = { id: 'project', title: 'Published work', images: [photo] };
const organization = appearance => ({
  id: 'firm', name: 'Sample studio', type: 'DESIGN_FIRM', logo: null,
  description: 'Supported studio introduction.', tagline: null, location: null,
  foundedYear: null, specialties: [], serviceRegions: [], projectTypes: [],
  teamSizeRange: null, profileAppearance: appearance,
});

function database({ appearance = null, choices = [project], selected = null, missing = false } = {}) {
  return {
    organization: { findUnique: async query => {
      assert.deepEqual(query.where, { id: 'firm' });
      assert.equal(query.select.profileAppearance, true);
      assert.equal(query.select.bankAccountInfo, undefined);
      assert.equal(query.select.users, undefined);
      return missing ? null : organization(appearance);
    } },
    project: {
      count: async query => {
        assert.deepEqual(query.where, { designerOrgId: 'firm', isPublic: true });
        return 4;
      },
      findMany: async query => {
        assert.deepEqual(query.where, { designerOrgId: 'firm', isPublic: true });
        assert.deepEqual(query.select.images.where, { inclusion: 'INCLUDED' });
        assert.ok(query.take * query.select.images.take <= 60);
        assert.deepEqual(query.select.images.select, { id: true, url: true });
        return structuredClone(choices);
      },
    },
    projectImage: { findFirst: async query => {
      assert.deepEqual(query.where, {
        id: imageId, inclusion: 'INCLUDED', project: { designerOrgId: 'firm', isPublic: true },
      });
      return selected;
    } },
  };
}

test('an unconfigured public organization uses existing safe facts and an eligible cover', async () => {
  h.useDatabase(database());
  const data = await getOrgProfileAppearanceData('firm');
  assert.equal(data.org.name, 'Sample studio');
  assert.equal(data.projectCount, 4);
  assert.deepEqual(data.appearance, defaultOrgAppearance());
  assert.deepEqual(data.cover, { url: photo.url, projectTitle: project.title });
  assert.equal('profileAppearance' in data.org, false);
});

test('a selected cover outside the bounded picker is resolved and included for preview', async () => {
  const appearance = { ...defaultOrgAppearance(), cover: { kind: 'project', imageId } };
  h.useDatabase(database({ appearance, choices: [], selected: { ...photo, project: { id: 'older', title: 'Earlier work' } } }));
  const data = await getOrgProfileAppearanceData('firm');
  assert.deepEqual(data.cover, { url: photo.url, projectTitle: 'Earlier work' });
  assert.deepEqual(data.projects, [{ id: 'older', title: 'Earlier work', images: [photo] }]);
});

test('a withdrawn, excluded or reassigned selection cannot survive an earlier picker result', async () => {
  const appearance = { ...defaultOrgAppearance(), cover: { kind: 'project', imageId } };
  h.useDatabase(database({ appearance, selected: null }));
  const data = await getOrgProfileAppearanceData('firm');
  assert.equal(data.cover, null);
  assert.equal(data.projects.flatMap(item => item.images).length, 0);
});

test('a revalidated selected image is not duplicated in the picker', async () => {
  const appearance = { ...defaultOrgAppearance(), cover: { kind: 'project', imageId } };
  h.useDatabase(database({ appearance, selected: { ...photo, project: { id: project.id, title: project.title } } }));
  const data = await getOrgProfileAppearanceData('firm');
  assert.deepEqual(data.projects, [project]);
});

test('choosing no cover is respected even when public photographs exist', async () => {
  h.useDatabase(database({ appearance: { ...defaultOrgAppearance(), cover: { kind: 'none' } } }));
  assert.equal((await getOrgProfileAppearanceData('firm')).cover, null);
});

test('missing organizations do not return an appearance payload', async () => {
  h.useDatabase(database({ missing: true }));
  assert.equal(await getOrgProfileAppearanceData('firm'), null);
});
