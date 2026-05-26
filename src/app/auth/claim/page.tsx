import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession, type Session } from 'next-auth';
import { ClaimStatus } from '@prisma/client';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { Topbar } from '../_components/Topbar';
import { PhotoPanel } from '../_components/PhotoPanel';
import { PageFooter } from '../_components/PageFooter';
import { ClaimAcceptButton } from './_ClaimAcceptButton';
import '../_components/auth.css';

export const dynamic = 'force-dynamic';

// The destination of the OrgClaimInvite link. Validates the token server-side,
// shows the org being claimed, and offers the right CTA depending on auth
// state. The actual claim POST is fired by ClaimAcceptButton (client) so we
// can surface success/error feedback inline.
// See docs/AUTH_ORG_ENROLLMENT_FLOW.md.

const ORG_TYPE_LABEL: Record<string, string> = {
  DESIGN_FIRM: 'Design firm',
  ARCHITECTURE_FIRM: 'Architecture firm',
  CONTRACTOR: 'Construction',
  VENDOR: 'Vendor',
  MANUFACTURER: 'Manufacturer',
  SHOWROOM: 'Showroom',
  PHOTOGRAPHY_STUDIO: 'Photography',
  DEVELOPER: 'Developer',
};

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;
  if (!token || token.length < 8) {
    redirect('/');
  }

  let session: Session | null = null;
  try {
    session = await getServerSession(authOptions);
  } catch (err) {
    console.error('[/auth/claim] getServerSession failed:', err);
  }

  const invite = await prisma.orgClaimInvite.findUnique({
    where: { token },
    select: {
      status: true,
      expiresAt: true,
      organization: { select: { id: true, name: true, type: true } },
    },
  });

  const expired = invite && invite.expiresAt.getTime() < Date.now();
  const effectiveStatus: ClaimStatus | 'NOT_FOUND' = !invite
    ? 'NOT_FOUND'
    : expired && invite.status === ClaimStatus.PENDING
    ? ClaimStatus.EXPIRED
    : invite.status;

  return (
    <div className="auth-shell">
      <Topbar />
      <main className="auth-stage">
        <PhotoPanel
          imageSrc="https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1800&q=80"
          imageAlt="Sitting room in cream linen and oak, soft afternoon light"
          eyebrow="From Issue 09 · Cape Town"
          description="The credit line stays with the people who did the work. Claim your firm's Folio page so your team's projects show up under your name."
          counter="04 / 04"
        />

        <section className="auth-form-panel" aria-label="Claim organization">
          <div className="auth-eyebrow">
            <span className="auth-eyebrow__gold">Claim</span>
            <span className="auth-eyebrow__dot" />
            <span>Set up your firm</span>
          </div>

          {effectiveStatus === 'NOT_FOUND' ? (
            <>
              <h1 className="auth-title">This claim link isn&rsquo;t valid.</h1>
              <p className="auth-sub">
                It may have been mistyped or already used. If your firm sent you
                a new link, try that one instead.
              </p>
              <Link href="/" className="auth-submit">
                Continue to Folio
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </Link>
            </>
          ) : effectiveStatus === ClaimStatus.CLAIMED ? (
            <>
              <h1 className="auth-title">
                {invite!.organization.name} is already claimed.
              </h1>
              <p className="auth-sub">
                Someone on your team has already set up this Folio page. If you
                need access, ask the page&rsquo;s owner to invite you.
              </p>
              <Link href="/" className="auth-submit">
                Continue to Folio
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </Link>
            </>
          ) : effectiveStatus === ClaimStatus.EXPIRED ||
            effectiveStatus === ClaimStatus.REVOKED ? (
            <>
              <h1 className="auth-title">This claim link has expired.</h1>
              <p className="auth-sub">
                Ask your teammate to resend the setup link from their Folio
                account.
              </p>
              <Link href="/" className="auth-submit">
                Continue to Folio
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </Link>
            </>
          ) : !session?.user?.id ? (
            <>
              <h1 className="auth-title">
                Sign in to claim {invite!.organization.name}.
              </h1>
              <p className="auth-sub">
                Folio needs to know who you are before you take over the
                {' '}
                {ORG_TYPE_LABEL[invite!.organization.type]?.toLowerCase() ?? 'firm'}{' '}
                page. Sign in (or create an account) and we&rsquo;ll bring you
                back here.
              </p>
              <Link
                href={`/auth/signup?callback=${encodeURIComponent(
                  `/auth/claim?token=${token}`
                )}`}
                className="auth-submit"
              >
                Sign up to claim
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </Link>
              <div className="auth-form-foot">
                Already on Folio?{' '}
                <Link
                  href={`/auth/signin?callbackUrl=${encodeURIComponent(
                    `/auth/claim?token=${token}`
                  )}`}
                >
                  Sign in
                </Link>
                .
              </div>
            </>
          ) : (
            <>
              <h1 className="auth-title">
                You&rsquo;re claiming {invite!.organization.name}.
              </h1>
              <p className="auth-sub">
                Confirming will make you the owner of this{' '}
                {ORG_TYPE_LABEL[invite!.organization.type]?.toLowerCase() ?? 'firm'}{' '}
                page on Folio. You&rsquo;ll be able to publish work, invite
                teammates, and configure the page.
              </p>
              <ClaimAcceptButton token={token} orgName={invite!.organization.name} />
              <div className="auth-form-foot">
                Not the right person?{' '}
                <Link href="/">Cancel and head home</Link>.
              </div>
            </>
          )}
        </section>
      </main>
      <PageFooter />
    </div>
  );
}
