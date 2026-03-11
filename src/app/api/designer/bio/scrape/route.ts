export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { scrapeDesignerWebsite } from '@/lib/designer-bio/scrape-website';
import { z } from 'zod';

const RequestSchema = z.object({
  url: z.string().url(),
});

/**
 * POST /api/designer/bio/scrape
 * Scrape a designer's website and store structured data.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid URL', details: parsed.error.format() }, { status: 400 });
    }

    const userId = session.user.id;
    const { url } = parsed.data;

    // Scrape the website
    const scrapedData = await scrapeDesignerWebsite(url);

    // Upsert bio record with scraped data
    await prisma.designerBio.upsert({
      where: { userId },
      create: {
        userId,
        scrapedData: scrapedData as any,
        scrapedAt: new Date(),
        sourceUrl: url,
        status: 'scraped',
      },
      update: {
        scrapedData: scrapedData as any,
        scrapedAt: new Date(),
        sourceUrl: url,
        status: 'scraped',
      },
    });

    return NextResponse.json({ success: true, scrapedData });
  } catch (error: any) {
    console.error('[POST /api/designer/bio/scrape] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to scrape website' },
      { status: 500 }
    );
  }
}
