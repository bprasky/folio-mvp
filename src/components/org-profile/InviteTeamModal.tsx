'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GlassModal, GlassModalHeader, GlassModalBody, GlassModalFooter } from '@/components/ui/glass-modal';

interface InviteTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName?: string;
}

interface SearchResult {
  id: string;
  name: string;
  email: string;
  profileImage: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

const ROLES = [
  { id: 'ADMIN', label: 'Admin' },
  { id: 'MANAGER', label: 'Manager' },
  { id: 'MEMBER', label: 'Member' },
] as const;

export default function InviteTeamModal({
  open,
  onOpenChange,
  orgId,
  orgName,
}: InviteTeamModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [sending, setSending] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load pending invites when modal opens
  useEffect(() => {
    if (open) {
      loadPendingInvites();
    }
  }, [open, orgId]);

  const loadPendingInvites = useCallback(async () => {
    try {
      const res = await fetch(`/api/orgs/${orgId}/team/invite`);
      if (res.ok) {
        const data = await res.json();
        setPendingInvites(data.invites || []);
      }
    } catch {
      // Silently fail
    }
  }, [orgId]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(searchQuery.trim())}&orgId=${orgId}&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users || []);
        }
      } catch {
        // Silently fail
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, orgId]);

  const handleInviteUser = useCallback(
    async (user: SearchResult) => {
      try {
        setInvitingUserId(user.id);
        const res = await fetch(`/api/orgs/${orgId}/team/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            role,
            invitedUserId: user.id,
          }),
        });

        if (res.ok) {
          setSearchResults((prev) => prev.filter((u) => u.id !== user.id));
          await loadPendingInvites();
        }
      } catch (error) {
        console.error('Failed to invite user:', error);
      } finally {
        setInvitingUserId(null);
      }
    },
    [orgId, role, loadPendingInvites]
  );

  const handleEmailInvite = useCallback(async () => {
    if (!email.trim() || !email.includes('@')) return;

    try {
      setSending(true);
      const res = await fetch(`/api/orgs/${orgId}/team/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      if (res.ok) {
        setEmail('');
        await loadPendingInvites();
      }
    } catch (error) {
      console.error('Failed to send invite:', error);
    } finally {
      setSending(false);
    }
  }, [email, role, orgId, loadPendingInvites]);

  const handleRevoke = useCallback(
    async (inviteId: string) => {
      try {
        const res = await fetch(`/api/orgs/${orgId}/team/invite/${inviteId}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
        }
      } catch (error) {
        console.error('Failed to revoke invite:', error);
      }
    },
    [orgId]
  );

  const formatTimeAgo = (dateStr: string) => {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  return (
    <GlassModal open={open} onOpenChange={onOpenChange} size="md">
      <GlassModalHeader>
        <div className="flex items-center justify-between">
          <h3
            className="text-lg font-medium text-folio-text-primary"
            style={{ fontFamily: 'var(--font-headline)' }}
          >
            Invite to {orgName || 'your studio'}
          </h3>
          <button
            onClick={() => onOpenChange(false)}
            className="text-sm hover:opacity-70 text-folio-text-secondary"
          >
            &#10005;
          </button>
        </div>
      </GlassModalHeader>

      <GlassModalBody>
        <div className="flex flex-col gap-6">
          {/* Search existing users */}
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email"
              className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[var(--folio-gold)] border-folio-border-subtle bg-surface-ground text-folio-text-primary"
              style={{
                fontFamily: 'var(--font-body)',
              }}
            />

            {/* Search results */}
            {(searching || searchResults.length > 0) && (
              <div className="mt-2 flex flex-col gap-1">
                {searching && (
                  <p className="text-xs py-2 px-3 text-folio-text-secondary">
                    Searching...
                  </p>
                )}
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-ground border border-folio-border-subtle"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 bg-folio-border-subtle text-folio-text-secondary"
                    >
                      {user.profileImage ? (
                        <img
                          src={user.profileImage}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        user.name?.charAt(0)?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-folio-text-primary">
                        {user.name}
                      </p>
                      <p className="text-xs truncate text-folio-text-secondary">
                        {user.email}
                      </p>
                    </div>
                    <button
                      onClick={() => handleInviteUser(user)}
                      disabled={invitingUserId === user.id}
                      className="px-3 py-1 text-xs rounded-full transition-all hover:opacity-80 disabled:opacity-50 bg-folio-text-primary text-surface-ground"
                    >
                      {invitingUserId === user.id ? '...' : 'Invite'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-folio-border-subtle" />
            <span className="text-xs text-folio-text-secondary">
              or invite by email
            </span>
            <div className="flex-1 h-px bg-folio-border-subtle" />
          </div>

          {/* Email invite */}
          <div className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none transition-colors focus:border-[var(--folio-gold)] border-folio-border-subtle bg-surface-ground text-folio-text-primary"
              style={{
                fontFamily: 'var(--font-body)',
              }}
            />

            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-folio-text-secondary">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-full border appearance-none cursor-pointer text-folio-text-secondary"
                style={{
                  borderColor: '#D4CEC6',
                  backgroundColor: 'transparent',
                }}
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>

              <div className="flex-1" />

              <button
                onClick={handleEmailInvite}
                disabled={!email.trim() || !email.includes('@') || sending}
                className="px-5 py-2 text-sm rounded-full transition-all hover:opacity-80 disabled:opacity-50 bg-folio-text-primary text-surface-ground"
              >
                {sending ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-folio-border-subtle" />
                <span className="text-xs text-folio-text-secondary">
                  Pending Invites
                </span>
                <div className="flex-1 h-px bg-folio-border-subtle" />
              </div>

              <div className="flex flex-col gap-2">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs bg-surface-ground"
                  >
                    <span className="flex-1 truncate text-folio-text-primary">
                      {invite.email}
                    </span>
                    <span className="text-folio-text-secondary">
                      {formatTimeAgo(invite.createdAt)}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full bg-folio-border-subtle text-folio-text-secondary"
                    >
                      {invite.role}
                    </span>
                    <button
                      onClick={() => handleRevoke(invite.id)}
                      className="hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--folio-gold)' }}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </GlassModalBody>
    </GlassModal>
  );
}
