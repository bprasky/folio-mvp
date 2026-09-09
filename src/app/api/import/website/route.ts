export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { canUsePortfolioScrape } from '@/lib/pricing/canUsePortfolioScrape';
import * as cheerio from 'cheerio';
import { getContent, directFetch, hasBrowserlessKey } from '@/lib/browserless/client';
import { recordScrapeAttempt } from '@/lib/browserless/record';

const MAX_CANDIDATES = 40;
const FETCH_TIMEOUT_MS = 15000;
const RENDER_TIMEOUT_MS = 45000;

/** Skip icons, logos, tracking pixels, sprites by URL shape. */
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
 * Fetch rendered HTML via the isolated worker if configured, otherwise use a
 * direct fetch (works for server-rendered pages without JS hydration).
 */
async function fetchHtml(url: string, importSessionId?: string): Promise<string | null> {
  if (hasBrowserlessKey()) {
    const res = await getContent(url, { timeoutMs: FETCH_TIMEOUT_MS });
    await recordScrapeAttempt({ url, consumer: 'IMPORT_WEBSITE', result: res, importSessionId });
    if (res.ok) return res.payload;
    console.error('[import/website] Isolated renderer unavailable:', res.status);
    // fall through to direct fetch
  }
  const direct = await directFetch(url, {
    timeoutMs: FETCH_TIMEOUT_MS,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FolioBot/1.0)' },
  });
  await recordScrapeAttempt({ url, consumer: 'IMPORT_WEBSITE', result: direct, importSessionId });
  if (!direct.ok) return null;
  return direct.payload;
}

interface ScrapeResult {
  images: { url: string; alt?: string }[];
  description: string | null;
}

/** Cheerio multi-strategy image + description extraction (Tier 1, static HTML). */
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

  add($('meta[property="og:image"]').attr('content'));
  add($('meta[name="twitter:image"]').attr('content'));

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text() || '{}');
      const nodes = Array.isArray(json) ? json : Array.isArray(json['@graph']) ? json['@graph'] : [json];
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

  $('img').each((_, el) => {
    const $el = $(el);
    const srcset = $el.attr('srcset') || $el.attr('data-srcset');
    const fromSrcset = srcset?.split(',').pop()?.trim().split(' ')[0];
    add($el.attr('src') || $el.attr('data-src') || fromSrcset, $el.attr('alt'));
  });

  $('picture source').each((_, el) => {
    const srcset = $(el).attr('srcset');
    add(srcset?.split(',')[0]?.trim().split(' ')[0]);
  });

  const description =
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('meta[name="description"]').attr('content')?.trim() ||
    $('main p, article p, p').first().text().trim() ||
    null;

  return { images: images.slice(0, MAX_CANDIDATES), description: description || null };
}

// Rendered DOM uses the same bounded HTML extractor as the cheap path.
// Arbitrary remote page functions are no longer supported.
async function renderedHarvest(url: string, importSessionId?: string): Promise<ScrapeResult> {
  if (!hasBrowserlessKey()) return { images: [], description: null };
  const res = await getContent(url, { timeoutMs: RENDER_TIMEOUT_MS });
  const result = res.ok ? extractFromHtml(res.payload, url) : { images: [], description: null };
  await recordScrapeAttempt({ url, consumer: 'IMPORT_WEBSITE', result: res, importSessionId, emptyResult: !result.images.length });
  return result;
}

/**
 * POST /api/import/website
 * Body: { projectId, url }
 * HTML extraction → rendered-DOM extraction on a miss → else FAILED.
 * Both tiers return original image URLs; computed CSS-only imagery is not harvested.
 * Returns { sessionId }; the client reads GET /api/import/[sessionId].
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

    // Tier 1 (primary): rendered-DOM harvest — scrolls to load the full gallery
    // and collects every image's original full-res URL. This is the reliable way
    // to get all of a project's photos from JS/lazy-loaded portfolio sites.
    const renderStart = Date.now();
    const rendered = await renderedHarvest(normalizedUrl, importSession.id);
    const renderMs = Date.now() - renderStart;

    let result: ScrapeResult = rendered;
    let finalStrategy: 'rendered' | 'cheerio' | 'failed' = rendered.images.length ? 'rendered' : 'failed';

    // Tier 2 (fallback): cheerio over static/SSR HTML, when the rendered harvest
    // is unavailable (no Browserless) or returns nothing.
    let cheerioMeta: { imageCount: number; durationMs: number } | null = null;
    if (rendered.images.length === 0) {
      const cheerioStart = Date.now();
      const html = await fetchHtml(normalizedUrl, importSession.id);
      const cheerioResult = html ? extractFromHtml(html, normalizedUrl) : { images: [], description: null };
      cheerioMeta = { imageCount: cheerioResult.images.length, durationMs: Date.now() - cheerioStart };
      if (cheerioResult.images.length > 0) {
        result = { images: cheerioResult.images, description: rendered.description ?? cheerioResult.description };
        finalStrategy = 'cheerio';
      } else if (!rendered.description && cheerioResult.description) {
        result = { images: [], description: cheerioResult.description };
      }
    }

    const hasImages = result.images.length > 0;
    const processingMeta = {
      candidates: result.images,
      extractedDescription: result.description,
      scrape: {
        rendered: { imageCount: rendered.images.length, durationMs: renderMs },
        cheerio: cheerioMeta,
        finalStrategy,
        usedBrowserless: hasBrowserlessKey(),
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
