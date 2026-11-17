import { z } from 'zod';

const webUrl = z.string().trim().max(2000).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}, 'Use a complete http or https link without login details.');

export const PropertySaleDetailsSchema = z.object({
  currentlyForSale: z.boolean().default(false),
  listingUrl: webUrl.default(''),
  askingPrice: z.string().trim().regex(/^(?:\d{1,12}(?:\.\d{1,2})?)?$/, 'Enter a price using numbers, without commas or a currency symbol.')
    .refine(value => !value || Number(value) > 0, 'Enter a price greater than zero.').default(''),
  currency: z.enum(['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'MXN', 'AED']).default('USD'),
  address: z.string().trim().max(400).default(''),
  publishAddress: z.boolean().default(false),
  agentName: z.string().trim().max(120).default(''),
  brokerage: z.string().trim().max(160).default(''),
  contactUrl: webUrl.default(''),
  publicationPermission: z.boolean().default(false),
  pressLinks: z.array(z.object({ title: z.string().trim().min(1).max(160), url: webUrl.refine(Boolean, 'Add a link.') }).strict()).max(6).default([]),
}).strict().refine(value => !value.currentlyForSale || !value.publicationPermission || !!value.listingUrl, {
  message: 'Add the actual listing link before showing this property for sale on Folio.', path: ['listingUrl'],
}).refine(value => !value.publishAddress || (value.publicationPermission && !!value.address), {
  message: 'Add the address and confirm publication permission before showing it.', path: ['publishAddress'],
});
export type PropertySaleDetails = z.infer<typeof PropertySaleDetailsSchema>;
export const emptyPropertySale = (): PropertySaleDetails => PropertySaleDetailsSchema.parse({});

export const SavedPropertySaleSchema = z.object({
  schemaVersion: z.literal(1), version: z.number().int().positive(),
  updatedAt: z.string().datetime(), confirmedAt: z.string().datetime().nullable(),
  updatedBy: z.string(), requestId: z.string(), details: PropertySaleDetailsSchema,
});
export type SavedPropertySale = z.infer<typeof SavedPropertySaleSchema>;

export function readPropertySale(provenance: unknown): SavedPropertySale | null {
  const value = provenance && typeof provenance === 'object' ? (provenance as Record<string, unknown>).propertySale : undefined;
  const result = SavedPropertySaleSchema.safeParse(value);
  return result.success ? result.data : null;
}

export const PROPERTY_SALE_OPENING = 'What would someone miss if they only looked at the listing photographs?';
export const PROPERTY_SALE_INTERVIEW_DIRECTION = 'The creator has marked this property for sale. Help a future owner understand the design intentions, daily experience and overlooked craftsmanship. Use accepted answers as evidence. Weave relevant questions into the existing project and room budgets; do not add a sales questionnaire, repeat covered topics, justify a price, invent amenities or promise investment returns. Sale intent is context, not a designer quote. Listing information and press are not interview evidence.';

export type PublicPropertySale = {
  address: string | null;
  pressLinks: Array<{ title: string; url: string }>;
  listing: null | { fresh: boolean; askingPrice: string | null; currency: string; listingUrl: string | null;
    agentName: string | null; brokerage: string | null; contactUrl: string | null; confirmedAt: string };
};

/** No private fields or permission receipts cross the public transport boundary. */
export function publicPropertySale(provenance: unknown, now = new Date()): PublicPropertySale | null {
  const saved = readPropertySale(provenance);
  if (!saved?.details.publicationPermission) return null;
  const details = saved.details;
  const age = saved.confirmedAt ? now.getTime() - Date.parse(saved.confirmedAt) : Infinity;
  const fresh = age >= 0 && age <= 30 * 24 * 60 * 60 * 1000;
  const listing = details.currentlyForSale && details.listingUrl && saved.confirmedAt ? {
    fresh, askingPrice: fresh ? details.askingPrice || null : null, currency: details.currency,
    listingUrl: details.listingUrl || null, agentName: fresh ? details.agentName || null : null,
    brokerage: fresh ? details.brokerage || null : null, contactUrl: fresh ? details.contactUrl || null : null,
    confirmedAt: saved.confirmedAt,
  } : null;
  const address = details.publishAddress ? details.address : null;
  return listing || address || details.pressLinks.length ? { address, pressLinks: details.pressLinks, listing } : null;
}
