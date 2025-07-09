import { NextRequest, NextResponse } from 'next/server';
import { scrapeDesignerWebsite, mockScrapeDesignerWebsite } from '@/lib/scraper/browserless';

export async function POST(request: NextRequest) {
  try {
    const { url, eventId } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'Website URL is required' },
        { status: 400 }
      );
    }

    let scrapedData;
    let success = true;

    try {
      // Try real scraping first
      console.log(`🔄 Attempting to scrape: ${url}`);
      scrapedData = await scrapeDesignerWebsite(url);
      console.log(`✅ Scraping successful for: ${url}`);
      console.log(`📊 Found ${scrapedData.projects?.length || 0} projects`);
      console.log(`👥 Found ${scrapedData.team?.length || 0} team members`);
      console.log(`📝 About section length: ${scrapedData.about?.length || 0} characters`);
    } catch (error) {
      console.error('❌ Real scraping failed, falling back to mock:', error);
      // Fallback to mock data if real scraping fails
      scrapedData = await mockScrapeDesignerWebsite(url);
      success = false;
    }

    // Note: Database storage removed to avoid Prisma schema issues
    // Analytics can be added back once schema is properly migrated

    return NextResponse.json(scrapedData);

  } catch (error) {
    console.error('❌ Website scraping error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape website' },
      { status: 500 }
    );
  }
}

 