export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL_FOR } from '@/lib/ai/models';

const anthropic = new Anthropic();

/**
 * POST /api/profile/fetch-bio-url
 *
 * Fetches a URL, strips boilerplate, and extracts the bio/about text using Claude.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ text: null, error: 'no_url' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return NextResponse.json({ text: null, error: 'invalid_url' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ text: null, error: 'invalid_url' }, { status: 400 });
    }

    // Fetch the page
    let htmlText: string;
    try {
      const res = await fetch(parsedUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FolioBot/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return NextResponse.json({ text: null, error: 'couldnt_access' });
      }

      htmlText = await res.text();
    } catch {
      return NextResponse.json({ text: null, error: 'couldnt_access' });
    }

    // Strip HTML tags to get raw text (basic extraction)
    const plainText = htmlText
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (plainText.length < 50) {
      return NextResponse.json({ text: null, error: 'no_bio_found' });
    }

    // Truncate to avoid huge prompts
    const truncated = plainText.slice(0, 8000);

    // Use Claude to extract the bio passage
    const response = await anthropic.messages.create({
      model: MODEL_FOR.extraction,
      thinking: { type: 'disabled' },
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `This is the text content of an interior designer's website or profile page.
Extract only the bio, about, or studio description text.
Exclude: navigation, contact forms, project titles, testimonials, footer content, social media links.
Return only the bio text, nothing else. If no bio is found, return exactly the word: null

TEXT:
${truncated}`,
      }],
    });

    const extracted = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    if (!extracted || extracted === 'null') {
      return NextResponse.json({ text: null, error: 'no_bio_found' });
    }

    return NextResponse.json({ text: extracted });
  } catch (error) {
    console.error('[POST /api/profile/fetch-bio-url] Error:', error);
    return NextResponse.json({ text: null, error: 'server_error' }, { status: 500 });
  }
}
