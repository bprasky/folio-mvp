/**
 * Proxy endpoint to fetch images from external CDNs
 * Bypasses CORS and hotlink protection by fetching server-side
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Validate URL
    let url: URL;
    try {
      url = new URL(imageUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Prepare headers for external CDNs
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': url.origin + '/',
      'Origin': url.origin,
    };

    // Special handling for Facebook CDN
    if (url.hostname.includes('fbcdn.net') || url.hostname.includes('facebook.com')) {
      headers['Referer'] = 'https://www.facebook.com/';
      headers['Origin'] = 'https://www.facebook.com';
    }

    // Fetch the image
    const response = await fetch(imageUrl, {
      headers,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      // Try without Referer if 403
      if (response.status === 403) {
        const retryResponse = await fetch(imageUrl, {
          headers: {
            'User-Agent': headers['User-Agent'] as string,
            'Accept': headers['Accept'] as string,
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!retryResponse.ok) {
          return NextResponse.json(
            { error: `Failed to fetch image: ${retryResponse.status} ${retryResponse.statusText}` },
            { status: retryResponse.status }
          );
        }

        // Return the image
        const arrayBuffer = await retryResponse.arrayBuffer();
        return new NextResponse(arrayBuffer, {
          headers: {
            'Content-Type': retryResponse.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }

      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // Return the image
    const arrayBuffer = await response.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('[proxy-image] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to proxy image' },
      { status: 500 }
    );
  }
}

