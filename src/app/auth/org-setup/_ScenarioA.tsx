'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export type OrgIntent = 'designer' | 'architect' | 'builder' | 'vendor';

const TYPE_COPY: Record<OrgIntent, { noun: string }> = {
  designer: { noun: 'studio' },
  architect: { noun: 'practice' },
  builder: { noun: 'company' },
  vendor: { noun: 'brand' },
};

const INTENT_TO_SEARCH_TYPE: Record<OrgIntent, string> = {
  designer: 'DESIGNER',
  architect: 'ARCHITECT',
  builder: 'BUILDER',
  vendor: 'VENDOR',
};

const ORG_TYPE_LABEL: Record<string, string> = {
  DESIGN_FIRM: 'Design firm',
  ARCHITECTURE_FIRM: 'Architecture firm',
  CONTRACTOR: 'Construction',
  VENDOR: 'Vendor',
  MANUFACTURER: 'Manufacturer',
  SHOWROOM: 'Showroom',
  PHOTOGRAPHY_STUDIO: 'Photography',
  DEVELOPER: 'Developer',
};

const ONBOARDING_REDIRECT = '/onboarding/diagnostic';

type SearchOrg = {
  id: string;
  name: string;
  type: string;
  status?: string;
};

type Props = {
  initialIntent: OrgIntent | null;
  // Heading override (used when ScenarioB embeds this flow under "Create separate").
  headingOverride?: { eyebrowGold?: string; title?: string; sub?: string };
  // When ScenarioB renders this, suppress the eyebrow row entirely so the page
  // doesn't show two eyebrows stacked.
  hideEyebrow?: boolean;
  // Called when the user wants to back out of the create-separate flow.
  onBack?: () => void;
};

