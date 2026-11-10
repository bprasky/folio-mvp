#!/usr/bin/env node
// Regression guard: public module feeds must enforce parent-project visibility
// inside the database query, before any media or project metadata is returned.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readers = [
  'src/lib/feed/getRecentProjectModules.ts',
  'src/lib/feed/getUpdatesCarousel.ts',
];
for (const reader of readers) {
  const source = fs.readFileSync(path.join(__dirname, '..', reader), 'utf8');
  const query = source.match(/prisma\.projectModule\.findMany\(\{([\s\S]*?)\n\s*orderBy:/);
  assert.ok(query, `${reader}: expected a module findMany query`);
  const where = query[1];
  assert.match(where, /publishedAt:\s*\{\s*not:\s*null,\s*lte:\s*new Date\(\)\s*\}/, `${reader}: must require already published module and exclude future publication dates`);
  assert.match(where, /project:\s*\{\s*isPublic:\s*true\s*,\s*post:\s*\{\s*is:\s*\{\s*status:\s*["']PUBLISHED["']\s*\}\s*\}\s*\}/,
    `${reader}: parent must be public with published post`);
  console.log(`PASS ${reader}: published module + public project + published post`);
}
console.log('Public module feed visibility guards verified (static regression).');
