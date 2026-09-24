/** Client-safe navigation for professional enrollment. */
export function safeCallbackPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(decoded)) return fallback;
    const url = new URL(value, 'https://folio.invalid');
    return url.origin === 'https://folio.invalid' ? url.pathname + url.search + url.hash : fallback;
  } catch { return fallback; }
}
/** Enrollment must finish at content, never restart authentication or enrollment. */
export function safeProfessionalCallback(value: string | null | undefined): string {
  const path = safeCallbackPath(value, '/projects/new');
  const pathname = decodeURIComponent(new URL(path, 'https://folio.invalid').pathname).replace(/\/+$/, '').toLowerCase();
  if (/^\/auth\/(org-setup|signin|signup)(\/|$)/.test(pathname) || /^\/(onboarding|professionals)(\/|$)/.test(pathname)) return '/projects/new';
  return path;
}
export function professionalSetupHref(type?: string | null, callbackUrl?: string | null): string {
  const query = new URLSearchParams();
  if (type && ['designer', 'architect', 'builder', 'vendor'].includes(type.toLowerCase())) query.set('type', type.toLowerCase());
  if (callbackUrl) query.set('callbackUrl', safeProfessionalCallback(callbackUrl));
  return '/auth/org-setup' + (query.size ? '?' + query : '');
}
export function professionalEntryHref(signedIn: boolean, type?: string | null, callbackUrl?: string | null): string {
  const setup = professionalSetupHref(type, callbackUrl);
  return signedIn ? setup : '/auth/signin?callbackUrl=' + encodeURIComponent(setup);
}
export function projectEntryHref(user: { role?: string | null; operatingAsOrgId?: string | null } | null | undefined, callbackUrl = '/projects/new'): string {
  return user?.operatingAsOrgId ? safeProfessionalCallback(callbackUrl) : professionalEntryHref(!!user, 'designer', callbackUrl);
}

/** Keep the requested activity when the selected firm's tools support it. */
export function firmWorkspaceDestination(org: { id: string; type: string }, callbackUrl?: string | null): string {
  const target = safeProfessionalCallback(callbackUrl);
  const pathname = decodeURIComponent(new URL(target, 'https://folio.invalid').pathname).replace(/\/+$/, '');
  if (pathname !== '/projects/new' && pathname !== '/designer/create') return target;
  if (['DESIGN_FIRM', 'ARCHITECTURE_FIRM', 'CONTRACTOR'].includes(org.type)) return target;
  return '/org/' + encodeURIComponent(org.id);
}
