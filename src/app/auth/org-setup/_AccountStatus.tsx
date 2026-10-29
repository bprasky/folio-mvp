import Link from 'next/link';

export type ProfessionalAccount = { name: string | null; email: string; operatingAsOrgId: string | null };
type Firm = { id: string; name: string; membershipRole: string };
export function AccountStatus({ account, memberships }: { account: ProfessionalAccount; memberships: Firm[] }) {
  const current = memberships.find((firm) => firm.id === account.operatingAsOrgId);
  return (
    <section aria-label="Current account" className="setup-account rounded-lg border border-folio-border-subtle p-5 space-y-4">
      <dl className="space-y-4">
        <div>
          <dt className="folio-meta text-folio-text-secondary">Signed in as</dt>
          <dd className="folio-body break-words">{account.name || account.email}</dd>
          {account.name ? <dd className="folio-meta text-folio-text-secondary break-words">{account.email}</dd> : null}
        </div>
        <div>
          <dt className="folio-meta text-folio-text-secondary">Operating under</dt>
          <dd className="folio-body">{current ? <Link className="underline underline-offset-4" href={`/org/${current.id}`}>{current.name}</Link> : 'Your personal account'}</dd>
          {current ? <dd className="folio-meta text-folio-text-secondary">{current.membershipRole.charAt(0) + current.membershipRole.slice(1).toLowerCase()}</dd> : null}
        </div>
      </dl>
      {!current && account.operatingAsOrgId ? <p className="folio-meta text-folio-text-secondary">Your previous firm access is no longer active.</p> : null}
      <p className="folio-meta text-folio-text-secondary">Your personal account stays with you across firms. Posting access depends on each firm’s permissions.</p>
    </section>
  );
}
