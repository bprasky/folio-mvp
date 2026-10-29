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
/** Verification can continue to enrollment, but must not restart authentication. */
export function signupReturnTo(value?: string | null): string {
  const target = safeCallbackPath(value, '/onboarding/diagnostic');
  const pathname = decodeURIComponent(new URL(target, 'https://folio.invalid').pathname).toLowerCase();
  return /^\/auth\/(signin|signup|verify-email)(\/|$)/.test(pathname) ? '/onboarding/diagnostic' : target;
}
/** Enrollment must finish at content, never restart authentication or enrollment. */
export function safeProfessionalCallback(value: string | null | undefined): string {
  const path = safeCallbackPath(value, '/projects/new');
  const pathname = decodeURIComponent(new URL(path, 'https://folio.invalid').pathname).replace(/\/+$/, '').toLowerCase();
  if (pathname === '/onboarding/workspace') return path;
  if (/^\/auth\/(org-setup|signin|signup|verify-email)(\/|$)/.test(pathname) || /^\/(onboarding|professionals)(\/|$)/.test(pathname)) return '/projects/new';
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
  if (pathname === '/onboarding/workspace') {
    const url = new URL(target, 'https://folio.invalid');
    url.searchParams.set('orgId', org.id);
    return url.pathname + url.search;
  }
  if (pathname !== '/projects/new' && pathname !== '/designer/create') return target;
  if (['DESIGN_FIRM', 'ARCHITECTURE_FIRM', 'CONTRACTOR'].includes(org.type)) return target;
  return '/org/' + encodeURIComponent(org.id);
}

/** New professionals see the same three steps regardless of their signup entry point. */
export function signupDestination(intent: string, callback?: string | null, startProject = false): string {
  const target = safeCallbackPath(callback);
  const url = new URL(target, 'https://folio.invalid');
  // A claim token already identifies the business; its own enrollment must run first.
  if (url.pathname === '/auth/claim') return target;
  if (url.pathname === '/auth/org-setup') {
    if (['designer', 'architect', 'builder', 'vendor'].includes(intent)) url.searchParams.set('type', intent);
    const next = safeProfessionalCallback(url.searchParams.get('callbackUrl'));
    if (!next.startsWith('/onboarding/workspace')) url.searchParams.set('callbackUrl', workspaceSetupHref(next));
    return url.pathname + url.search;
  }
  if (intent === 'browsing') {
    if (url.pathname === '/projects/new' || url.pathname === '/designer/create')
      return professionalSetupHref('designer', workspaceSetupHref(target));
    return target !== '/' ? target : '/onboarding/diagnostic';
  }
  return professionalSetupHref(intent, workspaceSetupHref(target !== '/' ? target : startProject ? '/projects/new' : '/settings'));
}

export function workspaceSetupHref(returnTo = '/projects/new'): string {
  const next = safeProfessionalCallback(returnTo);
  return '/onboarding/workspace?returnTo=' + encodeURIComponent(next.startsWith('/onboarding/workspace') ? '/projects/new' : next);
}
