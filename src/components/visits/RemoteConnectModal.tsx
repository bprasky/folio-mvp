'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { GlassModal, GlassModalBody } from '@/components/ui/glass-modal';

interface SearchResult {
  id: string;
  name: string;
  email: string;
  role: string;
  profileImage: string | null;
  studio: string | null;
}

interface RemoteConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RemoteConnectModal({ open, onOpenChange }: RemoteConnectModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&limit=10`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data.users || []);
    } catch {
      setError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    // Debounce search
    const timer = setTimeout(() => search(value), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleConnect = async (userId: string) => {
    setConnecting(userId);
    setError(null);
    try {
      const res = await fetch('/api/visits/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientUserId: userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to connect');
      }
      const data = await res.json();
      onOpenChange(false);
      router.push(`/visits/${data.visit.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setConnecting(null);
    }
  };

  const roleLabels: Record<string, string> = {
    DESIGNER: 'Designer',
    VENDOR: 'Vendor Rep',
    ADMIN: 'Admin',
    HOMEOWNER: 'Homeowner',
    GUEST: 'Guest',
  };

  return (
    <GlassModal open={open} onOpenChange={onOpenChange} size="md">
      <GlassModalBody className="px-6 md:px-8 py-8">
        <h2
          className="text-folio-text-primary"
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            fontWeight: 400,
            margin: '0 0 16px',
          }}
        >
          Add Connection
        </h2>

        <p
          className="text-folio-text-secondary"
          style={{
            fontFamily: 'var(--font-body, "Instrument Sans", sans-serif)',
            fontSize: '13px',
            margin: '0 0 16px',
          }}
        >
          Search by name or email to connect with someone on Folio.
        </p>

        {/* Search input */}
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search by name or email..."
          autoFocus
          className="w-full px-4 py-3 rounded-xl border text-sm border-folio-border-subtle bg-surface-ground text-folio-text-primary"
          style={{
            fontFamily: 'var(--font-body, "Instrument Sans", sans-serif)',
            outline: 'none',
          }}
        />

        {error && (
          <p className="text-red-500 text-xs mt-2">{error}</p>
        )}

        {/* Results */}
        <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
          {searching && (
            <div className="text-center py-4">
              <p className="text-xs text-folio-text-tertiary">Searching...</p>
            </div>
          )}

          {!searching && query.length >= 2 && results.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-folio-text-tertiary">No users found.</p>
              <p className="text-xs text-folio-text-tertiary mt-1">
                Try a different name or use their full email address.
              </p>
            </div>
          )}

          {results.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-surface-ground transition-colors border-folio-border-subtle"
            >
              {user.profileImage ? (
                <Image
                  src={user.profileImage}
                  alt={user.name}
                  width={36}
                  height={36}
                  className="rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-surface-elevated flex items-center justify-center text-folio-text-tertiary text-sm font-medium shrink-0">
                  {user.name.charAt(0)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-folio-text-primary truncate">{user.name}</p>
                <p className="text-xs text-folio-text-tertiary truncate">
                  {roleLabels[user.role] || user.role}
                  {user.studio && ` at ${user.studio}`}
                </p>
              </div>

              <button
                onClick={() => handleConnect(user.id)}
                disabled={connecting === user.id}
                className="px-4 py-1.5 rounded-full text-xs font-medium text-white transition-colors disabled:opacity-50 bg-folio-text-primary"
              >
                {connecting === user.id ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
      </GlassModalBody>
    </GlassModal>
  );
}
