// @idor-allow: public-read reason="Sitemap index contains only public discovery shard URLs"
import { absolutePublicUrl } from '@/lib/seo/public';
import { SITEMAP_KINDS, SITEMAP_SIZE, sitemapCounts, sitemapXml, sitemapHeaders } from '@/lib/seo/sitemap';
export const dynamic = 'force-dynamic';
export async function GET() {
  const counts = await sitemapCounts();
  const urls = SITEMAP_KINDS.flatMap(kind => Array.from({ length: Math.ceil(counts[kind] / SITEMAP_SIZE) }, (_, page) => absolutePublicUrl(`/sitemaps/${kind}/${page}`)));
  return new Response(sitemapXml([absolutePublicUrl('/sitemaps/static/0'), ...urls], true), { headers: sitemapHeaders });
}
