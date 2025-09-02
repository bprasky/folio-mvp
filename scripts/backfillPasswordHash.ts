// DEV-ONLY: Remove before production deployment
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { passwordHash: '' },
    select: { id: true, email: true },
  });

  if (!users.length) {
    console.log('No users require backfill.');
    return;
  }

  // Dev-only default; change before shipping to prod.
  const TEMP_DEFAULT = 'Temp!12345';

  for (const u of users) {
    const hash = await bcrypt.hash(TEMP_DEFAULT, 12);
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: hash } });
    console.log(`Backfilled: ${u.email}`);
  }

  console.log('Backfill complete.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
