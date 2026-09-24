import Link from 'next/link';
import { Suspense } from 'react';
import { safeCallbackPath } from '@/lib/onboarding/professional-entry';
import { getSigninHero } from '@/lib/auth/getSigninHero';
import { SigninForm } from './SigninForm';
import styles from './signin.module.css';

export const dynamic = 'force-dynamic';

export default async function SigninPage({ searchParams }: { searchParams: { callbackUrl?: string; callback?: string } }) {
  const callbackUrl = safeCallbackPath(searchParams.callbackUrl ?? searchParams.callback);
  const signupHref = '/auth/signup?callbackUrl=' + encodeURIComponent(callbackUrl);
  const [hero] = await Promise.all([getSigninHero()]);

  const showGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const showApple = Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET);

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.wordmark} aria-label="Folio home">
          FOLIO
        </Link>

        <div className={styles.topbarCenter}>
          <Link href="/search" className={styles.searchPill} aria-label="Search Folio">
            <span>Search Folio</span>
            <span className={styles.searchKbd} aria-hidden="true">⌘K</span>
          </Link>
          <nav aria-label="Primary">
            <ul className={styles.navList}>
              <li><Link href="/magazine" className={styles.navLink}>Magazine</Link></li>
              <li><Link href="/about" className={styles.navLink}>About</Link></li>
              <li><Link href="/for-designers" className={styles.navLink}>For professionals</Link></li>
            </ul>
          </nav>
        </div>

        <Link href={signupHref} className={styles.invitePill}>
          Request invite
        </Link>
      </header>

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
