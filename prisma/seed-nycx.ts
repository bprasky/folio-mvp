/* eslint-disable no-console */
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const FEST_TITLE = 'NYCxDesign 2026';
const FEST_START = new Date('2026-05-14T09:00:00-04:00');
const FEST_END   = new Date('2026-05-20T23:59:59-04:00');

// Helpers
function addHours(d: Date, hours: number) {
  const copy = new Date(d);
  copy.setHours(copy.getHours() + hours);
  return copy;
}
function between(start: Date, end: Date, dayOffset: number, hour: number) {
  const d = new Date(start);
  d.setDate(start.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}
function range(n: number) { return Array.from({ length: n }, (_, i) => i); }

async function ensureUsers() {
  // Admin (festival owner)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@folio.com' },
    update: {},
    create: {
      email: 'admin@folio.com',
      name: 'Admin User',
      role: Role.ADMIN,
    },
  });

  // PR firms as vendors (creators of many events)
  const prA = await prisma.user.upsert({
    where: { email: 'press@northsix-pr.com' },
    update: {},
    create: { email: 'press@northsix-pr.com', name: 'NorthSix PR', role: Role.VENDOR, companyName: 'NorthSix PR' },
  });

  const prB = await prisma.user.upsert({
    where: { email: 'hello@designpressco.com' },
    update: {},
    create: { email: 'hello@designpressco.com', name: 'Design Press Co.', role: Role.VENDOR, companyName: 'Design Press Co.' },
  });

  const prC = await prisma.user.upsert({
    where: { email: 'events@showroomcollective.com' },
    update: {},
    create: { email: 'events@showroomcollective.com', name: 'Showroom Collective', role: Role.VENDOR, companyName: 'Showroom Collective' },
  });

  // A pool of designers for RSVPs so the feed has signal
  const designers: string[] = [];
  for (const i of range(140)) {
    const email = `designer.nycx.${i}@folio.test`;
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: `Designer ${i}`, role: Role.DESIGNER },
    });
    designers.push(u.id);
  }

  return { admin, prA, prB, prC, designers };
}

async function upsertFestival(createdById: string) {
  const fest = await prisma.event.upsert({
    where: { id: 'nycx-design-2026' }, // Use a fixed ID for deterministic seeding
    update: {
      startDate: FEST_START,
      endDate: FEST_END,
      isApproved: true,
      isPublic: true,
      imageUrl: 'https://picsum.photos/seed/nycx-fest/1400/700',
      location: 'New York, NY',
    },
    create: {
      id: 'nycx-design-2026',
      title: FEST_TITLE,
      description:
        'NYCxDESIGN unites NYC\'s multidisciplinary and global design community for a week of exhibitions, launches, talks, and parties across the city.',
      location: 'New York, NY',
      startDate: FEST_START,
      endDate: FEST_END,
      imageUrl: 'https://picsum.photos/seed/nycx-fest/1400/700',
      isPublic: true,
      isApproved: true,
      createdById,
    },
  });

  return fest;
}

type Spec = {
  title: string;
  day: number;          // offset from FEST_START (0..)
  startHour: number;    // 24h local
  durationHrs?: number; // default 2
  location: string;
  rsvpTarget?: number;  // approximate RSVPs to create
  createdBy: 'prA'|'prB'|'prC';
  linkedProducts?: string[];
  isVirtual?: boolean;
};

