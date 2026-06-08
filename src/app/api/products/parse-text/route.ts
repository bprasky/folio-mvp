export const runtime = 'nodejs';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import {
  PRODUCT_EXTRACTION_INSTRUCTION,
  parseProductFromContent,
} from '@/lib/products/manualCapture';

/**
 * POST /api/products/parse-text
 * Body: { text: string, url?: string }
 * Turns product copy a designer pasted (when scraping was blocked) into the
 * structured fields the tagger confirms before saving.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const text: string = typeof body?.text === 'string' ? body.text : '';
    const url: string | undefined = typeof body?.url === 'string' ? body.url : undefined;

    if (text.trim().length < 3) {
      return NextResponse.json(
        { error: 'Paste the product details first.' },
        { status: 400 },
      );
    }

    const prompt = `${PRODUCT_EXTRACTION_INSTRUCTION}

${url ? `Source URL: ${url}\n` : ''}Copied product text:
"""
${text.slice(0, 8000)}
"""`;

    const fields = await parseProductFromContent([{ type: 'text', text: prompt }]);
    return NextResponse.json({ fields });
  } catch (error) {
    console.error('[products/parse-text] error:', error);
    return NextResponse.json(
      { error: 'Could not read the pasted text. Try again or enter the details manually.' },
      { status: 500 },
    );
  }
}
