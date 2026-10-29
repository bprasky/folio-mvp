'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { normalizeFirmName, type FirmMatch } from '@/lib/onboarding/firm-name';
import { safeProfessionalCallback, firmWorkspaceDestination } from '@/lib/onboarding/professional-entry';
import { AccountStatus, type ProfessionalAccount } from './_AccountStatus';
import { SetupProgress } from '@/components/onboarding/SetupProgress';

export type OrgIntent = 'designer' | 'architect' | 'builder' | 'vendor';
export type FirmMembership = FirmMatch & { membershipRole: string };

type Props = {
  initialIntent: OrgIntent | null;
  callbackUrl?: string;
  memberships?: FirmMembership[];
  existingOnly?: boolean;
  accountOverview?: boolean;
  account?: ProfessionalAccount;
  initialFirm?: FirmMatch | null;
};

export function ScenarioA({ initialIntent, callbackUrl = '/projects/new', memberships = [], existingOnly = false, accountOverview = false, account, initialFirm = null }: Props) {
  const router = useRouter();
  const { update } = useSession();
  const [query, setQuery] = useState(initialFirm?.name ?? '');
  const [intent, setIntent] = useState<OrgIntent>(initialIntent ?? 'designer');
  const [results, setResults] = useState<FirmMatch[]>([]);
  const [selected, setSelected] = useState<FirmMatch | null>(initialFirm);
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const [searchError, setSearchError] = useState('');
  const [retry, setRetry] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showResults, setShowResults] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState('');
  const [requested, setRequested] = useState<string | null>(null);
  const [notificationIssue, setNotificationIssue] = useState(false);
  const [needsAdmin, setNeedsAdmin] = useState(false);
  const destination = safeProfessionalCallback(callbackUrl);
  const preparingWorkspace = destination.startsWith('/onboarding/workspace');
  const key = normalizeFirmName(query);
  const ready = selected !== null || searchedQuery === key;
  const exactMatches = ready ? results.filter((org) => normalizeFirmName(org.name) === key) : [];
  const match = selected ?? (exactMatches.length === 1 ? exactMatches[0] : ready && results.length === 1 ? results[0] : null);
  const ownMembership = match ? memberships.find((org) => org.id === match.id) : undefined;
  const viewOwnFirm = ownMembership?.membershipRole === 'VIEWER' || destination === '/settings';
  const ownFirmAction = viewOwnFirm ? 'View firm' : 'Continue with firm';
  const ambiguous = !selected && !match && ready && results.length > 1;
  const canCreate = key.length >= 2 && ready && !searchError && !match && !ambiguous;
  const busy = key.length >= 2 && !ready && !searchError;
  const options = showResults && !selected && ready ? results : [];
  const accountStatus = account ? <AccountStatus account={account} memberships={memberships} /> : null;

  useEffect(() => {
    if (selected || existingOnly || accountOverview) return;
    setSearchError('');
    setActiveIndex(-1);
    if (key.length < 2) { setResults([]); setSearchedQuery(null); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/onboarding/firm/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not search firms.');
        if (!controller.signal.aborted) {
          setResults(data.results ?? []);
          setSearchedQuery(key);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearchedQuery(null);
          setSearchError(err instanceof Error ? err.message : 'Could not search firms.');
        }
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, key, selected, retry, existingOnly, accountOverview]);

  function choose(org: FirmMatch) {
    setSelected(org);
    setQuery(org.name);
    setError('');
    setConfirmed(false);
    setShowResults(false);
    setActiveIndex(-1);
  }

  async function openWorkspace(organizationId: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/user/workspace-context', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatingAsOrgId: organizationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not open your firm.');
      await update();
      const firm = data.user?.operatingAsOrg;
      router.replace(firm ? firmWorkspaceDestination(firm, destination) : destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open your firm.');
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current || !ready || searchError || ambiguous || key.length < 2) return;
    if (ownMembership) {
      if (viewOwnFirm) router.push(`/org/${ownMembership.id}`);
      else await openWorkspace(ownMembership.id);
      return;
    }
    if (!match && (!canCreate || !confirmed)) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(match ? `/api/orgs/${match.id}/join` : '/api/auth/org-setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(match ? {} : { name: query.trim(), type: intent, confirmed: true }),
      });
      const data = await response.json();
      if (response.status === 409 && data.code === 'FIRM_EXISTS' && data.organization) {
        choose(data.organization);
        setResults([data.organization]);
        setError('This firm is already on Folio. Request access to its existing page.');
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Could not save your request.');
      await update();
      if (match) {
        setRequested(match.name);
        setNeedsAdmin(data.notifications?.inApp === false);
        setNotificationIssue(data.notifications?.inApp !== true && data.notifications?.inApp !== undefined || data.notifications?.email === 'failed' || data.notifications?.email === 'unavailable');
      } else {
        router.replace(firmWorkspaceDestination(data.org, destination));
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (accountOverview) return (
    <>
      <h1 className="folio-h2">Your professional account</h1>
      {accountStatus}
      {memberships.length > 1 ? <section aria-label="Firm memberships" className="space-y-3">
        <h2 className="folio-ui">Your firms</h2>
        {memberships.map((org) => <div key={org.id} className="flex justify-between gap-4 folio-body">
          <Link className="underline underline-offset-4" href={`/org/${org.id}`}>{org.name}</Link>
          <span className="folio-meta text-folio-text-secondary">{org.membershipRole.charAt(0) + org.membershipRole.slice(1).toLowerCase()}</span>
        </div>)}
      </section> : null}
      <Link className="auth-submit" href="/auth/org-setup?add=1">Join or create another firm</Link>
      <Link className="underline underline-offset-4" href="/onboarding/workspace">Import from your website</Link>
      <Link className="underline underline-offset-4" href="/settings">Manage firm access</Link>
    </>
  );

  if (existingOnly) return (
    <>
      {preparingWorkspace ? <SetupProgress step={2} /> : null}
      <h1 className="folio-h2">Choose your firm</h1>
      <p className="folio-body text-folio-text-secondary">Where does this work belong?</p>
      {accountStatus}
      <div className="space-y-3">
        {memberships.filter((org) => org.membershipRole !== 'VIEWER').map((org) => <button key={org.id} type="button" className="auth-secondary" disabled={submitting} onClick={() => openWorkspace(org.id)}>{org.name}</button>)}
      </div>
      {error ? <p role="alert" className="auth-message auth-message--error">{error}</p> : null}
      <Link className="underline underline-offset-4" href={`/auth/org-setup?add=1&callbackUrl=${encodeURIComponent(destination)}`}>Add another firm</Link>
    </>
  );

  if (requested) return (
    <>
      {preparingWorkspace ? <SetupProgress step={2} /> : null}
      <h1 className="folio-h2">{needsAdmin ? 'Request saved' : 'Request sent'}</h1>
      <p className="folio-body text-folio-text-secondary">{needsAdmin ? `${requested} doesn’t have an active admin yet. Your request is saved. Contact Folio to arrange access to its existing page.` : `Your request to join ${requested} is awaiting approval from a firm admin. You can browse Folio while you wait.`}</p>
      {needsAdmin ? <a href={`mailto:support@folioad.com?subject=${encodeURIComponent(`Firm access: ${requested}`)}`} className="underline underline-offset-4">Contact Folio about this firm</a> : notificationIssue ? <p role="status" className="folio-meta text-folio-text-secondary">Your request is saved, but we couldn’t send every admin notification. You can contact your firm’s admin directly or check the request in Settings.</p> : null}
      <Link className="auth-submit" href="/">Explore Folio</Link>
      <Link className="underline underline-offset-4" href="/settings">View your access requests</Link>
      {preparingWorkspace ? <p className="folio-body text-folio-text-secondary">Once your admin approves access, <Link className="underline" href={match ? firmWorkspaceDestination(match, destination) : destination}>return here to prepare your workspace</Link>. We can then import your website and save project drafts.</p> : null}
    </>
  );

  return (
    <>
      {preparingWorkspace ? <SetupProgress step={2} /> : null}
      <div>
        <p className="folio-meta text-folio-text-secondary mb-2">Professional setup</p>
        <h1 className="folio-h2">{memberships.length ? 'Add another firm' : 'What is your firm called?'}</h1>
        <p className="folio-body text-folio-text-secondary mt-3">Your personal account is ready. Posting on Folio requires a business. Find yours below, or create its page if it isn’t here yet.</p>
        {preparingWorkspace ? <p className="folio-meta text-folio-text-secondary mt-3">Next: let Folio prepare your business details, bio, and project drafts from your website.</p> : null}
      </div>
      {accountStatus}
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="firm-name" className="block folio-ui mb-2">Firm name</label>
          <input id="firm-name" name="firmName" role="combobox" aria-autocomplete="list" aria-expanded={options.length > 0}
            aria-controls="firm-options" aria-activedescendant={activeIndex >= 0 && options[activeIndex] ? `firm-option-${options[activeIndex].id}` : undefined}
            aria-describedby="firm-help firm-search-status" autoComplete="off" maxLength={120} required minLength={2}
            className="auth-field__input" placeholder="Start typing your firm name" value={query} disabled={submitting}
            onFocus={() => setShowResults(true)}
            onChange={(event) => { setQuery(event.target.value); setSelected(null); setConfirmed(false); setError(''); setShowResults(true); }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && options.length) { event.preventDefault(); setActiveIndex((index) => (index + 1) % options.length); }
              if (event.key === 'ArrowUp' && options.length) { event.preventDefault(); setActiveIndex((index) => (index - 1 + options.length) % options.length); }
              if (event.key === 'Escape') { setShowResults(false); setActiveIndex(-1); }
              if (event.key === 'Enter' && activeIndex >= 0 && options[activeIndex]) { event.preventDefault(); choose(options[activeIndex]); }
            }} />
          <p id="firm-help" className="folio-meta text-folio-text-secondary mt-2">Select a match, or keep typing the full name of your new firm.</p>
          <p id="firm-search-status" role="status" aria-live="polite" className="folio-meta text-folio-text-secondary mt-2">
            {busy ? 'Searching firms…' : match ? `${match.name} is already on Folio.` : ambiguous ? 'Select your firm below, or keep typing its full name.' : ready && key.length >= 2 && !searchError ? 'You can create a firm with this name.' : ''}
          </p>
          {options.length ? <ul id="firm-options" role="listbox" aria-label="Matching firms" className="mt-3 divide-y divide-folio-border-subtle rounded-xl border border-folio-border-subtle overflow-hidden">
            {options.map((org, index) => <li key={org.id} role="presentation"><button type="button" role="option" id={`firm-option-${org.id}`} aria-selected={activeIndex === index || match?.id === org.id} tabIndex={-1}
              className={`w-full text-left px-4 py-3 hover:bg-surface-ground ${activeIndex === index ? 'bg-surface-ground' : ''}`} onClick={() => choose(org)}>
              <span className="block folio-ui">{org.name}</span><span className="folio-meta text-folio-text-secondary">{[org.location, org.type.toLowerCase().replace(/_/g, ' ')].filter(Boolean).join(' · ')}</span>
            </button></li>)}
          </ul> : <ul id="firm-options" role="listbox" aria-label="Matching firms" hidden />}
        </div>
        {searchError ? <div role="alert" className="auth-message auth-message--error">{searchError} <button type="button" className="underline" onClick={() => setRetry((value) => value + 1)}>Try again</button></div> : null}
        {canCreate ? <>
          <label className="block folio-ui">Firm type<select className="auth-field__input mt-2" value={intent} onChange={(event) => setIntent(event.target.value as OrgIntent)} disabled={submitting}>
            <option value="designer">Design firm</option><option value="architect">Architecture firm</option><option value="builder">Building company</option><option value="vendor">Vendor or brand</option>
          </select></label>
          <label className="flex items-start gap-3 folio-meta text-folio-text-secondary"><input type="checkbox" className="mt-1" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={submitting} />
            <span>I confirm I’m authorized to create this firm’s page. I’ll be its owner and can post right away.</span>
          </label>
        </> : null}
        {error ? <p role="alert" className="auth-message auth-message--error">{error}</p> : null}
        <button type="submit" className="auth-submit" disabled={submitting || !ready || !!searchError || ambiguous || key.length < 2 || (!match && !confirmed)}>
          {submitting ? 'Saving…' : ownMembership ? ownFirmAction : match ? 'Request access to join firm' : busy ? 'Searching…' : ambiguous ? 'Select your firm' : 'Create firm'}
        </button>
        {match && !ownMembership ? <p className="folio-meta text-folio-text-secondary">A firm admin will review your request. Posting access starts after approval and follows the firm’s settings.</p> : null}
        {ownMembership?.membershipRole === 'VIEWER' ? <p className="folio-meta text-folio-text-secondary">You have view-only access to this firm. Ask a firm admin for permission to create or post work.</p> : null}
      </form>
    </>
  );
}
