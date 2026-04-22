import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

console.log('=== A. instagram_campaigns / instagram_campaign_posts / instagram_exports in prod ===');
const instagramTables = await prisma.$queryRawUnsafe(
  `select table_name from information_schema.tables
     where table_schema='public'
       and table_name in ('instagram_campaigns','instagram_campaign_posts','instagram_exports')
   order by table_name`
);
console.log(instagramTables);

console.log('\n=== B. project_participants.role column shape in prod ===');
const roleCol = await prisma.$queryRawUnsafe(
  `select column_name, data_type, udt_name
     from information_schema.columns
     where table_schema='public' and table_name='project_participants' and column_name='role'`
);
console.log(roleCol);

console.log('\n=== C. ParticipantRole enum exists? ===');
const enumValues = await prisma.$queryRawUnsafe(
  `select enum_range(null::"ParticipantRole")::text as values`
).catch(e => ({ error: e.message.split('\n')[0] }));
console.log(enumValues);

await prisma.$disconnect();