// A curated, human-readable set of ~30 events across types
const SPECS: Spec[] = [
  // Opening night party (big)
  {
    title: 'NYCxDesign 2026 Opening Party @ The Refinery by Domino',
    day: 0, startHour: 18, durationHrs: 4,
    location: 'The Refinery at Domino, Brooklyn',
    rsvpTarget: 900, createdBy: 'prA',
  },
  // Panels & talks
  { title: 'Design Futures: AI & Craft', day: 1, startHour: 10, location: 'SoHo Design District', createdBy: 'prB', rsvpTarget: 260 },
  { title: 'Sustainability in Materials: New Standards', day: 2, startHour: 11, location: 'A/D/O Green Lab', createdBy: 'prB', rsvpTarget: 210 },
  { title: 'Keynote: The City as a Living Interface', day: 3, startHour: 9, location: 'The Shed, Hudson Yards', createdBy: 'prA', rsvpTarget: 600 },
  // Product reveals
  { title: 'Lexus Pavilion: Light + Motion Reveal', day: 1, startHour: 15, location: 'Hudson Yards Public Square & Gardens', createdBy: 'prC', rsvpTarget: 380, linkedProducts: ['SKU-LEX-NEON','SKU-LEX-ARC'] },
  { title: 'Stone & Steam: Kettle Collection by Alinea', day: 2, startHour: 16, location: 'Nolita Showroom', createdBy: 'prA', rsvpTarget: 180 },
  // Installations / exhibitions (smaller cards)
  { title: 'Soft Geometry: Inflated Forms', day: 0, startHour: 12, durationHrs: 6, location: 'Industry City, Building 5', createdBy: 'prC', rsvpTarget: 140 },
  { title: 'Glass Lines: A Micro Exhibition', day: 3, startHour: 12, durationHrs: 6, location: 'Chelsea Gallery Row', createdBy: 'prB', rsvpTarget: 90 },
  { title: 'Future Woods: Engineered Timber Pavilion', day: 4, startHour: 10, durationHrs: 8, location: 'Brooklyn Navy Yard', createdBy: 'prC', rsvpTarget: 110 },
  // Booths (many + small)
  { title: 'Maison&Objet — Studio ARCA Booth', day: 1, startHour: 10, durationHrs: 7, location: 'Javits Center – Hall B', createdBy: 'prA', rsvpTarget: 70 },
  { title: 'Maison&Objet — Ceramic Cloud Booth', day: 1, startHour: 10, durationHrs: 7, location: 'Javits Center – Hall B', createdBy: 'prA', rsvpTarget: 65 },
  { title: 'Design Pier — Modular Lighting Booth', day: 2, startHour: 10, durationHrs: 7, location: 'Javits Center – Hall C', createdBy: 'prC', rsvpTarget: 60 },
  { title: 'New Nordic — Furniture Collective Booth', day: 3, startHour: 10, durationHrs: 7, location: 'Javits Center – Hall A', createdBy: 'prB', rsvpTarget: 55 },
  { title: 'Foundry Lab — 3D Metals Booth', day: 4, startHour: 10, durationHrs: 7, location: 'Javits Center – Hall A', createdBy: 'prB', rsvpTarget: 50 },
  // Parties / happy hours / meals
  { title: 'Canal Street Happy Hour (Designers Night)', day: 1, startHour: 19, location: 'Canal Street Market', createdBy: 'prC', rsvpTarget: 420 },
  { title: 'Domino Roof — Golden Hour Mixer', day: 2, startHour: 18, location: 'Domino Park Rooftop', createdBy: 'prA', rsvpTarget: 250 },
  { title: 'Design Brunch: Women in Craft', day: 2, startHour: 11, location: 'Soho House Meatpacking', createdBy: 'prB', rsvpTarget: 160 },
  // Workshops & tours
  { title: 'Parametric Workshop: Grasshopper for Interiors', day: 3, startHour: 14, location: 'Pratt Institute – Studio 4', createdBy: 'prC', rsvpTarget: 130 },
  { title: 'Lighting Tour: Tribeca After Dark', day: 4, startHour: 20, location: 'Tribeca starting point (email for details)', createdBy: 'prB', rsvpTarget: 90 },
  // Awards
  { title: 'Emerging Designers Awards', day: 5, startHour: 19, location: 'Brooklyn Museum – Auditorium', createdBy: 'prA', rsvpTarget: 520 },
  // Additional variety to get ~30 items
  { title: 'Compact Kitchens: 420 sq ft Showcase', day: 1, startHour: 13, location: 'Lower East Side Pop-Up', createdBy: 'prC', rsvpTarget: 85 },
  { title: 'Keynote: Designing for Climate', day: 2, startHour: 9, location: 'The Times Center', createdBy: 'prA', rsvpTarget: 450 },
  { title: 'Booth: Tessellate Textiles', day: 2, startHour: 10, durationHrs: 7, location: 'Javits – Hall C', createdBy: 'prB', rsvpTarget: 44 },
  { title: 'Lunch & Learn: Circular Materials', day: 3, startHour: 12, location: 'Chelsea Showroom 12W', createdBy: 'prA', rsvpTarget: 150 },
  { title: 'Workshop: Chair Joinery by Hand', day: 4, startHour: 13, location: 'Red Hook Makerspace', createdBy: 'prC', rsvpTarget: 120 },
  { title: 'Party: Canal x Red Hook Closing Jam', day: 6, startHour: 19, location: 'Red Hook Warehouse', createdBy: 'prB', rsvpTarget: 460 },
  { title: 'Virtual Panel: Cities + AI (Livestream)', day: 5, startHour: 10, location: 'Online — Livestream', createdBy: 'prA', rsvpTarget: 380, isVirtual: true },
  { title: 'Pop-Up Install: Sound + Surface', day: 0, startHour: 15, durationHrs: 5, location: 'DUMBO Archway', createdBy: 'prC', rsvpTarget: 100 },
  { title: 'Micro Exhibition: Student Prototypes', day: 5, startHour: 12, durationHrs: 6, location: 'The New School – Gallery', createdBy: 'prB', rsvpTarget: 95 },
  { title: 'Booth: Refined Oak Objects', day: 3, startHour: 10, durationHrs: 7, location: 'Javits – Hall B', createdBy: 'prA', rsvpTarget: 60 },
  { title: 'Keynote: Material Poetics', day: 6, startHour: 11, location: 'Brooklyn Navy Yard – Stage A', createdBy: 'prC', rsvpTarget: 320 },
  { title: 'Installation: Chromatic Passage', day: 6, startHour: 10, durationHrs: 8, location: 'Seaport Esplanade', createdBy: 'prB', rsvpTarget: 120 },
];

