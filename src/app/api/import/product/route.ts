import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    console.log('Import product API called');
    const { url } = await req.json();
    console.log('URL received:', url);
    
    if (!url) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    const token = process.env.BROWSERLESS_API_KEY;
    console.log('Browserless token exists:', !!token);
    console.log('Token preview:', token ? `${token.substring(0, 10)}...` : 'none');
    
    if (!token) {
      return NextResponse.json({ error: 'No Browserless key' }, { status: 500 });
    }

    // 1) Get HTML via Browserless "content"
    const htmlRes = await fetch(`https://production-sfo.browserless.io/content?token=${token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!htmlRes.ok) {
      const errorText = await htmlRes.text();
      console.error('Browserless API error:', {
        status: htmlRes.status,
        statusText: htmlRes.statusText,
        error: errorText,
        url: `https://production-sfo.browserless.io/content?token=${token.substring(0, 10)}...`
      });
      return NextResponse.json({ 
        error: 'Browserless error', 
        detail: errorText,
        status: htmlRes.status
      }, { status: 502 });
    }

    const html = await htmlRes.text();

    // 2) Parse OpenGraph / JSON-LD
    const $ = cheerio.load(html);

    const og = {
      title: $('meta[property="og:title"]').attr('content') || '',
      description: $('meta[property="og:description"]').attr('content') || '',
      image: $('meta[property="og:image"]').attr('content') || '',
      price: $('meta[property="product:price:amount"]').attr('content') || '',
      currency: $('meta[property="product:price:currency"]').attr('content') || 'USD',
    };

    // Try JSON-LD Product
    let ld: any = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).contents().text() || '{}');
        const candidate = Array.isArray(json) ? json.find((j) => j['@type'] === 'Product') : json;
        if (candidate && (candidate['@type'] === 'Product' || candidate['@graph'])) {
          ld = candidate['@graph']?.find((n: any) => n['@type'] === 'Product') || candidate;
        }
      } catch {
        // Ignore JSON parse errors
      }
    });

    // Extract price from various sources
    let extractedPrice: number | undefined;
    if (ld?.offers?.price) {
      extractedPrice = Number(ld.offers.price);
    } else if (og.price) {
      extractedPrice = Number(og.price);
    } else if (ld?.offers && Array.isArray(ld.offers)) {
      const offer = ld.offers.find((o: any) => o.price);
      if (offer) {
        extractedPrice = Number(offer.price);
      }
    }

    const data = {
      title: ld?.name || og.title || '',
      description: ld?.description || og.description || '',
      imageUrl: (Array.isArray(ld?.image) ? ld.image[0] : ld?.image) || og.image || '',
      sku: ld?.sku || '',
      brand: typeof ld?.brand === 'string' ? ld.brand : ld?.brand?.name || '',
      url,
      price: extractedPrice,
      currency: ld?.offers?.priceCurrency || og.currency || 'USD',
    };

    console.log('Extracted data:', {
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      sku: data.sku,
      brand: data.brand,
      price: data.price,
      currency: data.currency,
      ogData: og,
      ldData: ld ? { name: ld.name, image: ld.image, offers: ld.offers } : null
    });

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('Import product error:', e);
    console.error('Error stack:', e?.stack);
    return NextResponse.json({ 
      error: e?.message || 'Unknown error',
      details: e?.toString()
    }, { status: 500 });
  }
}
