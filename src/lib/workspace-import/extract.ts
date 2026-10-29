import * as cheerio from 'cheerio';
import { IMPORT_LIMITS, type ImportPage } from './types';

export function websiteUrl(input: string, base?: string): string {
  const address = /^https?:\/\//i.test(input) || input.startsWith('//') ? input :
    !base || /^[\w.-]+\.[a-z]{2,}(?::\d+)?(?:\/|$)/i.test(input) ? `https://${input}` : input;
  const url = new URL(address, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use a public website address.');
  url.hash = '';
  for (const key of Array.from(url.searchParams.keys())) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  return url.href;
}
export function sameWebsite(a: string, b: string) {
  return new URL(a).hostname.replace(/^www\./, '') === new URL(b).hostname.replace(/^www\./, '');
}
function resolve(raw: unknown, base: string): string | undefined {
  try { return typeof raw === 'string' && raw.trim() ? websiteUrl(raw.trim(), base) : undefined; } catch { return undefined; }
}
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const excluded = /\/(?:blog|news|press|journal|shop|products?|contact|privacy|terms|search|category|tag)(?:\/|$)/i;
const portfolio = /(?:^|\/)(?:projects?|portfolio|work|our-work|selected-work|residential|commercial)(?:\/|$)/i;

/** Website content is source material, never executable instructions or accepted interview answers. */
export function extractWebsitePage(html: string, url: string, personName = '') {
  const $ = cheerio.load(html);
  const structured: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const data = JSON.parse($(element).text());
      for (const node of Array.isArray(data) ? data : Array.isArray(data?.['@graph']) ? data['@graph'] : [data]) {
        if (node && typeof node === 'object' && !Array.isArray(node)) structured.push(node);
      }
    } catch { /* A malformed metadata block does not discard the visible page. */ }
  });
  const organization = structured.find(node => /Organization|LocalBusiness|ProfessionalService|Architect/i.test(String(node['@type'])));
  const person = structured.find(node => /Person/i.test(String(node['@type'])) && personName && clean(String(node.name)).toLowerCase() === clean(personName).toLowerCase());
  const title = clean($('h1').first().text() || $('meta[property="og:title"]').attr('content') || $('title').text()).slice(0, 160);
  const metaDescription = clean($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '');
  const logoObject = organization?.logo && typeof organization.logo === 'object' ? organization.logo as Record<string, unknown> : null;
  const logo = resolve(logoObject ? logoObject.url : organization?.logo, url) ||
    resolve($('header img[src*="logo"], header img[alt*="logo" i], img[alt*="logo" i]').first().attr('src'), url);
  const links: Array<{ url: string; kind: ImportPage['kind']; label: string }> = [];
  const seen = new Set<string>([url]);
  $('a[href]').each((_, anchor) => {
    const href = resolve($(anchor).attr('href'), url);
    if (!href || seen.has(href) || !sameWebsite(href, url)) return;
    const pathname = new URL(href).pathname.replace(/\/+$/, '');
    if (excluded.test(pathname) || /\.(pdf|zip|jpg|png|svg|mp4)$/i.test(pathname)) return;
    const label = clean($(anchor).text() || $(anchor).find('img').attr('alt') || '').slice(0, 160);
    let kind: ImportPage['kind'] | undefined;
    if (personName && label.toLowerCase().includes(personName.toLowerCase())) kind = 'bio';
    else if (/\/(?:about|studio|our-story|about-us|team)(?:\/|$)/i.test(pathname)) kind = 'about';
    else if (portfolio.test(pathname)) {
      const parts = pathname.split('/').filter(Boolean);
      kind = parts.length > 1 && !/^(residential|commercial|all|selected-work)$/i.test(parts[parts.length - 1]) ? 'project' : 'portfolio';
    } else if (portfolio.test(new URL(url).pathname) && $(anchor).find('img').length && label) kind = 'project';
    if (kind) { seen.add(href); links.push({ url: href, kind, label }); }
  });
  const images: Array<{ url: string; alt: string }> = [];
  const imageSeen = new Set<string>();
  const addImage = (raw: unknown, alt = '') => {
    const image = resolve(raw, url);
    if (!image || imageSeen.has(image) || /(?:logo|favicon|sprite|pixel|tracking|icon|\.svg(?:\?|$))/i.test(image)) return;
    imageSeen.add(image); images.push({ url: image, alt: clean(alt).slice(0, 500) });
  };
  $('main img, article img, [class*="gallery"] img').each((_, image) => {
    const element = $(image);
    const srcset = element.attr('data-srcset') || element.attr('srcset');
    addImage(srcset?.split(',').pop()?.trim().split(/\s+/)[0] || element.attr('data-src') || element.attr('src'), element.attr('alt'));
  });
  if (!images.length) $('img').each((_, image) => {
    if ($(image).closest('header,footer,nav').length) return;
    addImage($(image).attr('data-src') || $(image).attr('src'), $(image).attr('alt'));
  });
  if (!images.length) addImage($('meta[property="og:image"]').attr('content'));
  $('script,style,nav,header,footer,form,[role="navigation"]').remove();
  const paragraphs = $('main p, article p').toArray().map(element => clean($(element).text())).filter(text => text.length >= 40);
  const text = (paragraphs.length ? paragraphs : $('p').toArray().map(element => clean($(element).text())).filter(text => text.length >= 40)).slice(0, 16).join('\n\n').slice(0, 6000);
  const address = organization?.address as Record<string, unknown> | undefined;
  const location = address && typeof address === 'object' ? [address.addressLocality, address.addressRegion].filter(value => typeof value === 'string').join(', ').slice(0, 120) : '';
  const founded = Number(String(organization?.foundingDate || '').slice(0, 4));
  return { title, description: (text || metaDescription).slice(0, 4000), text, logo, location,
    foundedYear: founded >= 1800 && founded <= new Date().getFullYear() ? founded : undefined,
    personalBio: person && typeof person.description === 'string' ? clean(person.description).slice(0, 4000) :
      personName && title.toLowerCase().includes(personName.toLowerCase()) ? text : undefined,
    links, images: images.slice(0, IMPORT_LIMITS.photos), imageCount: images.length };
}