async function main() {
  console.log('🌱 Seeding NYCxDesign 2026 + sub‑events…');

  const { admin, prA, prB, prC, designers } = await ensureUsers();
  const creatorByKey: Record<Spec['createdBy'], string> = { prA: prA.id, prB: prB.id, prC: prC.id };

  // Upsert festival
  const fest = await upsertFestival(admin.id);

  // Wipe only this festival's existing subevents so re-runs don't duplicate
  await prisma.event.deleteMany({ where: { parentFestivalId: fest.id } });

  // Create sub-events deterministically
  for (let i = 0; i < SPECS.length; i++) {
    const s = SPECS[i];

    const start = between(FEST_START, FEST_END, s.day, s.startHour);
    const end   = addHours(start, s.durationHrs ?? 2);

    const ev = await prisma.event.create({
      data: {
        title: s.title,
        description:
          'Part of NYCxDesign 2026. Expect a design‑forward crowd, good conversations, and plenty of inspiration.',
        location: s.location,
        startDate: start,
        endDate: end,
        imageUrl: `https://picsum.photos/seed/nycx-${i}/1200/630`,
        isPublic: true,
        isApproved: true,
        createdById: creatorByKey[s.createdBy],
        parentFestivalId: fest.id,
      },
    });

    // Create RSVP rows (approximate target)
    const target = Math.min(s.rsvpTarget ?? 90, designers.length);
    // Simple spread: pick every k-th designer to keep deterministic
    const step = Math.max(1, Math.floor(designers.length / target));
    const chosen = designers.filter((_, idx) => idx % step === 0).slice(0, target);

    if (chosen.length) {
      await prisma.eventRSVP.createMany({
        data: chosen.map((userId) => ({
          userId,
          eventId: ev.id,
          status: 'attending',
        })),
        skipDuplicates: true,
      });
    }
  }

  console.log('✅ NYCxDesign 2026 seeded with', SPECS.length, 'sub‑events.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); }); 