/**
 * Backfill badge tokens for existing ATTENDING RSVPs.
 *
 * Run with: npx tsx scripts/backfill-badge-tokens.ts
 */
import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

async function main() {
  const rsvps = await prisma.eventRSVP.findMany({
    where: {
      status: { in: ["ATTENDING", "attending"] },
      badgeToken: null,
    },
    select: { id: true },
  });

  console.log(`Found ${rsvps.length} ATTENDING RSVPs without badge tokens.`);

  let updated = 0;
  for (const rsvp of rsvps) {
    await prisma.eventRSVP.update({
      where: { id: rsvp.id },
      data: { badgeToken: nanoid(12) },
    });
    updated++;
    if (updated % 100 === 0) {
      console.log(`  ...updated ${updated}/${rsvps.length}`);
    }
  }

  console.log(`Done. Updated ${updated} RSVPs with badge tokens.`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
