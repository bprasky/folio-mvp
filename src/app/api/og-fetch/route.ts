// @idor-allow: public-read reason="Public OG metadata fetcher for link previews"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/og-fetch - Fetch OpenGraph metadata from a URL
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({});
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({});
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({});
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; FolioBot/1.0; +https://folio.com)',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return NextResponse.json({});
      }

      const html = await response.text();

      // Parse OG tags from HTML
      const ogData: Record<string, string> = {};

      const ogPatterns = [
        { key: 'title', pattern: /<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i },
        { key: 'title', pattern: /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i },
        { key: 'siteName', pattern: /<meta\s+(?:property|name)=["']og:site_name["']\s+content=["']([^"']+)["']/i },
        { key: 'siteName', pattern: /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:site_name["']/i },
        { key: 'imageUrl', pattern: /<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i },
        { key: 'imageUrl', pattern: /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i },
        { key: 'description', pattern: /<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i },
        { key: 'description', pattern: /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:description["']/i },
      ];

      for (const { key, pattern } of ogPatterns) {
        if (!ogData[key]) {
          const match = html.match(pattern);
          if (match?.[1]) {
            ogData[key] = decodeHtmlEntities(match[1]);
          }
        }
      }

      // Fallback: try <title> tag if no og:title
      if (!ogData.title) {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch?.[1]) {
          ogData.title = decodeHtmlEntities(titleMatch[1].trim());
        }
      }

      return NextResponse.json(ogData);
    } catch {
      clearTimeout(timeout);
      return NextResponse.json({});
    }
  } catch {
    return NextResponse.json({});
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}
