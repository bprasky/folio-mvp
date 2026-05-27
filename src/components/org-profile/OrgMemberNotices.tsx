'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Two banners that sit between the org hero and the tabs:
//   1. Owner-only — "you have members not on your team page; add them."
//      Pulls from GET /api/orgs/[orgId]/members/missing-from-team and posts
//      to /api/orgs/[orgId]/team/promote-member which copies the User's
//      headshot / bio / title into a TeamMember row.
//   2. Self — if the current user is a member of this org and their own
//      User.bio or User.profileImage is empty, nudge them to /profile so
//      their team-page card fills in.
//
// The two banners are independent; they can both render or neither.

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
  isOwner: boolean;
  isMember: boolean;
  currentUserNeedsProfile: boolean;
};

export function OrgMemberNotices({
  orgId,
  isOwner,
  isMember,
  currentUserNeedsProfile,
}: Props) {
  const [missing, setMissing] = useState<MissingMember[]>([]);
  const [actioningUserId, setActioningUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissedSelfNudge, setDismissedSelfNudge] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
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
  }, [orgId, isOwner]);

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
    isMember && currentUserNeedsProfile && !dismissedSelfNudge;
  const showOwnerBanner = isOwner && missing.length > 0;

  if (!showSelfNudge && !showOwnerBanner) return null;

  return (
    <div className="max-w-6xl mx-auto px-6 mt-6 flex flex-col gap-4">
      {showOwnerBanner && (
        <section
          className="p-4 rounded-2xl border"
          style={{
            borderColor: '#E8E4DF',
            backgroundColor: '#FFFFFF',
          }}
          aria-label="Members to add to team"
        >
          <div className="flex items-baseline justify-between mb-3">
            <h3
              className="text-sm font-medium"
              style={{ color: '#2C2825' }}
            >
              {missing.length} member{missing.length === 1 ? '' : 's'} not on
              your team page
            </h3>
            <span className="text-xs" style={{ color: '#8B8178' }}>
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
                  className="flex items-center gap-3 p-2 rounded-xl"
                  style={{ backgroundColor: '#F5F3F0' }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm overflow-hidden"
                    style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
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
                      style={{ color: '#2C2825' }}
                    >
                      {name}
                    </p>
                    <p className="text-xs" style={{ color: '#8B8178' }}>
                      {m.title || m.orgRole.toLowerCase()}
                      {!m.hasBio ? (
                        <span style={{ color: '#A14040' }}>
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
                    className="px-3 py-1.5 text-xs rounded-full transition-all hover:opacity-80 disabled:opacity-50 shrink-0"
                    style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
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
              style={{ color: '#A14040' }}
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </section>
      )}

      {showSelfNudge && (
        <section
          className="p-4 rounded-2xl border flex items-center gap-4"
          style={{
            borderColor: '#E8E4DF',
            backgroundColor: '#FFFFFF',
          }}
          aria-label="Complete your profile"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: '#2C2825' }}>
              Complete your bio so it appears on the team page
            </p>
            <p className="text-xs mt-1" style={{ color: '#8B8178' }}>
              Your photo and bio populate your team card here. Without them
              you&rsquo;ll show as initials and an empty card.
            </p>
          </div>
          <Link
            href="/profile"
            className="px-3 py-1.5 text-xs rounded-full whitespace-nowrap shrink-0"
            style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
          >
            Complete profile
          </Link>
          <button
            type="button"
            onClick={() => setDismissedSelfNudge(true)}
            className="text-xs px-2 py-1.5 rounded-full shrink-0"
            style={{ color: '#8B8178' }}
            aria-label="Dismiss"
          >
            Later
          </button>
        </section>
      )}
    </div>
  );
}
