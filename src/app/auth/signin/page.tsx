import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { safeCallbackPath } from '@/lib/onboarding/professional-entry';
import { getSigninHero } from '@/lib/auth/getSigninHero';
import { SigninForm } from './SigninForm';
import { Topbar } from '../_components/Topbar';
import styles from './signin.module.css';

export const dynamic = 'force-dynamic';

export default async function SigninPage({ searchParams }: { searchParams: { callbackUrl?: string; callback?: string } }) {
  const callbackUrl = safeCallbackPath(searchParams.callbackUrl ?? searchParams.callback);
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const pathname = decodeURIComponent(new URL(callbackUrl, 'https://folio.invalid').pathname);
    redirect(/^\/auth\/(signin|signup)(\/|$)/i.test(pathname) ? '/' : callbackUrl);
  }
  const signupHref = '/auth/signup?callbackUrl=' + encodeURIComponent(callbackUrl);
  const [hero] = await Promise.all([getSigninHero()]);

  const showGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const showApple = Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET);

  return (
    <div className={styles.page}>
      <Topbar rightCta={{ label: 'Sign up', href: signupHref }} />

      <main className={styles.stage}>
        <section className={styles.photoPanel} aria-label="Featured project">
          <div className={styles.photo}>
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element -- external storage urls; cover-fit
              <img src={hero.url} alt={hero.alt} />
            ) : (
              <div className={styles.photoFallback}>
                <span className={styles.photoFallbackMark}>Folio</span>
              </div>
            )}
          </div>

          {hero && (
            <div className={styles.photoCaption}>
              <div>
                <span className={styles.photoCaptionLabel}>Featured project</span>
                <span className={styles.photoCaptionDescription}>{hero.caption}</span>
              </div>
              <span className={styles.photoCounter}>{hero.counter}</span>
            </div>
          )}
        </section>

        <Suspense fallback={null}><SigninForm showGoogle={showGoogle} showApple={showApple} /></Suspense>
      </main>

      <footer className={styles.pageFooter}>
        <span className={styles.pageFooterIssue}>Folio — Issue 09 · May 2026</span>
        <div className={styles.pageFooterLinks}>
          <Link href="/terms" className={styles.pageFooterLink}>Terms</Link>
          <Link href="/privacy" className={styles.pageFooterLink}>Privacy</Link>
          <Link href="/contact" className={styles.pageFooterLink}>Contact</Link>
        </div>
      </footer>
    </div>
  );
}
