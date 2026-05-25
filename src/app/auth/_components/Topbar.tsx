import Link from 'next/link';
import './auth.css';

type TopbarProps = {
  rightCta: { label: string; href: string };
};

export function Topbar({ rightCta }: TopbarProps) {
  return (
    <header className="auth-topbar">
      <div className="auth-topbar__left">
        <Link href="/" className="auth-topbar__wordmark">
          FOLIO
        </Link>
        <button type="button" className="auth-topbar__search" aria-label="Search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="auth-topbar__search-label">Search</span>
          <span className="auth-topbar__kbd">⌘K</span>
        </button>
      </div>
      <nav className="auth-topbar__nav" aria-label="Primary">
        <ul>
          <li><Link href="/magazine">Magazine</Link></li>
          <li><Link href="/about">About</Link></li>
          <li><Link href="/for-professionals">For Professionals</Link></li>
        </ul>
      </nav>
      <Link href={rightCta.href} className="auth-topbar__cta">
        {rightCta.label}
      </Link>
    </header>
  );
}
