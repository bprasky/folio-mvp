// @idor-allow: public-read reason="Sitemap entries reuse publication filters and never include drafts or interview content"
import { absolutePublicUrl } from '@/lib/seo/public';
import { SITEMAP_KINDS, sitemapUrls, sitemapXml, sitemapHeaders, type SitemapKind } from '@/lib/seo/sitemap';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: { kind: string; page: string } }) {
  if (!/^(0|[1-9]\d{0,5})$/.test(params.page)) return new Response('Not found', { status: 404 });
  if (params.kind === 'static' && params.page === '0') return new Response(sitemapXml(['/', '/about', '/directory'].map(absolutePublicUrl)), { headers: sitemapHeaders });
  if (!SITEMAP_KINDS.includes(params.kind as SitemapKind)) return new Response('Not found', { status: 404 });
  const urls = await sitemapUrls(params.kind as SitemapKind, Number(params.page));
  if (!urls.length) return new Response('Not found', { status: 404 });
  return new Response(sitemapXml(urls), { headers: sitemapHeaders });
}
