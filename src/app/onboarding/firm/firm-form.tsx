'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GlassInput } from '@/components/ui/glass-input';

interface SearchResult {
  id: string;
  name: string;
  type: string;
  location: string | null;
  memberCount: number;
  adjacent: boolean;
}

interface FirmFormProps {
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  DESIGNER: 'Designer',
  ARCHITECT: 'Architect',
  BUILDER: 'Builder',
};

export function FirmForm({ role }: FirmFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [createName, setCreateName] = useState('');
  const [createCity, setCreateCity] = useState('');
  const [createState, setCreateState] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (mode !== 'search') return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/onboarding/firm/search?q=${encodeURIComponent(q)}`
        );
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data.results ?? []);
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode]);

  async function enrollJoin(organizationId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/firm/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'join', organizationId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not join firm');
      }
      router.replace('/onboarding/bio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  async function enrollCreate() {
    if (!createName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/firm/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create',
          name: createName.trim(),
          city: createCity.trim() || undefined,
          state: createState.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not create firm');
      }
      router.replace('/onboarding/bio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  async function enrollSolo() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/firm/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'solo' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not create solo practice');
      }
      router.replace('/onboarding/bio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  if (mode === 'create') {
    return (
      <div className="space-y-6">
        <p className="text-center text-folio-text-secondary font-body">
          Be the first to enroll your firm. You'll become an owner.
        </p>
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm text-folio-text-secondary font-body">
              Firm name
            </span>
            <GlassInput
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g., Kelly Wearstler Inc."
              className="mt-2"
              autoFocus
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-folio-text-secondary font-body">
                City
              </span>
              <GlassInput
                value={createCity}
                onChange={(e) => setCreateCity(e.target.value)}
                placeholder="Los Angeles"
                className="mt-2"
              />
            </label>
            <label className="block">
              <span className="text-sm text-folio-text-secondary font-body">
                State
              </span>
              <GlassInput
                value={createState}
                onChange={(e) => setCreateState(e.target.value)}
                placeholder="CA"
                className="mt-2"
              />
            </label>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 pt-2 items-center">
          <Button
            variant="accent"
            size="lg"
            onClick={enrollCreate}
            disabled={!createName.trim() || submitting}
            className="min-w-[200px]"
          >
            {submitting ? 'Creating…' : 'Create firm →'}
          </Button>
          <button
            type="button"
            onClick={() => setMode('search')}
            className="text-sm text-folio-text-tertiary hover:text-folio-text-secondary underline-offset-4 hover:underline"
          >
            Back to search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GlassInput
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your firm"
        autoFocus
      />

      {searching && (
        <p className="text-sm text-folio-text-tertiary text-center">Searching…</p>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => enrollJoin(r.id)}
                disabled={submitting}
                className="w-full text-left rounded-xl px-4 py-3 bg-surface-ground/60 border border-folio-border-subtle/70 hover:border-folio-border-subtle hover:bg-surface-ground/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-body text-folio-text-primary">
                    {r.name}
                  </span>
                  <span className="text-xs text-folio-text-tertiary">
                    {r.memberCount} member{r.memberCount === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="text-xs text-folio-text-tertiary mt-1 flex items-center gap-2">
                  {r.location && <span>{r.location}</span>}
                  {r.adjacent && (
                    <span className="text-[var(--accent)]">
                      · This is an {orgTypeLabel(r.type)} — join as{' '}
                      {adjacentRoleLabel(r.type)}?
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {searched && !searching && results.length === 0 && (
        <div className="text-center space-y-3 py-4">
          <p className="text-folio-text-secondary font-body">
            No match for "{query}".
          </p>
          <Button variant="ridge" size="lg" onClick={() => setMode('create')}>
            Be the first to enroll your firm
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 text-center" role="alert">
          {error}
        </p>
      )}

      <div className="text-center pt-4 space-y-2">
        <button
          type="button"
          onClick={enrollSolo}
          disabled={submitting}
          className="text-sm text-folio-text-secondary hover:text-folio-text-primary underline-offset-4 hover:underline"
        >
          I practice solo
        </button>
        <div>
          <button
            type="button"
            onClick={() => router.replace('/onboarding/bio')}
            disabled={submitting}
            className="text-xs text-folio-text-tertiary hover:text-folio-text-secondary underline-offset-4 hover:underline"
          >
            Skip for now
          </button>
        </div>
      </div>

      <p className="sr-only">{ROLE_LABEL[role]}</p>
    </div>
  );
}

function orgTypeLabel(type: string): string {
  switch (type) {
    case 'DESIGN_FIRM':
      return 'design firm';
    case 'ARCHITECTURE_FIRM':
      return 'architecture firm';
    case 'CONTRACTOR':
      return 'builder';
    default:
      return 'firm';
  }
}

function adjacentRoleLabel(type: string): string {
  switch (type) {
    case 'DESIGN_FIRM':
      return 'Designer';
    case 'ARCHITECTURE_FIRM':
      return 'Architect';
    case 'CONTRACTOR':
      return 'Builder';
    default:
      return 'member';
  }
}
