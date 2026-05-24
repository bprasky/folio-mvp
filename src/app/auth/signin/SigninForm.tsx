'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './signin.module.css';

type SigninFormProps = {
  showGoogle: boolean;
  showApple: boolean;
};

export function SigninForm({ showGoogle, showApple }: SigninFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email: email.trim().toLowerCase(),
        password,
      });
      if (res?.error) {
        setErr(res.error || 'Invalid email or password');
      } else {
        router.replace('/');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  const hasSso = showGoogle || showApple;

  return (
    <div className={styles.formColumn}>
      <div className={styles.eyebrow}>
        <span className={styles.eyebrowMembers}>Members</span>
        <span className={styles.eyebrowDot} aria-hidden="true" />
        <span>By invitation</span>
      </div>

      <h1 className={styles.headline}>Welcome — sign back in.</h1>
      <p className={styles.subhead}>
        A working archive for designers. Sign in to keep your projects, materials,
        and rooms at hand.
      </p>

      {hasSso && (
        <>
          <div className={styles.ssoRow}>
            {showGoogle && (
              <button
                type="button"
                className={styles.ssoButton}
                onClick={() => signIn('google', { callbackUrl: '/' })}
                disabled={loading}
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
            )}
            {showApple && (
              <button
                type="button"
                className={styles.ssoButton}
                onClick={() => signIn('apple', { callbackUrl: '/' })}
                disabled={loading}
              >
                <AppleIcon />
                <span>Continue with Apple</span>
              </button>
            )}
          </div>

          <div className={styles.divider} role="separator" aria-label="or with email">
            <span className={styles.dividerLine} aria-hidden="true" />
            <span className={styles.dividerLabel}>Or with email</span>
            <span className={styles.dividerLine} aria-hidden="true" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <div className={styles.fieldHead}>
            <label htmlFor="email" className={styles.fieldLabel}>Email</label>
          </div>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={`${styles.input} ${err ? styles.inputError : ''}`}
          />
        </div>

        <div className={styles.field}>
          <div className={styles.fieldHead}>
            <label htmlFor="password" className={styles.fieldLabel}>Password</label>
            <Link href="/auth/forgot-password" className={styles.fieldLink}>
              Forgot password
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className={`${styles.input} ${err ? styles.inputError : ''}`}
          />
        </div>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span className={styles.checkboxLabel}>Keep me signed in on this device</span>
        </label>

        {err && (
          <div className={styles.errorBox} role="alert">
            {err}
          </div>
        )}

        <button
          type="submit"
          className={styles.submit}
          disabled={loading}
        >
          <span>{loading ? 'Signing in' : 'Sign in'}</span>
          <ArrowRightIcon />
        </button>
      </form>

      <p className={styles.formFooter}>
        New to Folio?{' '}
        <Link href="/auth/signup" className={styles.formFooterLink}>
          Request an invite
        </Link>
        {' '}— applications are reviewed weekly.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className={styles.ssoIcon} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.92v2.32A9 9 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.92A9 9 0 0 0 0 9c0 1.45.35 2.83.92 4.04l3.05-2.32z" fill="#FBBC05"/>
      <path d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .92 4.96l3.05 2.32C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className={styles.ssoIcon} viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      <path d="M14.94 9.55c-.02-2.04 1.67-3.02 1.75-3.07-.96-1.4-2.44-1.59-2.97-1.61-1.26-.13-2.46.74-3.1.74-.65 0-1.63-.72-2.69-.7-1.38.02-2.66.8-3.37 2.04C2.97 9.5 4.03 13.1 5.43 15.07c.7.96 1.5 2.04 2.57 2 1.03-.04 1.42-.66 2.66-.66 1.24 0 1.6.66 2.69.64 1.12-.02 1.81-.97 2.49-1.95.79-1.11 1.11-2.2 1.13-2.26-.02-.01-2.17-.83-2.19-3.29zM12.93 3.62c.57-.69.95-1.65.85-2.6-.82.03-1.81.55-2.4 1.24-.53.61-.99 1.59-.87 2.52.92.07 1.85-.47 2.42-1.16z"/>
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className={styles.submitArrow} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
