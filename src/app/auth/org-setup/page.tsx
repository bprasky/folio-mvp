import Link from 'next/link';
import { Topbar } from '../_components/Topbar';
import { PhotoPanel } from '../_components/PhotoPanel';
import { PageFooter } from '../_components/PageFooter';
import '../_components/auth.css';

type OrgType = 'designer' | 'architect' | 'builder' | 'vendor';

const TYPE_COPY: Record<OrgType, { noun: string; capability: string }> = {
  designer: { noun: 'studio', capability: 'designer' },
  architect: { noun: 'practice', capability: 'architect' },
  builder: { noun: 'company', capability: 'builder' },
  vendor: { noun: 'brand', capability: 'vendor' },
};

function parseType(raw: string | string[] | undefined): OrgType | null {
  if (typeof raw !== 'string') return null;
  return raw in TYPE_COPY ? (raw as OrgType) : null;
}

export default function OrgSetupPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const type = parseType(searchParams.type);
  const copy = type ? TYPE_COPY[type] : null;

  return (
    <div className="auth-shell">
      <Topbar />

      <main className="auth-stage">
        <PhotoPanel
          imageSrc="https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1800&q=80"
          imageAlt="Sitting room in cream linen and oak, soft afternoon light"
          eyebrow="From Issue 09 · Cape Town"
          description="Where the work gets named. Your studio becomes the credit line on every project you bring to Folio — pieces tagged, rooms attributed, story intact."
          counter="04 / 04"
        />

        <section className="auth-form-panel" aria-label="Organization setup">
          <div className="auth-eyebrow">
            <span className="auth-eyebrow__gold">Almost there</span>
            <span className="auth-eyebrow__dot" />
            <span>Step two</span>
          </div>
          <h1 className="auth-title">
            {copy ? `Let's find your ${copy.noun}.` : "Let's set up your organization."}
          </h1>
          <p className="auth-sub">
            We&rsquo;re building organization lookup next — soon you&rsquo;ll be
            able to search for your{' '}
            {copy ? copy.noun : 'organization'} and join the people you already
            work with, or start a new one. For now, jump into Folio and we&rsquo;ll
            invite you back to claim your{' '}
            {copy ? `${copy.capability} profile` : 'profile'} the moment it&rsquo;s
            ready.
          </p>

          <Link href="/onboarding/diagnostic" className="auth-submit">
            Continue to Folio
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </Link>

          <div className="auth-form-foot">
            Wrong choice?{' '}
            <Link href="/auth/signup">Go back to sign-up</Link>.
          </div>
        </section>
      </main>

      <PageFooter />
    </div>
  );
}
