import type { Metadata } from 'next';

export function publicOrigin(): string {
  try { const url = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://folioad.com'); return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : 'https://folioad.com'; }
  catch { return 'https://folioad.com'; }
}
export function absolutePublicUrl(path: string) { return `${publicOrigin()}${path.startsWith('/') ? path : `/${path}`}`; }
export function externalIdentityUrl(value?: string | null) {
  if (!value) return undefined;
  try { const url = new URL(value.startsWith('http') ? value : `https://${value}`); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; }
  catch { return undefined; }
}
export type PublicIdentity = { id: string; name: string; description?: string | null; location?: string | null;
  website?: string | null; image?: string | null; specialties?: string[]; kind: 'Person' | 'Organization' };
export function identityPath(identity: Pick<PublicIdentity, 'id' | 'kind'>) {
  return `/${identity.kind === 'Person' ? 'profile' : 'org'}/${encodeURIComponent(identity.id)}`;
}
export function profileMetadata(identity: PublicIdentity): Metadata {
  const title = `${identity.name}${identity.location ? ` — ${identity.location}` : ''} | Folio`;
  const description = (identity.description?.trim() || `${identity.name}${identity.location ? ` in ${identity.location}` : ''}. Explore published work, perspectives and features on Folio.`).replace(/\s+/g, ' ').slice(0, 180);
  const url = absolutePublicUrl(identityPath(identity));
  const images = identity.image ? [{ url: identity.image, alt: identity.name }] : [];
  return { title, description, alternates: { canonical: url },
    robots: process.env.VERCEL_ENV === 'preview' ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { type: 'profile', title, description, url, images }, twitter: { card: identity.image ? 'summary_large_image' : 'summary', title, description, images } };
}
export function identityStructuredData(identity: PublicIdentity) {
  const url = absolutePublicUrl(identityPath(identity));
  return { '@context': 'https://schema.org', '@type': 'ProfilePage', '@id': `${url}#page`, url,
    mainEntity: { '@type': identity.kind, '@id': `${url}#identity`, name: identity.name, url,
      ...(identity.description ? { description: identity.description } : {}),
      ...(identity.image ? { image: identity.image } : {}),
      ...(externalIdentityUrl(identity.website) ? { sameAs: [externalIdentityUrl(identity.website)] } : {}),
      ...(identity.specialties?.length ? { knowsAbout: identity.specialties } : {}) } };
}
export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
