import 'server-only';
import { unstable_noStore as noStore } from 'next/cache';
import { prisma } from '@/lib/prisma';

export type SigninHero = {
  url: string;
  alt: string;
  caption: string;
  counter: string;
};

const POOL_SIZE = 60;
const COUNTER_TOTAL = 4;

export async function getSigninHero(): Promise<SigninHero | null> {
  noStore();

  try {
    const pool = await prisma.momentIndex.findMany({
      where: {
        isPublic: true,
        projectImage: { url: { not: '' } },
      },
      select: {
        projectTitle: true,
        designerName: true,
        projectImage: { select: { url: true, name: true } },
      },
      orderBy: [
        { engagementScore: 'desc' },
        { editorialScore: 'desc' },
      ],
      take: POOL_SIZE,
    });

    if (!pool.length) return null;

    const pick = pool[Math.floor(Math.random() * pool.length)];
    const counterIndex = Math.floor(Math.random() * COUNTER_TOTAL) + 1;
    const titleClean = pick.projectTitle?.trim() || 'Untitled project';
    const designerClean = pick.designerName?.trim() || 'Folio';

    return {
      url: pick.projectImage.url,
      alt: `${titleClean} — ${designerClean}`,
      caption: `${titleClean} — ${designerClean}`,
      counter: `0${counterIndex} / 0${COUNTER_TOTAL}`,
    };
  } catch (err) {
    console.error('[getSigninHero] failed to load hero', err);
    return null;
  }
}
