'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import forms from '@/components/ui/WorkflowForms.module.css';

interface MissingMember {
  userId: string;
  orgRole: string;
  name: string | null;
  email: string;
  profileImage: string | null;
  title: string | null;
  hasBio: boolean;
}

type Props = {
  orgId: string;
  canAddToTeam: boolean;
  isMember: boolean;
  isOwner: boolean;
  currentUserNeedsProfile: boolean;
};

export function OrgMemberNotices({
  orgId,
  canAddToTeam,
  isMember,
  isOwner,
  currentUserNeedsProfile,
}: Props) {
  const [missing, setMissing] = useState<MissingMember[]>([]);
  const [actioningUserId, setActioningUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissedSelfNudge, setDismissedSelfNudge] = useState(false);

  useEffect(() => {
    if (!canAddToTeam) return;
    let cancelled = false;
    fetch(`/api/orgs/${orgId}/members/missing-from-team`)
      .then((r) => (r.ok ? r.json() : { missing: [] }))
      .then((data) => {
        if (!cancelled) setMissing(data.missing || []);
      })
      .catch(() => {
        // Soft-fail: the rest of the org page still works.
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, canAddToTeam]);

  const handleAdd = async (userId: string) => {
    setActioningUserId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/team/promote-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not add to team.');
        return;
      }
      setMissing((prev) => prev.filter((m) => m.userId !== userId));
    } catch {
      setError('Could not add to team. Please try again.');
    } finally {
      setActioningUserId(null);
    }
  };

  const showSelfNudge =
    isOwner && isMember && currentUserNeedsProfile && !dismissedSelfNudge;
  const showTeamBanner = canAddToTeam && missing.length > 0;

  if (!showSelfNudge && !showTeamBanner) return null;

  return (
    <div className="max-w-3xl my-3 flex flex-col gap-2">
      {showTeamBanner && (
        <section
          className="p-4 rounded-2xl border"
          style={{
            borderColor: 'var(--folio-border-subtle)',
            backgroundColor: 'var(--surface-elevated)',
          }}
          aria-label="Members to add to team"
        >
          <div className="flex flex-wrap gap-1 items-baseline justify-between mb-3">
            <h3
              className="text-sm font-medium"
              style={{ color: 'var(--folio-text-primary)' }}
            >
              {missing.length} member{missing.length === 1 ? '' : 's'} not on
              your team page
            </h3>
            <span className="text-xs" style={{ color: 'var(--folio-text-secondary)' }}>
              Pulls photo & bio from their profile
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {missing.map((m) => {
              const name = m.name?.trim() || m.email;
              const initials = name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              const isActioning = actioningUserId === m.userId;
              return (
                <li
                  key={m.userId}
                  className="flex flex-wrap items-center gap-3 p-2 rounded-xl"
                  style={{ backgroundColor: 'var(--surface-canvas)' }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm overflow-hidden"
                    style={{ backgroundColor: 'var(--folio-border-subtle)', color: 'var(--folio-text-secondary)' }}
                  >
                    {m.profileImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.profileImage}
                        alt={name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm truncate"
                      style={{ color: 'var(--folio-text-primary)' }}
                    >
                      {name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--folio-text-secondary)' }}>
                      {m.title || m.orgRole.toLowerCase()}
                      {!m.hasBio ? (
                        <span style={{ color: 'var(--folio-text-secondary)' }}>
                          {' '}
                          · bio missing
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(m.userId)}
                    disabled={isActioning}
                    className={forms.primary}
                  >
                    {isActioning ? 'Adding…' : 'Add to team'}
                  </button>
                </li>
              );
            })}
          </ul>
          {error ? (
            <p
              className="text-xs mt-2"
              style={{ color: 'var(--folio-text-secondary)' }}
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </section>
      )}

      {showSelfNudge && (
        <section
          className="text-folio-text-primary px-4 py-3 rounded-xl flex flex-wrap items-center gap-3"
          style={{
            backgroundColor: 'var(--surface-canvas)',
          }}
          aria-label="Complete your profile"
        >
          <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-sm font-medium" style={{ color: 'var(--folio-text-primary)' }}>
              Complete your profile
            </p>
            <p className="text-xs" style={{ color: 'var(--folio-text-secondary)' }}>
              Add a photo and bio to appear on the team page.
            </p>
          </div>
          <Link
            href="/profile"
            className={forms.primary}
          >
            Complete
          </Link>
          <button
            type="button"
            onClick={() => setDismissedSelfNudge(true)}
            className={forms.quiet}
            aria-label="Dismiss"
          >
            Later
          </button>
        </section>
      )}
    </div>
  );
}
