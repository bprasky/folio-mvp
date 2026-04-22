import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const tables = [
  'three_d_assets', 'threedassets', 'three_dassets',
  'vendor_discovery_budgets',
  'analytics_events',
  'project_members',
  'affiliate_links',
  'vendor_invite_contacts',
];

const rows = await prisma.$queryRawUnsafe(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema='public' AND table_name = ANY($1::text[])`,
  tables,
);

console.log('Tables that actually exist:', rows.map(r => r.table_name));
console.log('Expected: [] (all are phantoms)');
await prisma.$disconnect();
