'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Building2, CreditCard, Mail, Shield, ChevronRight } from 'lucide-react';

type OrgRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';

interface MyOrg {
  id: string;
  name: string;
  type: string;
  userRole: OrgRole;
}

interface PendingRequest {
  id: string;
  status: 'PENDING' | 'REJECTED';
  organizationId: string;
  organizationName: string;
  createdAt: string;
}

const ROLE_LABEL: Record<OrgRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

const CAN_MANAGE: OrgRole[] = ['OWNER', 'ADMIN'];

export default function SettingsHubPage() {
  const { data: session, status } = useSession();
  const [orgs, setOrgs] = useState<MyOrg[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    Promise.all([
      fetch('/api/user/workspace-context')
        .then((r) => (r.ok ? r.json() : { organizations: [] }))
        .catch(() => ({ organizations: [] })),
      fetch('/api/user/join-requests')
        .then((r) => (r.ok ? r.json() : { requests: [] }))
        .catch(() => ({ requests: [] })),
    ]).then(([ws, jr]) => {
      if (cancelled) return;
      setOrgs(Array.isArray(ws.organizations) ? ws.organizations : []);
      setRequests(Array.isArray(jr.requests) ? jr.requests : []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--surface-ground)' }}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900" />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--surface-ground)' }}
      >
        <div className="text-center">
          <p className="text-sm mb-4" style={{ color: '#8B8178' }}>
            Sign in to manage your settings.
          </p>
          <Link
            href="/auth/signin?callbackUrl=/settings"
            className="px-5 py-2 text-sm rounded-full"
            style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === 'PENDING');
  const declined = requests.filter((r) => r.status === 'REJECTED');

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--surface-ground)' }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1
            className="text-3xl italic mb-2"
            style={{
              fontFamily: 'var(--font-headline)',
              color: '#2C2825',
              fontWeight: 'var(--w-body)',
            }}
          >
            Settings
          </h1>
          <p className="text-sm" style={{ color: '#8B8178' }}>
            Manage your account and the organizations you belong to.
          </p>
        </div>

        <Section title="Organizations">
          {orgs.length === 0 ? (
            <div
              className="p-4 rounded-xl text-sm flex items-center justify-between gap-3"
              style={{ backgroundColor: '#F5F3F0', color: '#5C554D' }}
            >
              <span>You&rsquo;re not a member of any organization yet.</span>
              <Link
                href="/auth/org-setup"
                className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap"
                style={{ backgroundColor: '#2C2825', color: 'var(--surface-ground)' }}
              >
                Find yours
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {orgs.map((org) => {
                const canManage = CAN_MANAGE.includes(org.userRole);
                return (
                  <li
                    key={org.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: '#F5F3F0' }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
                    >
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: '#2C2825' }}
                      >
                        {org.name}
                      </p>
                      <p className="text-xs" style={{ color: '#8B8178' }}>
                        {ROLE_LABEL[org.userRole] ?? org.userRole}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/org/${org.id}`}
                        className="text-xs px-3 py-1.5 rounded-full"
                        style={{
                          color: '#6B635B',
                          border: '1px solid #D4CEC6',
                        }}
                      >
                        View
                      </Link>
                      {canManage ? (
                        <Link
                          href={`/org/${org.id}/settings`}
                          className="text-xs px-3 py-1.5 rounded-full"
                          style={{
                            backgroundColor: '#2C2825',
                            color: 'var(--surface-ground)',
                          }}
                        >
                          Manage
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {pending.length > 0 && (
          <Section title="Pending requests">
            <ul className="flex flex-col gap-2">
              {pending.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: '#F5F3F0' }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
                  >
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: '#2C2825' }}
                    >
                      {r.organizationName}
                    </p>
                    <p className="text-xs" style={{ color: '#8B8178' }}>
                      Waiting for an admin to approve your request.
                    </p>
                  </div>
                  <Link
                    href={`/org/${r.organizationId}`}
                    className="text-xs px-3 py-1.5 rounded-full shrink-0"
                    style={{ color: '#6B635B', border: '1px solid #D4CEC6' }}
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {declined.length > 0 && (
          <Section title="Declined">
            <ul className="flex flex-col gap-2">
              {declined.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: '#F5F3F0', opacity: 0.7 }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
                  >
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: '#2C2825' }}>
                      {r.organizationName}
                    </p>
                    <p className="text-xs" style={{ color: '#8B8178' }}>
                      Your request was declined. You can request again from the
                      org&rsquo;s page.
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Account">
          <ul className="flex flex-col gap-2">
            <HubLink
              href="/settings/subscription"
              icon={<CreditCard className="w-4 h-4" />}
              title="Subscription"
              sub="Plan, billing, and tier limits."
            />
            <HubLink
              href="/settings/email"
              icon={<Mail className="w-4 h-4" />}
              title="Email preferences"
              sub="How replies are sent and signed."
            />
            <HubLink
              href="/settings/privacy"
              icon={<Shield className="w-4 h-4" />}
              title="Privacy"
              sub="Data export, account deletion."
            />
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2
        className="text-lg italic mb-3"
        style={{
          fontFamily: 'var(--font-headline)',
          color: '#2C2825',
          fontWeight: 'var(--w-body)',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function HubLink({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-[#F0EDE9]"
        style={{ backgroundColor: '#F5F3F0' }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: '#2C2825' }}>
            {title}
          </p>
          <p className="text-xs" style={{ color: '#8B8178' }}>
            {sub}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: '#A69E96' }} />
      </Link>
    </li>
  );
}