export function ScenarioA({ initialIntent, headingOverride, hideEyebrow, onBack }: Props) {
  const router = useRouter();
  const intent = initialIntent;
  const copy = intent ? TYPE_COPY[intent] : null;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchOrg[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [createName, setCreateName] = useState('');
  const [createWebsite, setCreateWebsite] = useState('');
  const [createLocation, setCreateLocation] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'error' | 'success' | null>(null);
  const [done, setDone] = useState(false);

  const searchAbortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      if (!intent) return;
      if (q.trim().length < 2) {
        setResults([]);
        setSearchError('');
        setSearching(false);
        return;
      }
      searchAbortRef.current?.abort();
      const ac = new AbortController();
      searchAbortRef.current = ac;
      setSearching(true);
      setSearchError('');
      try {
        const url = `/api/orgs/search?q=${encodeURIComponent(q.trim())}&type=${INTENT_TO_SEARCH_TYPE[intent]}`;
        const res = await fetch(url, { signal: ac.signal });
        const data = await res.json();
        if (!res.ok) {
          setSearchError(data.error || 'Search failed');
          setResults([]);
        } else {
          setResults(Array.isArray(data.organizations) ? data.organizations : []);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setSearchError('Search failed. Please try again.');
          setResults([]);
        }
      } finally {
        if (!ac.signal.aborted) setSearching(false);
      }
    },
    [intent]
  );

  useEffect(() => {
    if (!intent) return;
    const handle = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(handle);
  }, [query, intent, runSearch]);

  const handleJoin = async (org: SearchOrg) => {
    if (submitting) return;
    setSubmitting(true);
    setStatusMessage('');
    setStatusType(null);
    try {
      const res = await fetch('/api/auth/org-setup/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMessage(data.error || 'Could not join the organization.');
        setStatusType('error');
        setSubmitting(false);
        return;
      }
      setStatusMessage(`You’re now part of ${org.name}. Taking you to onboarding next…`);
      setStatusType('success');
      setDone(true);
      setTimeout(() => {
        router.replace(ONBOARDING_REDIRECT);
        router.refresh();
      }, 1400);
    } catch {
      setStatusMessage('Could not join the organization. Please try again.');
      setStatusType('error');
      setSubmitting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !intent) return;
    if (createName.trim().length < 2) {
      setStatusMessage('Organization name must be at least 2 characters.');
      setStatusType('error');
      return;
    }
    setSubmitting(true);
    setStatusMessage('');
    setStatusType(null);
    try {
      const res = await fetch('/api/auth/org-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          type: intent,
          website: createWebsite.trim() || undefined,
          location: createLocation.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMessage(data.error || 'Could not create your organization.');
        setStatusType('error');
        setSubmitting(false);
        return;
      }
      setStatusMessage(`${data.organizationName} is on Folio. Taking you to onboarding next…`);
      setStatusType('success');
      setDone(true);
      setTimeout(() => {
        router.replace(ONBOARDING_REDIRECT);
        router.refresh();
      }, 1400);
    } catch {
      setStatusMessage('Could not create your organization. Please try again.');
      setStatusType('error');
      setSubmitting(false);
    }
  };

  const startCreate = () => {
    setMode('create');
    if (!createName) setCreateName(query.trim());
    setStatusMessage('');
    setStatusType(null);
  };

  const backToSearch = () => {
    setMode('search');
    setStatusMessage('');
    setStatusType(null);
  };

  // Missing/invalid intent fallback — only reachable when ScenarioA is the
  // sole renderer (page.tsx Server Component sends users with no orgs here).
  if (!intent) {
    return (
      <>
        {!hideEyebrow ? (
          <div className="auth-eyebrow">
            <span className="auth-eyebrow__gold">One more step</span>
          </div>
        ) : null}
        <h1 className="auth-title">Tell us who you are first.</h1>
        <p className="auth-sub">
          We need to know whether you&rsquo;re a designer, architect, builder, or
          vendor before we can find your organization. Head back to sign-up and
          choose a role.
        </p>
        <Link href="/auth/signup" className="auth-submit">
          Back to sign-up
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </Link>
        <div className="auth-form-foot">
          <Link href={ONBOARDING_REDIRECT}>Skip for now</Link> — you can add an
          organization later from your profile.
        </div>
      </>
    );
  }

  const eyebrowGold = headingOverride?.eyebrowGold ?? 'Almost there';
  const titleSearch = headingOverride?.title ?? `Let’s find your ${copy!.noun}.`;
  const subSearch =
    headingOverride?.sub ??
    `Search by name. If your ${copy!.noun} isn’t on Folio yet, you can add it in a moment.`;

  return (
    <>
      {!hideEyebrow ? (
        <div className="auth-eyebrow">
          <span className="auth-eyebrow__gold">{eyebrowGold}</span>
          <span className="auth-eyebrow__dot" />
          <span>Step two</span>
        </div>
      ) : null}

      {mode === 'search' ? (
        <>
          <h1 className="auth-title">{titleSearch}</h1>
          <p className="auth-sub">{subSearch}</p>

          <div className="auth-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="auth-search__icon">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              className="auth-search__input"
              placeholder={`Search for your ${copy!.noun}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              autoComplete="off"
              disabled={submitting || done}
            />
            {searching ? <span className="auth-search__hint">Searching…</span> : null}
          </div>

          {searchError ? (
            <div className="auth-message auth-message--error" role="alert">
              {searchError}
            </div>
          ) : null}

          {query.trim().length >= 2 && !searching && results.length === 0 && !searchError ? (
            <p className="auth-search__empty">No matches for &ldquo;{query.trim()}&rdquo; yet.</p>
          ) : null}

          {results.length > 0 ? (
            <ul className="auth-results">
              {results.map((org) => (
                <li key={org.id} className="auth-result">
                  <div className="auth-result__main">
                    <span className="auth-result__name">{org.name}</span>
                    <span className="auth-result__meta">
                      {ORG_TYPE_LABEL[org.type] ?? org.type}
                      {org.status && org.status !== 'UNCLAIMED' ? ` · ${org.status.toLowerCase()}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="auth-result__cta"
                    onClick={() => handleJoin(org)}
                    disabled={submitting || done}
                  >
                    {submitting ? 'Joining…' : 'Join'}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {statusMessage ? (
            <div
              className={`auth-message ${
                statusType === 'success' ? 'auth-message--success' : 'auth-message--error'
              }`}
              role={statusType === 'error' ? 'alert' : 'status'}
            >
              {statusMessage}
            </div>
          ) : null}

          <button
            type="button"
            className="auth-secondary"
            onClick={startCreate}
            disabled={submitting || done}
          >
            I don&rsquo;t see my {copy!.noun} — create one
          </button>

          <div className="auth-form-foot">
            {onBack ? (
              <button type="button" className="auth-linklike" onClick={onBack} disabled={submitting || done}>
                ← Back
              </button>
            ) : (
              <>
                <Link href={ONBOARDING_REDIRECT}>I&rsquo;ll do this later</Link> — you
                can add an organization any time from your profile.
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <h1 className="auth-title">Add your {copy!.noun}.</h1>
          <p className="auth-sub">
            Name it as it appears on your work. You can fill in the rest of the
            details later.
          </p>

          <form className="auth-form" onSubmit={handleCreate} noValidate>
            <div className="auth-field">
              <div className="auth-field__head">
                <label htmlFor="org-name" className="auth-field__label">
                  {copy!.noun.charAt(0).toUpperCase() + copy!.noun.slice(1)} name
                </label>
              </div>
              <input
                id="org-name"
                name="name"
                type="text"
                className="auth-field__input"
                placeholder={`Your ${copy!.noun}`}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
                minLength={2}
                disabled={submitting || done}
                autoFocus
              />
            </div>

            <div className="auth-field">
              <div className="auth-field__head">
                <label htmlFor="org-location" className="auth-field__label">
                  Location
                </label>
                <span className="auth-field__helper">Optional</span>
              </div>
              <input
                id="org-location"
                name="location"
                type="text"
                className="auth-field__input"
                placeholder="City, country"
                value={createLocation}
                onChange={(e) => setCreateLocation(e.target.value)}
                disabled={submitting || done}
              />
            </div>

            <div className="auth-field">
              <div className="auth-field__head">
                <label htmlFor="org-website" className="auth-field__label">
                  Website
                </label>
                <span className="auth-field__helper">Optional</span>
              </div>
              <input
                id="org-website"
                name="website"
                type="url"
                className="auth-field__input"
                placeholder="https://"
                value={createWebsite}
                onChange={(e) => setCreateWebsite(e.target.value)}
                disabled={submitting || done}
              />
            </div>

            {statusMessage ? (
              <div
                className={`auth-message ${
                  statusType === 'success' ? 'auth-message--success' : 'auth-message--error'
                }`}
                role={statusType === 'error' ? 'alert' : 'status'}
              >
                {statusMessage}
              </div>
            ) : null}

            <button
              type="submit"
              className="auth-submit"
              disabled={submitting || done || createName.trim().length < 2}
            >
              {submitting ? 'Creating…' : `Add ${copy!.noun}`}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          </form>

          <div className="auth-form-foot">
            <button type="button" className="auth-linklike" onClick={backToSearch} disabled={submitting || done}>
              Back to search
            </button>
          </div>
        </>
      )}
    </>
  );
}
