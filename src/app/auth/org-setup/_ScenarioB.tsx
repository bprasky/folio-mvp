'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ScenarioA, type OrgIntent } from './_ScenarioA';

type MembershipRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';

export type UserOrg = {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  membershipRole: MembershipRole;
};

const INTENT_OPTIONS: { value: OrgIntent; label: string }[] = [
  { value: 'designer', label: 'Designer' },
  { value: 'architect', label: 'Architect' },
  { value: 'builder', label: 'Builder' },
  { value: 'vendor', label: 'Vendor' },
];

const INTENT_TO_ORG_TYPE: Record<OrgIntent, string> = {
  designer: 'DESIGN_FIRM',
  architect: 'ARCHITECTURE_FIRM',
  builder: 'CONTRACTOR',
  vendor: 'VENDOR',
};

const TYPE_NOUN: Record<OrgIntent, string> = {
  designer: 'studio',
  architect: 'practice',
  builder: 'company',
  vendor: 'brand',
};

const ONBOARDING_REDIRECT = '/onboarding/diagnostic';

function isAdminRole(role: MembershipRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

type Props = {
  initialIntent: OrgIntent | null;
  userOrgs: UserOrg[];
};

export function ScenarioB({ initialIntent, userOrgs }: Props) {
  const router = useRouter();
  const [intent, setIntent] = useState<OrgIntent | null>(initialIntent);
  const [mode, setMode] = useState<'choose' | 'create-separate'>('choose');

  // Per-org status tracking so we can show inline success/error next to the
  // org the user just hit. Keyed by org id.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [orgStatus, setOrgStatus] = useState<
    Record<string, { state: 'success' | 'error'; message: string }>
  >({});

  const intentOrgType = intent ? INTENT_TO_ORG_TYPE[intent] : null;
  const intentNoun = intent ? TYPE_NOUN[intent] : null;

  const handleAddCapability = async (org: UserOrg) => {
    if (!intent || pendingId) return;
    setPendingId(org.id);
    setOrgStatus((s) => ({ ...s, [org.id]: { state: 'success', message: '' } }));
    try {
      const res = await fetch('/api/auth/org-setup/add-capability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id, capability: intent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOrgStatus((s) => ({
          ...s,
          [org.id]: { state: 'error', message: data.error || 'Could not add capability.' },
        }));
        setPendingId(null);
        return;
      }
      const msg = data.alreadyPresent
        ? `${org.name} already had the ${intent} capability.`
        : `${org.name} now also a ${intent}. Taking you to onboarding…`;
      setOrgStatus((s) => ({ ...s, [org.id]: { state: 'success', message: msg } }));
      setTimeout(() => {
        router.replace(ONBOARDING_REDIRECT);
        router.refresh();
      }, 1400);
    } catch {
      setOrgStatus((s) => ({
        ...s,
        [org.id]: { state: 'error', message: 'Could not add capability. Please try again.' },
      }));
      setPendingId(null);
    }
  };

  // Step 1: pick an intent if not preset via URL.
  if (!intent) {
    return (
      <>
        <div className="auth-eyebrow">
          <span className="auth-eyebrow__gold">Add another</span>
          <span className="auth-eyebrow__dot" />
          <span>Already on Folio</span>
        </div>
        <h1 className="auth-title">What are you adding next?</h1>
        <p className="auth-sub">
          Pick the role for the organization you&rsquo;re adding. We&rsquo;ll
          show your existing orgs first so you can extend an existing page into
          a hybrid, or spin up a new one.
        </p>

        <fieldset className="auth-intent">
          <legend className="auth-intent__legend">Add as</legend>
          <div className="auth-intent__chips" role="radiogroup" aria-label="Add as">
            {INTENT_OPTIONS.map((opt) => (
              <label key={opt.value} className="auth-intent__chip">
                <input
                  type="radio"
                  name="add-intent"
                  value={opt.value}
                  checked={false}
                  onChange={() => setIntent(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="auth-form-foot">
          <Link href={ONBOARDING_REDIRECT}>I&rsquo;ll do this later</Link>.
        </div>
      </>
    );
  }

  // Embedded create-separate flow: reuse ScenarioA's search/create UI with the
  // chosen intent. hideEyebrow=true so we don't render two eyebrow rows.
  if (mode === 'create-separate') {
    return (
      <ScenarioA
        initialIntent={intent}
        hideEyebrow
        headingOverride={{
          eyebrowGold: 'Add another',
          title: `Find or create a separate ${TYPE_NOUN[intent]}.`,
          sub: `Search for the ${TYPE_NOUN[intent]} you want to join, or add a new one alongside the orgs you already manage.`,
        }}
        onBack={() => setMode('choose')}
      />
    );
  }

  // Step 2: show user's existing orgs as candidates for hybrid + the
  // create-separate fallback.
  return (
    <>
      <div className="auth-eyebrow">
        <span className="auth-eyebrow__gold">Add another</span>
        <span className="auth-eyebrow__dot" />
        <span>Adding {intent}</span>
      </div>
      <h1 className="auth-title">Extend an existing page, or start a new one?</h1>
      <p className="auth-sub">
        Add the {intent} capability to one of your orgs to make it a hybrid (a
        designer that also sells products, a firm that does design and build),
        or create a separate {intentNoun} page if it&rsquo;s a different
        organization.
      </p>

      <ul className="auth-results auth-results--ownsorgs">
        {userOrgs.map((org) => {
          const alreadyHas =
            org.type === intentOrgType || org.capabilities.includes(intentOrgType!);
          const canAdmin = isAdminRole(org.membershipRole);
          const status = orgStatus[org.id];
          const isPending = pendingId === org.id;

          let buttonLabel = 'Add capability';
          let buttonDisabled = false;
          if (alreadyHas) {
            buttonLabel = `Already a ${intent}`;
            buttonDisabled = true;
          } else if (!canAdmin) {
            buttonLabel = 'Admin only';
            buttonDisabled = true;
          } else if (isPending) {
            buttonLabel = 'Adding…';
            buttonDisabled = true;
          }

          return (
            <li key={org.id} className="auth-result">
              <div className="auth-result__main">
                <span className="auth-result__name">{org.name}</span>
                <span className="auth-result__meta">
                  {org.capabilities.length > 0
                    ? org.capabilities.map((c) => c.toLowerCase().replace('_', ' ')).join(' · ')
                    : org.type.toLowerCase().replace('_', ' ')}
                  {' · '}
                  you&rsquo;re {org.membershipRole.toLowerCase()}
                </span>
                {!canAdmin && !alreadyHas ? (
                  <span className="auth-result__hint">
                    Only an owner or admin of {org.name} can add a capability.
                  </span>
                ) : null}
                {status?.message ? (
                  <span
                    className={`auth-result__hint auth-result__hint--${status.state}`}
                  >
                    {status.message}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="auth-result__cta"
                onClick={() => handleAddCapability(org)}
                disabled={buttonDisabled || !!pendingId}
              >
                {buttonLabel}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="auth-secondary"
        onClick={() => setMode('create-separate')}
        disabled={!!pendingId}
      >
        Create a separate new {intentNoun}
      </button>

      <div className="auth-form-foot">
        <button
          type="button"
          className="auth-linklike"
          onClick={() => setIntent(null)}
          disabled={!!pendingId}
        >
          ← Choose a different role
        </button>
      </div>
    </>
  );
}
