export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { canUsePortfolioScrape } from '@/lib/pricing/canUsePortfolioScrape';
import * as cheerio from 'cheerio';

const MAX_CANDIDATES = 40;
const FETCH_TIMEOUT_MS = 15000;
const RENDER_TIMEOUT_MS = 45000;
// Minimum natural dimensions for a harvested image to count as a real photo
// (filters out logos, icons, avatars, UI chrome).
const MIN_PHOTO_WIDTH = 400;
const MIN_PHOTO_HEIGHT = 300;

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
      console.error('[import/website] Browserless /content failed:', res.status);
      // fall through to direct fetch
    }
    const direct = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FolioBot/1.0)' },
      signal: controller.signal,
    });
    if (!direct.ok) return null;
    return await direct.text();
  } catch (err: any) {
    if (err?.name === 'AbortError') console.log('[import/website] /content fetch timed out');
    else console.error('[import/website] /content fetch error:', err?.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
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

// Page-context harvester (runs inside the browser via Browserless /function).
// Scrolls to trigger lazy-loading, then collects every image's best URL plus its
// rendered/natural dimensions and CSS background images. Returns originals — no
// re-encoding, so full resolution is preserved.
const HARVEST_CODE = `export default async function ({ page, context }) {
  const { url } = context;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = 800;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total >= document.body.scrollHeight + 1200) { clearInterval(timer); resolve(); }
      }, 120);
    });
    window.scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 800));
  const data = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    const pickFromSrcset = (ss) => {
      if (!ss) return null;
      const parts = ss.split(',').map((s) => s.trim()).filter(Boolean);
      if (!parts.length) return null;
      return parts[parts.length - 1].split(' ')[0];
    };
    const push = (u, w, h, alt) => {
      if (!u || u.startsWith('data:') || seen.has(u)) return;
      seen.add(u);
      out.push({ url: u, w: w || 0, h: h || 0, alt: alt || '' });
    };
    document.querySelectorAll('img').forEach((img) => {
      const u = img.currentSrc || img.src || pickFromSrcset(img.getAttribute('srcset')) ||
        img.getAttribute('data-src') || pickFromSrcset(img.getAttribute('data-srcset'));
      push(u, img.naturalWidth, img.naturalHeight, img.alt);
    });
    document.querySelectorAll('*').forEach((el) => {
      const bg = window.getComputedStyle(el).backgroundImage;
      if (bg && bg.indexOf('url(') === 0) {
        const m = bg.match(/url\\(["']?(.*?)["']?\\)/);
        if (m && m[1]) {
          const rect = el.getBoundingClientRect();
          push(m[1], Math.round(rect.width), Math.round(rect.height), '');
        }
      }
    });
    const meta = (sel, attr) => { const e = document.querySelector(sel); return e ? e.getAttribute(attr) : null; };
    const description = meta('meta[property="og:description"]', 'content') ||
      meta('meta[name="description"]', 'content') ||
      (document.querySelector('main p, article p, p') || {}).textContent || null;
    return { images: out, description: description ? description.trim() : null };
  });
  return { data, type: 'application/json' };
}`;

/**
 * Tier 2: render the page with JS via Browserless /function, scroll to load
 * everything, and harvest the original full-resolution image URLs. Filters by
 * natural dimensions so logos/icons/avatars are dropped. Only runs on a cheerio
 * miss; needs Browserless (JS rendering) to work.
 */
async function renderedHarvest(url: string): Promise<ScrapeResult> {
  const token = process.env.BROWSERLESS_API_KEY;
  if (!token) return { images: [], description: null };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS);
  try {
    const res = await fetch(`https://production-sfo.browserless.io/function?token=${token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: HARVEST_CODE, context: { url } }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[import/website] Browserless /function failed:', res.status);
      return { images: [], description: null };
    }
    const payload = await res.json();
    const raw: Array<{ url: string; w: number; h: number; alt?: string }> = payload?.images || [];

    const seen = new Set<string>();
    const images: { url: string; alt?: string }[] = [];
    for (const item of raw) {
      const resolved = resolveUrl(item.url, url);
      if (!resolved || seen.has(resolved) || isJunkImage(resolved)) continue;
      // Keep images that are clearly photo-sized. Some lazy <img> report 0×0
      // natural size if still not decoded — keep those too (URL is real), but
      // drop anything we positively know is small.
      const w = item.w || 0;
      const h = item.h || 0;
      const knownSmall = (w > 0 && w < MIN_PHOTO_WIDTH) || (h > 0 && h < MIN_PHOTO_HEIGHT);
      if (knownSmall) continue;
      seen.add(resolved);
      images.push({ url: resolved, alt: item.alt?.trim() || undefined });
    }

    return {
      images: images.slice(0, MAX_CANDIDATES),
      description: typeof payload?.description === 'string' ? payload.description.trim() || null : null,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') console.log('[import/website] /function timed out');
    else console.error('[import/website] /function error:', err?.message);
    return { images: [], description: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * POST /api/import/website
 * Body: { projectId, url }
 * Tier 1 cheerio (static HTML) → Tier 2 rendered-DOM harvest (JS, lazy-load,
 * background images) → else FAILED. Both tiers return original image URLs.
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
    const rendered = await renderedHarvest(normalizedUrl);
    const renderMs = Date.now() - renderStart;

    let result: ScrapeResult = rendered;
    let finalStrategy: 'rendered' | 'cheerio' | 'failed' = rendered.images.length ? 'rendered' : 'failed';

    // Tier 2 (fallback): cheerio over static/SSR HTML, when the rendered harvest
    // is unavailable (no Browserless) or returns nothing.
    let cheerioMeta: { imageCount: number; durationMs: number } | null = null;
    if (rendered.images.length === 0) {
      const cheerioStart = Date.now();
      const html = await fetchHtml(normalizedUrl);
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
