/**
 * Script to set bp@folioad.com as SUPER_ADMIN
 *
 * Usage: npx tsx scripts/set-super-admin.ts
 *
 * This script should be run after the migration to set the initial super admin.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = 'bp@folioad.com';

async function main() {
  console.log(`Setting ${SUPER_ADMIN_EMAIL} as SUPER_ADMIN...`);

  const user = await prisma.user.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
    select: { id: true, email: true, name: true, role: true, adminRole: true },
  });

  if (!user) {
    console.error(`User with email ${SUPER_ADMIN_EMAIL} not found.`);
    process.exit(1);
  }

  console.log('Current user state:', user);

  const updated = await prisma.user.update({
    where: { email: SUPER_ADMIN_EMAIL },
    data: {
      role: 'ADMIN', // Ensure role is ADMIN
      adminRole: 'SUPER_ADMIN',
    },
    select: { id: true, email: true, name: true, role: true, adminRole: true },
  });

  console.log('Updated user state:', updated);
  console.log(`Successfully set ${SUPER_ADMIN_EMAIL} as SUPER_ADMIN!`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
