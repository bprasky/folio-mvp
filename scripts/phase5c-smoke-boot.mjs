import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const tables = [
  'instagramExport',
  'instagramCampaign',
  'instagramCampaignPost',
  'emailThread',
  'emailMessage',
  'proxyAddress',
  'contactImportJob',
  'designerContact',
  'notification',
  'media',
  'recognition',
  'collaboration',
];

const results = [];
for (const table of tables) {
  try {
    const count = await prisma[table].count();
    results.push({ table, ok: true, count });
  } catch (err) {
    results.push({ table, ok: false, error: err.message });
  }
}

try {
  const rows = await prisma.projectParticipant.findMany({ take: 1, select: { role: true, side: true } });
  results.push({ table: 'projectParticipant (enum round-trip)', ok: true, sample: rows[0] ?? null });
} catch (err) {
  results.push({ table: 'projectParticipant (enum round-trip)', ok: false, error: err.message });
}

console.log(JSON.stringify(results, null, 2));
await prisma.$disconnect();
