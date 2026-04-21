import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const delegates = [
  // Events cluster (12 — 11 restored in appendix + EventMetrics renamed in place)
  'eventHostProfile', 'eventContact', 'eventInviteList', 'eventTargetingProfile',
  'eventRelationshipEdge', 'eventVendorEdge', 'eventDesignerEdge', 'eventProductEdge',
  'eventRepEdge', 'eventEngagementMetrics', 'eventInvite', 'eventMetrics',
  // Interviews (4)
  'interviewSession', 'mediaAsset', 'quoteHighlight', 'transcriptSegment',
  // Project-collab (2)
  'actionItem', 'noteAttachment',
  // Vendor-intake (2)
  'vendorBoostRequest', 'vendorInviteCandidate',
  // Posts (2)
  'post', 'postItem',
];

const results = [];
for (const d of delegates) {
  try {
    const count = await prisma[d].count();
    results.push({ delegate: d, ok: true, count });
  } catch (err) {
    results.push({ delegate: d, ok: false, error: err.message.split('\n')[0] });
  }
}

console.log(JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\nSummary: ${results.length - failed.length}/${results.length} delegates OK`);
await prisma.$disconnect();
