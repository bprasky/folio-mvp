import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const delegates = [
  'projectProductTag', 'meetingNote', 'vendor', 'vendorPreviewToken',
  'pendingRepInvite', 'vendorProductMatchScore', 'roomIntent',
  'projectLifecycleScore', 'projectIntent', 'designerActivityProfile',
  'proximityToPurchaseIndicator', 'follow', 'editorialDraft',
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

try {
  const row = await prisma.actionItem.findFirst({ include: { productTag: true, sourceNote: true } });
  results.push({ traversal: 'actionItem→productTag+sourceNote', ok: true, sampleExists: row !== null });
} catch (err) {
  results.push({ traversal: 'actionItem→productTag+sourceNote', ok: false, error: err.message.split('\n')[0] });
}

try {
  const row = await prisma.vendorBoostRequest.findFirst({ include: { vendor: true } });
  results.push({ traversal: 'vendorBoostRequest→vendor', ok: true, sampleExists: row !== null });
} catch (err) {
  results.push({ traversal: 'vendorBoostRequest→vendor', ok: false, error: err.message.split('\n')[0] });
}

console.log(JSON.stringify(results, null, 2));
const failed = results.filter(r => !r.ok);
console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed`);
await prisma.$disconnect();
