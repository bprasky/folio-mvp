/* prisma/seed.js */
const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function upsertUser({ email, role, name }) {
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 12);

  // upsert the user; update resets the passwordHash & role in case it drifted
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role },
    create: {
      email,
      name,
      role,
      passwordHash,
    },
  });

  // Optionally upsert role-specific profile records if your schema has them
  // These blocks are wrapped in try/catch so the seed doesn't fail if models don't exist.

  if (role === Role.DESIGNER) {
    try {
      await prisma.designer.upsert({
        where: { userId: user.id },
        update: { name: name || 'Designer User' },
        create: {
          userId: user.id,
          name: name || 'Designer User',
        },
      });
    } catch (e) {
      // No Designer model or different shape — ignore
    }
  }

  if (role === Role.VENDOR) {
    try {
      await prisma.vendor.upsert({
        where: { userId: user.id },
        update: { name: name || 'Vendor User' },
        create: {
          userId: user.id,
          name: name || 'Vendor User',
        },
      });
    } catch (e) {
      // No Vendor model or different shape — ignore
    }
  }

  return user;
}

async function main() {
  const results = await Promise.all([
    upsertUser({ email: 'admin@folio.com', name: 'Admin User', role: Role.ADMIN }),
    upsertUser({ email: 'designer@folio.com', name: 'Designer User', role: Role.DESIGNER }),
    upsertUser({ email: 'vendor@folio.com', name: 'Vendor User', role: Role.VENDOR }),
  ]);

  console.log('Seeded users:', results.map(u => ({ id: u.id, email: u.email, role: u.role })));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

