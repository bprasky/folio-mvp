#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const adapter = read('src/lib/project-memory/source-adapters.ts');
const route = read('src/app/api/projects/[id]/memory-digest/route.ts');
const digest = read('src/lib/project-memory/digest.ts');
assert.match(adapter, /await assertProjectWrite\(actorId, projectId\)/);
assert.ok(adapter.indexOf('await assertProjectWrite') < adapter.indexOf('prisma.project.findUnique'));
assert.doesNotMatch(adapter, /fileUrl:\s*true|url:\s*true|audioUrl:\s*true|clientBriefExcerpt:\s*true/);
assert.match(route, /getServerSession\(authOptions\)/);
assert.match(route, /Cache-Control': 'private, no-store'/);
assert.match(digest, /sourceDigest/);
assert.match(adapter, /metadata only/);
console.log('PASS: project-memory digest auth, bounded metadata and private caching contract');
