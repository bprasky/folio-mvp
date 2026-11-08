import assert from 'node:assert/strict';
import { buildPrivateDigest, type ProjectEvidence } from '../src/lib/project-memory/digest';
import { suggestProjectStories } from '../src/lib/project-memory/opportunities';

const evidence: ProjectEvidence[] = [
  { id: 'change:1', sourceId: '1', kind: 'selection_change', recordedAt: '2026-01-01T00:00:00.000Z',
    occurredAtBasis: 'recorded', roomId: 'kitchen', text: 'swapped — availability', attribution: 'structured' },
  { id: 'interview:1', sourceId: 'i1', kind: 'interview', recordedAt: '2026-01-02T00:00:00.000Z',
    occurredAtBasis: 'recorded', roomId: 'kitchen',
    text: 'We wanted to find a different material that would still work in the room.', attribution: 'direct' },
  { id: 'image:1', sourceId: 'p1', kind: 'image', recordedAt: '2026-01-03T00:00:00.000Z',
    occurredAtBasis: 'recorded', text: 'Uploaded project photo', attribution: 'metadata' },
];
const digest = buildPrivateDigest({ projectId: 'p', title: 'Kitchen', evidence, generatedAt: '2026-01-04T00:00:00.000Z' });
const reordered = buildPrivateDigest({ projectId: 'p', title: 'Kitchen', evidence: [...evidence].reverse(), generatedAt: '2026-02-04T00:00:00.000Z' });
assert.equal(digest.sourceDigest, reordered.sourceDigest, 'digest must not depend on read order or generation date');
const suggestions = suggestProjectStories(digest);
assert.ok(suggestions.length > 0 && suggestions.length <= 3);
assert.deepEqual(suggestions[0].evidenceIds, ['change:1', 'interview:1']);
assert.match(suggestions[0].missingPiece, /confirm/i);
assert.equal(suggestions[0].status, 'suggestion');
assert.ok(suggestions.every(s => s.evidenceIds.every(id => evidence.some(e => e.id === id))));
const sparse = buildPrivateDigest({ projectId: 'p', title: 'Empty', evidence: [evidence[2]] });
assert.deepEqual(suggestProjectStories(sparse), [], 'photo metadata alone cannot substantiate a narrative');
const solo = buildPrivateDigest({ projectId: 'p', title: 'Solo', evidence: [evidence[0]] });
assert.equal(suggestProjectStories(solo)[0].confidence, 'needs_clarification');
const changed = buildPrivateDigest({ projectId: 'p', title: 'Kitchen', evidence: [{ ...evidence[0], text: 'swapped — budget' }, evidence[1]] });
assert.notEqual(digest.sourceDigest, changed.sourceDigest, 'changed source evidence must invalidate digest');
console.log('PASS: private digest and evidence-linked story suggestion fixtures');
