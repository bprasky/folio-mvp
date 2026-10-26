export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { safeProductResource, UnsafeProductUrl } from '@/lib/server/safe-product-url';

/** Public CDN images remain shareable; every redirect must use a public address. */
export async function GET(request: NextRequest) {
  try {
    let url = request.nextUrl.searchParams.get('url');
    if (!url) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    for (let redirects = 0; redirects <= 5; redirects++) {
      // Existing bounded transport pins validated DNS to the actual socket.
      const response = await safeProductResource(url);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (!response.headers.location) throw new UnsafeProductUrl();
        url = new URL(response.headers.location, url).href;
        continue;
      }
      const mime = response.headers['content-type']?.split(';')[0];
      if (response.status !== 200 || !['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(mime)) {
        throw new UnsafeProductUrl();
      }
      return new NextResponse(new Uint8Array(response.body), { headers: {
        'Content-Type': mime,
        // URLs can carry expiring capabilities; never put these bytes in a public cache.
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      } });
    }
    throw new UnsafeProductUrl();
  } catch {
    return NextResponse.json({ error: 'Image unavailable' }, { status: 400 });
  }
}
