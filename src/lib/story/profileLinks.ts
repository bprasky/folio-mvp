export type ProfileReference = { name: string; href: string };
type Identity = { id?: unknown; name?: unknown; studio?: unknown };
type Credit = { name?: unknown; userId?: unknown; organizationId?: unknown; url?: unknown };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const route = (kind: 'profile' | 'org', id: unknown) => text(id) ? `/${kind}/${encodeURIComponent(text(id))}` : null;

/** Only canonical public profile routes, never a name-derived username. */
export function creditProfileHref(credit: Credit): string | null {
  const linked = route('profile', credit.userId) || route('org', credit.organizationId);
  if (linked) return linked;
  try {
    const value = text(credit.url);
    if (!value || value.startsWith('//')) return null;
    const url = new URL(value, 'https://folioad.com');
    if (url.protocol !== 'https:' || !['folioad.com', 'www.folioad.com'].includes(url.hostname) || url.username || url.password) return null;
    return /^\/(profile|org|monograph|photographer)\/[^/]+\/?$/.test(url.pathname) ? url.pathname : null;
  } catch { return null; }
}

export function externalCreditHref(value: unknown): string | null {
  try {
    const url = new URL(text(value));
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function publicationProfiles(project?: { designer?: Identity | null; designerOrg?: Identity | null; designerId?: unknown } | null, credits: Credit[] = []): ProfileReference[] {
  const refs = new Map<string, ProfileReference | null>();
  const add = (name: unknown, href: string | null) => {
    const label = text(name), key = label.toLocaleLowerCase();
    if (!label || !href) return;
    const previous = refs.get(key);
    // Ambiguous same-name credits must never silently point at the wrong person.
    refs.set(key, previous === null || (previous && previous.href !== href) ? null : { name: label, href });
  };
  const person = route('profile', project?.designer?.id || project?.designerId);
  const firm = route('org', project?.designerOrg?.id);
  add(project?.designer?.name, person);
  add(project?.designerOrg?.name, firm || person);
  add(project?.designer?.studio, firm || person);
  for (const credit of credits) add(credit.name, creditProfileHref(credit));
  return Array.from(refs.values()).filter((value): value is ProfileReference => !!value);
}

export function namedProfileHref(name: string, refs: ProfileReference[] = []): string | null {
  return refs.find(ref => ref.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase())?.href || null;
}
