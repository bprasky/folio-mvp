import { renderProductPage } from '@/lib/server/render-product';
import { load } from 'cheerio';
import { safeProductResource, parseProductUrl } from '@/lib/server/safe-product-url';
import { looksLikeBotWall } from '@/lib/browserless/classify';
import { emptyPropertySale, PropertySaleDetailsSchema, type PropertySaleDetails } from './schema';

type ImportedFields = Partial<Pick<PropertySaleDetails, 'askingPrice' | 'currency' | 'address' | 'agentName' | 'brokerage' | 'contactUrl'>>;
type Node = Record<string, unknown>;
const object = (value: unknown): Node => value && typeof value === 'object' && !Array.isArray(value) ? value as Node : {};
const first = (value: unknown) => Array.isArray(value) ? value[0] : value;
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const typeOf = (node: Node) => [node['@type']].flat().filter((value): value is string => typeof value === 'string').map(value => value.replace(/^https?:\/\/schema.org\//, ''));

/** Read only explicit listing metadata. Never infer a price from arbitrary page text. */
export function extractListingDetails(html: string, sourceUrl: string): ImportedFields {
  const $ = load(html), nodes: Node[] = [];
  const collect = (value: unknown, depth = 0) => {
    if (depth > 6 || nodes.length > 100) return;
    if (Array.isArray(value)) { value.slice(0, 100).forEach(item => collect(item, depth + 1)); return; }
    const node = object(value); if (!Object.keys(node).length) return;
    nodes.push(node); if (node['@graph']) collect(node['@graph'], depth + 1);
    if (node.mainEntity) collect(node.mainEntity, depth + 1);
  };
  $('script[type="application/ld+json"]').slice(0, 20).each((_index, el) => {
    try { collect(JSON.parse($(el).text())); } catch { /* Broken metadata is not evidence. */ }
  });
  const listing = nodes.find(node => typeOf(node).includes('RealEstateListing'));
  const propertyTypes = ['House', 'SingleFamilyResidence', 'Apartment', 'Residence', 'Accommodation'];
  const property = object(first(listing?.mainEntity));
  const target = Object.keys(property).length ? property : nodes.find(node => typeOf(node).some(type => propertyTypes.includes(type))) || listing || {};
  const offer = object(first(listing?.offers ?? target.offers));
  const offeredProperty = object(offer.itemOffered);
  const address = object(target.address ?? offeredProperty.address ?? listing?.address);
  const fields: ImportedFields = {};
  const addressText = [address.streetAddress, address.addressLocality, address.addressRegion, address.postalCode, typeof address.addressCountry === 'string' ? address.addressCountry : object(address.addressCountry).name].map(value => clean(value, 200)).filter(Boolean).join(', ');
  if (addressText) fields.address = addressText.slice(0, 400);
  const priceSpec = object(offer.priceSpecification);
  const meta = (key: string) => $(`meta[property="${key}"],meta[name="${key}"]`).first().attr('content');
  const currency = clean(offer.priceCurrency ?? priceSpec.priceCurrency ?? meta('product:price:currency') ?? meta('og:price:currency'), 8).toUpperCase();
  const amount = offer.price ?? priceSpec.price ?? meta('product:price:amount') ?? meta('og:price:amount');
  // Price and currency are one pair; an absent/unsupported currency never becomes USD by guesswork.
  if (['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'MXN', 'AED'].includes(currency) && (typeof amount === 'number' || typeof amount === 'string')) {
    const askingPrice = String(amount).replace(/,/g, '').trim();
    if (PropertySaleDetailsSchema.safeParse({ askingPrice }).success && askingPrice) {
      fields.askingPrice = askingPrice; fields.currency = currency as PropertySaleDetails['currency'];
    }
  }
  const seller = object(first(offer.seller ?? listing?.broker ?? listing?.agent));
  if (typeOf(seller).includes('Person')) {
    const name = clean(seller.name, 120); if (name) fields.agentName = name;
    const brokerage = clean(object(seller.worksFor).name, 160); if (brokerage) fields.brokerage = brokerage;
  } else if (typeOf(seller).some(type => ['Organization', 'RealEstateAgent', 'LocalBusiness'].includes(type))) {
    const name = clean(seller.name, 160); if (name) fields.brokerage = name;
  }
  if (typeof seller.url === 'string') {
    try { fields.contactUrl = parseProductUrl(new URL(seller.url, sourceUrl).href).href; } catch { /* Omit unsafe links. */ }
  }
  const validated = PropertySaleDetailsSchema.safeParse({ ...emptyPropertySale(), ...fields });
  return validated.success ? fields : {};
}

export async function importListingDetails(input: string, transport = { request: safeProductResource, render: renderProductPage }) {
  let current = parseProductUrl(input).href;
  const deadline = Date.now() + 15000;
  for (let hop = 0; hop < 4; hop++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('The listing took too long to load. You can enter its details manually.');
    const response = await transport.request(current, { maxBytes: 2 * 1024 * 1024, timeoutMs: remaining });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.headers.location) break;
      current = parseProductUrl(new URL(response.headers.location, current).href).href; continue;
    }
    const html = response.body.toString('utf8');
    if (response.status === 429 || looksLikeBotWall(html))
      throw new Error('This listing site blocks automated access. Keep the listing link and enter the details manually.');
    // A bare 403 can reflect a non-browser client rather than a bot challenge.
    // One normal protected render is allowed; explicit challenge pages stop above.
    if (response.status === 403) {
      try {
        const rendered = await transport.render(current);
        if (rendered && rendered.status >= 200 && rendered.status < 300 && !looksLikeBotWall(rendered.html))
          return { fields: extractListingDetails(rendered.html, rendered.finalUrl) };
      } catch { /* Fall through to the readable manual-entry error. */ }
    }
    if (response.status < 200 || response.status >= 300 || !/text\/html|application\/xhtml\+xml/i.test(response.headers['content-type'] || ''))
      throw new Error('The listing could not be read. Keep its link and enter the details manually.');
    const fields = extractListingDetails(html, current);
    if (!fields.askingPrice || !fields.address) {
      // An ordinary protected render can reveal JS-populated metadata. Never
      // escalate an explicit denial/CAPTCHA to another browser or identity.
      try {
        const rendered = await transport.render(current);
        if (rendered && rendered.status >= 200 && rendered.status < 300 && !looksLikeBotWall(rendered.html)) {
          const extra = extractListingDetails(rendered.html, rendered.finalUrl);
          return { fields: { ...extra, ...fields } };
        }
      } catch { /* Preserve useful static fields when rendering is unavailable. */ }
    }
    return { fields };
  }
  throw new Error('The listing could not be read. Keep its link and enter the details manually.');
}
