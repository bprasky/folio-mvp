import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/debug/pdf-text
 * Debug endpoint to test PDF text extraction
 * Send { url: "signed-pdf-url" } to see what text is extracted
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    console.log('[debug/pdf-text] Fetching PDF...');
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch PDF: ${response.status}` }, { status: 400 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[debug/pdf-text] PDF size: ${buffer.length} bytes`);

    // Try pdf-parse
    console.log('[debug/pdf-text] Running pdf-parse...');
    let pdfData;
    try {
      const pdfParse = (await import('pdf-parse')).default;

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('PDF parse timeout after 30s')), 30000)
      );

      pdfData = await Promise.race([
        pdfParse(buffer),
        timeoutPromise
      ]) as { text: string; numpages: number; info: any };

      console.log(`[debug/pdf-text] Extracted ${pdfData.text.length} characters, ${pdfData.numpages} pages`);
    } catch (parseErr: any) {
      console.error('[debug/pdf-text] pdf-parse failed:', parseErr);
      return NextResponse.json({
        success: false,
        error: 'pdf-parse failed',
        details: parseErr.message,
      });
    }

    // Look for patterns
    const text = pdfData.text;
    const lines = text.split(/\n+/).filter((line: string) => line.trim());

    // Find prices
    const prices: string[] = [];
    const priceRegex = /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
    let priceMatch;
    while ((priceMatch = priceRegex.exec(text)) !== null) {
      prices.push(priceMatch[0]);
    }

    // Find known vendors
    const knownVendors = [
      'RH', 'Restoration Hardware', 'Pottery Barn', 'West Elm', 'CB2', 'Crate & Barrel',
      'Design Within Reach', 'DWR', 'Article', 'Wayfair', 'Arhaus', 'Serena & Lily',
      'Anthropologie', 'Room & Board', 'Mitchell Gold', 'Ethan Allen', 'Williams Sonoma',
      'Four Hands', 'Uttermost', 'Arteriors', 'Visual Comfort', 'Hudson Valley', 'Circa',
      'Kelly Wearstler', 'Noir', 'Currey', 'Regina Andrew', 'Gabby', 'Made Goods',
      'Perennials', 'Kravet', 'Schumacher', 'Lee Jofa'
    ];

    const foundVendors: string[] = [];
    for (const vendor of knownVendors) {
      if (text.toLowerCase().includes(vendor.toLowerCase())) {
        foundVendors.push(vendor);
      }
    }

    // Find dimensions
    const dimensions: string[] = [];
    const dimRegex = /(\d+(?:\.\d+)?)\s*["']?\s*[Ww]?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*["']?\s*[DdLl]?\s*[xX×]?\s*(\d+(?:\.\d+)?)?\s*["']?\s*[Hh]?/g;
    let dimMatch;
    while ((dimMatch = dimRegex.exec(text)) !== null) {
      dimensions.push(dimMatch[0]);
    }

    return NextResponse.json({
      success: true,
      pdfInfo: {
        pages: pdfData.numpages,
        totalCharacters: text.length,
        totalLines: lines.length,
      },
      extracted: {
        prices,
        vendors: foundVendors,
        dimensions: dimensions.slice(0, 20), // Limit to first 20
      },
      sampleText: text.substring(0, 2000), // First 2000 chars for debugging
      allLines: lines.slice(0, 50), // First 50 lines
    });
  } catch (error: any) {
    console.error('[debug/pdf-text] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
