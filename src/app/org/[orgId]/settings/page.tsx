'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

// /org/[orgId]/settings is the org admin console: pending join requests
// and member management. Profile-field editing lives at /org/[orgId]/edit,
// reachable via the "Edit Profile" button on the org hero.

interface PendingJoinRequest {
  id: string;
  message: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    profileImage: string | null;
  };
}

type OrgRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';

interface Member {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  profileImage: string | null;
  orgRole: OrgRole;
  joinedAt: string;
}

const ROLE_ORDER: OrgRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];
const ROLE_LABEL: Record<OrgRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

export default function OrgSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const orgId = params.orgId as string;

  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [orgName, setOrgName] = useState('');

  const [pendingRequests, setPendingRequests] = useState<PendingJoinRequest[]>([]);
  const [requestActioningId, setRequestActioningId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [currentUserOrgRole, setCurrentUserOrgRole] = useState<OrgRole | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberActioningId, setMemberActioningId] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('MEMBER');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<
    { tone: 'success' | 'error'; text: string } | null
  >(null);

  useEffect(() => {
    async function loadOrg() {
      try {
        const res = await fetch(`/api/orgs/${orgId}`);
        if (res.ok) {
          const data = await res.json();
          setOrgName(data.name || '');
          const userMember = data.members?.find(
            (m: any) => m.userId === session?.user?.id
          );
          setIsAuthorized(
            userMember && ['OWNER', 'ADMIN'].includes(userMember.role)
          );
          setCurrentUserOrgRole(
            userMember?.role && ROLE_ORDER.includes(userMember.role)
              ? (userMember.role as OrgRole)
              : null
          );
        }
      } catch (error) {
        console.error('Failed to load org:', error);
      } finally {
        setLoading(false);
      }
    }
    if (session?.user) {
      loadOrg();
    }
  }, [orgId, session, router]);

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/orgs/${orgId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch {
      // Soft-fail
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const res = await fetch(`/api/orgs/${orgId}/join?status=PENDING`);
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data.requests || []);
      }
    } catch {
      // Soft-fail
    }
  };

  useEffect(() => {
    if (!isAuthorized) return;
    fetchPendingRequests();
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isAuthorized]);

  const handleRoleChange = async (member: Member, newRole: OrgRole) => {
    if (newRole === member.orgRole) return;
    if (newRole === 'OWNER') {
      const confirmed = window.confirm(
        `Transfer ownership of this organization to ${member.name || member.email}? You'll be demoted to Admin.`
      );
      if (!confirmed) return;
    }
    setMemberActioningId(member.id);
    setMemberError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/members/${member.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMemberError(data.error || 'Could not update role.');
        return;
      }
      if (newRole === 'OWNER') {
        await fetchMembers();
        setCurrentUserOrgRole('ADMIN');
        return;
      }
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, orgRole: newRole } : m))
      );
    } catch {
      setMemberError('Could not update role. Please try again.');
    } finally {
      setMemberActioningId(null);
    }
  };

  const handleRemoveMember = async (member: Member) => {
    const isSelf = member.userId === session?.user?.id;
    const verb = isSelf ? 'leave the organization' : `remove ${member.name || member.email}`;
    if (!window.confirm(`Are you sure you want to ${verb}?`)) return;
    setMemberActioningId(member.id);
    setMemberError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/members/${member.userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setMemberError(data.error || 'Could not remove member.');
        return;
      }
      if (isSelf) {
        router.replace('/');
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch {
      setMemberError('Could not remove member. Please try again.');
    } finally {
      setMemberActioningId(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteSubmitting) return;
    const email = inviteEmail.trim();
    if (!email || !email.includes('@')) {
      setInviteMessage({ tone: 'error', text: 'Enter a valid email.' });
      return;
    }
    setInviteSubmitting(true);
    setInviteMessage(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteMessage({ tone: 'error', text: data.error || 'Could not add member.' });
        return;
      }
      setInviteMessage({
        tone: 'success',
        text: data.message || `${data.membership?.name || email} added.`,
      });
      setInviteEmail('');
      await fetchMembers();
    } catch {
      setInviteMessage({ tone: 'error', text: 'Could not add member. Please try again.' });
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleRequestAction = async (
    requestId: string,
    action: 'approve' | 'reject'
  ) => {
    setRequestActioningId(requestId);
    setRequestError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/join`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRequestError(data.error || `Could not ${action} the request.`);
        return;
      }
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      // After approval, the new OrganizationUser row exists — pull it into
      // the members list so the admin sees them immediately without a
      // page refresh. After rejection, nothing else changes.
      if (action === 'approve') {
        await fetchMembers();
      }
    } catch {
      setRequestError(`Could not ${action} the request. Please try again.`);
    } finally {
      setRequestActioningId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--surface-ground)' }}>
        <p className="text-sm" style={{ color: '#8B8178' }}>Loading...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--surface-ground)' }}>
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2" style={{ color: '#2C2825' }}>Access Denied</h3>
          <p className="text-sm mb-4" style={{ color: '#8B8178' }}>
            You need admin or owner access to manage this organization.
          </p>
          <button
            onClick={() => router.push(`/org/${orgId}`)}
            className="px-5 py-2 text-sm rounded-full transition-all hover:opacity-80"
            style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--surface-ground)' }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1
            className="text-3xl italic mb-2"
            style={{ fontFamily: 'var(--font-headline)', color: '#2C2825', fontWeight: 'var(--w-body)' }}
          >
            {orgName || 'Organization'} settings
          </h1>
          <p className="text-sm" style={{ color: '#8B8178' }}>
            Manage members and pending requests. To edit the public profile,
            use the &ldquo;Edit Profile&rdquo; button on the org page.
          </p>
          <button
            onClick={() => router.push(`/org/${orgId}/edit`)}
            className="mt-3 text-xs transition-opacity hover:opacity-70"
            style={{ color: 'var(--folio-gold)' }}
          >
            Go to profile editor →
          </button>
        </div>

        {pendingRequests.length > 0 && (
          <section
            className="mb-10 p-5 rounded-2xl border"
            style={{ borderColor: '#E8E4DF', backgroundColor: '#FFFFFF' }}
            aria-label="Pending join requests"
          >
            <div className="flex items-baseline justify-between mb-4">
              <h2
                className="text-lg italic"
                style={{ fontFamily: 'var(--font-headline)', color: '#2C2825', fontWeight: 'var(--w-body)' }}
              >
                Pending requests
              </h2>
              <span className="text-xs" style={{ color: '#8B8178' }}>
                {pendingRequests.length} waiting
              </span>
            </div>

            <ul className="flex flex-col gap-3">
              {pendingRequests.map((req) => {
                const isPending = requestActioningId === req.id;
                const name = req.user.name?.trim() || req.user.email;
                const initials = name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <li
                    key={req.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: '#F5F3F0' }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm overflow-hidden"
                      style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
                    >
                      {req.user.profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={req.user.profileImage}
                          alt={name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#2C2825' }}>
                        {name}
                      </p>
                      <p className="text-xs truncate" style={{ color: '#8B8178' }}>
                        {req.user.email}
                      </p>
                      {req.message ? (
                        <p
                          className="text-xs mt-1 italic"
                          style={{ color: '#6B635B' }}
                        >
                          &ldquo;{req.message}&rdquo;
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRequestAction(req.id, 'reject')}
                        disabled={isPending}
                        className="px-3 py-1.5 text-xs rounded-full transition-all hover:opacity-80 disabled:opacity-50"
                        style={{ color: '#6B635B', border: '1px solid #D4CEC6' }}
                      >
                        {isPending ? '…' : 'Decline'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestAction(req.id, 'approve')}
                        disabled={isPending}
                        className="px-3 py-1.5 text-xs rounded-full transition-all hover:opacity-80 disabled:opacity-50"
                        style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
                      >
                        {isPending ? 'Saving…' : 'Approve'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {requestError ? (
              <p className="text-xs mt-3" style={{ color: '#A14040' }} role="alert">
                {requestError}
              </p>
            ) : null}
          </section>
        )}

        {members.length > 0 && currentUserOrgRole && (
          <section
            className="mb-10 p-5 rounded-2xl border"
            style={{ borderColor: '#E8E4DF', backgroundColor: '#FFFFFF' }}
            aria-label="Members"
          >
            <div className="flex items-baseline justify-between mb-4">
              <h2
                className="text-lg italic"
                style={{ fontFamily: 'var(--font-headline)', color: '#2C2825', fontWeight: 'var(--w-body)' }}
              >
                Members
              </h2>
              <span className="text-xs" style={{ color: '#8B8178' }}>
                {members.length} total
              </span>
            </div>

            <ul className="flex flex-col gap-3">
              {members.map((m) => {
                const isSelf = m.userId === session?.user?.id;
                const isTargetOwner = m.orgRole === 'OWNER';
                const actorIsOwner = currentUserOrgRole === 'OWNER';
                const actorIsAdmin = currentUserOrgRole === 'ADMIN';
                const canEditRole = (actorIsOwner || actorIsAdmin) && !isSelf && (!isTargetOwner || actorIsOwner);
                const canRemove = (!isTargetOwner) && (isSelf || actorIsOwner || actorIsAdmin);
                const name = m.name?.trim() || m.email;
                const initials = name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                const isPending = memberActioningId === m.id;

                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: '#F5F3F0' }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm overflow-hidden"
                      style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
                    >
                      {m.profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.profileImage} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#2C2825' }}>
                        {name}
                        {isSelf ? (
                          <span className="ml-2 text-xs" style={{ color: '#8B8178' }}>
                            (you)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs truncate" style={{ color: '#8B8178' }}>
                        {m.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canEditRole ? (
                        <select
                          value={m.orgRole}
                          onChange={(e) => handleRoleChange(m, e.target.value as OrgRole)}
                          disabled={isPending}
                          className="text-xs rounded-full px-3 py-1.5 border outline-none disabled:opacity-50"
                          style={{
                            borderColor: '#D4CEC6',
                            backgroundColor: 'var(--surface-ground)',
                            color: '#2C2825',
                          }}
                          aria-label={`Role for ${name}`}
                        >
                          {ROLE_ORDER.map((r) => {
                            if (r === 'OWNER' && !actorIsOwner) return null;
                            return (
                              <option key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <span
                          className="text-xs px-3 py-1.5 rounded-full"
                          style={{ backgroundColor: '#E8E4DF', color: '#5C554D' }}
                        >
                          {ROLE_LABEL[m.orgRole]}
                        </span>
                      )}
                      {canRemove ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m)}
                          disabled={isPending}
                          className="px-3 py-1.5 text-xs rounded-full transition-all hover:opacity-80 disabled:opacity-50"
                          style={{ color: '#6B635B', border: '1px solid #D4CEC6' }}
                        >
                          {isPending ? '…' : isSelf ? 'Leave' : 'Remove'}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            {memberError ? (
              <p className="text-xs mt-3" style={{ color: '#A14040' }} role="alert">
                {memberError}
              </p>
            ) : null}

            {(currentUserOrgRole === 'OWNER' ||
              currentUserOrgRole === 'ADMIN' ||
              currentUserOrgRole === 'MANAGER') && (
              <form
                onSubmit={handleInvite}
                className="mt-5 pt-5 border-t flex flex-col gap-2"
                style={{ borderColor: '#E8E4DF' }}
              >
                <label className="text-xs font-medium" style={{ color: '#6B635B' }}>
                  Add a member by email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@studio.com"
                    disabled={inviteSubmitting}
                    className="flex-1 px-4 py-2 text-sm rounded-full border outline-none transition-colors focus:border-[var(--folio-gold)]"
                    style={{
                      borderColor: '#E8E4DF',
                      backgroundColor: 'var(--surface-ground)',
                      color: '#2C2825',
                    }}
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                    disabled={inviteSubmitting}
                    className="text-xs rounded-full px-3 py-2 border outline-none"
                    style={{
                      borderColor: '#D4CEC6',
                      backgroundColor: 'var(--surface-ground)',
                      color: '#2C2825',
                    }}
                  >
                    {ROLE_ORDER.filter(
                      (r) =>
                        ROLE_ORDER.indexOf(r) > ROLE_ORDER.indexOf(currentUserOrgRole)
                    ).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={inviteSubmitting || !inviteEmail.trim()}
                    className="px-4 py-2 text-xs rounded-full transition-all hover:opacity-80 disabled:opacity-50"
                    style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
                  >
                    {inviteSubmitting ? 'Adding…' : 'Add'}
                  </button>
                </div>
                {inviteMessage ? (
                  <p
                    className="text-xs"
                    style={{ color: inviteMessage.tone === 'success' ? '#3A6B47' : '#A14040' }}
                    role={inviteMessage.tone === 'error' ? 'alert' : 'status'}
                  >
                    {inviteMessage.text}
                  </p>
                ) : null}
              </form>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
