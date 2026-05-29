export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { canUsePortfolioScrape } from '@/lib/pricing/canUsePortfolioScrape';
import * as cheerio from 'cheerio';

const MAX_CANDIDATES = 40;
const FETCH_TIMEOUT_MS = 15000;

/** Skip icons, logos, tracking pixels, sprites. */
function isJunkImage(url: string): boolean {
  if (!url) return true;
  const u = url.toLowerCase();
  const junk = ['/icon', 'favicon', 'sprite', '1x1', 'pixel', 'tracking', '/logo', 'data:image/svg'];
  return junk.some((p) => u.includes(p));
}

/** Resolve a possibly-relative URL against the page URL; null if unusable. */
function resolveUrl(src: string | undefined, base: string): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

/**
 * Fetch rendered HTML via Browserless if configured, otherwise fall back to a
 * direct fetch (works for server-rendered pages without JS hydration).
 */
async function fetchHtml(url: string): Promise<string | null> {
  const token = process.env.BROWSERLESS_API_KEY;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    if (token) {
      const res = await fetch(`https://production-sfo.browserless.io/content?token=${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });
      if (res.ok) return await res.text();
      console.error('[import/website] Browserless failed:', res.status);
      // fall through to direct fetch
    }
    const direct = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FolioBot/1.0)' },
      signal: controller.signal,
    });
    if (!direct.ok) return null;
    return await direct.text();
  } catch (err: any) {
    if (err?.name === 'AbortError') console.log('[import/website] fetch timed out');
    else console.error('[import/website] fetch error:', err?.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

interface ScrapeResult {
  images: { url: string; alt?: string }[];
  description: string | null;
}

/** Cheerio multi-strategy image + description extraction. */
function extractFromHtml(html: string, baseUrl: string): ScrapeResult {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const images: { url: string; alt?: string }[] = [];

  const add = (raw: string | undefined, alt?: string) => {
    const resolved = resolveUrl(raw, baseUrl);
    if (!resolved || seen.has(resolved) || isJunkImage(resolved)) return;
    seen.add(resolved);
    images.push({ url: resolved, alt: alt?.trim() || undefined });
  };

  // 1. Social meta images (usually the hero shot)
  add($('meta[property="og:image"]').attr('content'));
  add($('meta[name="twitter:image"]').attr('content'));

  // 2. JSON-LD images (Product / ImageGallery / Article)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text() || '{}');
      const nodes = Array.isArray(json) ? json : json['@graph'] ?? [json];
      for (const node of nodes) {
        const img = node?.image;
        if (!img) continue;
        if (Array.isArray(img)) img.forEach((i: any) => add(typeof i === 'string' ? i : i?.url));
        else add(typeof img === 'string' ? img : img?.url);
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  });

  // 3. Inline <img> (incl. lazy-loaded data-src / srcset)
  $('img').each((_, el) => {
    const $el = $(el);
    const srcset = $el.attr('srcset') || $el.attr('data-srcset');
    const fromSrcset = srcset?.split(',').pop()?.trim().split(' ')[0];
    add($el.attr('src') || $el.attr('data-src') || fromSrcset, $el.attr('alt'));
  });

  // 4. <source> inside <picture>
  $('picture source').each((_, el) => {
    const srcset = $(el).attr('srcset');
    add(srcset?.split(',')[0]?.trim().split(' ')[0]);
  });

  // Description: og:description → meta description → first meaningful paragraph
  const description =
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('meta[name="description"]').attr('content')?.trim() ||
    $('main p, article p, p').first().text().trim() ||
    null;

  return { images: images.slice(0, MAX_CANDIDATES), description: description || null };
}

/**
 * POST /api/import/website
 * Body: { projectId, url }
 * Scrapes a portfolio/project URL for candidate images + a description.
 * Returns { sessionId }; the client polls GET /api/import/[sessionId].
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'A url is required' }, { status: 400 });
    }
    let normalizedUrl: string;
    try {
      normalizedUrl = new URL(url.startsWith('http') ? url : `https://${url}`).toString();
    } catch {
      return NextResponse.json({ error: 'That doesn’t look like a valid URL' }, { status: 400 });
    }

    // Ownership check
    if (!projectId) {
      return NextResponse.json({ error: 'A projectId is required' }, { status: 400 });
    }
    const project = await prisma.project.findFirst({
      where: { id: projectId, OR: [{ ownerId: userId }, { designerId: userId }] },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Premium gate
    if (!(await canUsePortfolioScrape(userId))) {
      return NextResponse.json(
        { error: 'Importing from a URL is a Pro feature. Upload photos directly instead.' },
        { status: 403 }
      );
    }

    const importSession = await prisma.importSession.create({
      data: {
        userId,
        sourceType: 'WEBSITE',
        sourceUrl: normalizedUrl,
        projectId,
        status: 'PROCESSING',
      },
    });

    // Tier 1: cheerio scrape. (Tier 2 Claude-vision fallback is intentionally
    // deferred — a screenshot can't yield importable image URLs; manual upload
    // is the honest fallback. finalStrategy records which path produced results.)
    const started = Date.now();
    const html = await fetchHtml(normalizedUrl);
    const result = html ? extractFromHtml(html, normalizedUrl) : { images: [], description: null };
    const durationMs = Date.now() - started;

    const hasImages = result.images.length > 0;
    const processingMeta = {
      candidates: result.images,
      extractedDescription: result.description,
      scrape: {
        cheerio: { imageCount: result.images.length, durationMs },
        vision: null,
        finalStrategy: hasImages ? 'cheerio' : 'failed',
        usedBrowserless: !!process.env.BROWSERLESS_API_KEY,
      },
    };

    const updated = await prisma.importSession.update({
      where: { id: importSession.id },
      data: {
        status: hasImages ? 'READY_FOR_REVIEW' : 'FAILED',
        totalImages: result.images.length,
        processingMeta: processingMeta as object,
        errorMessage: hasImages
          ? null
          : 'We couldn’t find any images on that page. Try a direct project/gallery URL, or upload photos directly.',
      },
    });

    return NextResponse.json({ sessionId: updated.id, status: updated.status }, { status: 201 });
  } catch (error) {
    console.error('[import/website] error:', error);
    return NextResponse.json({ error: 'Failed to import from website' }, { status: 500 });
  }
}
