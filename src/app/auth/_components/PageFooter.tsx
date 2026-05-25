import Link from 'next/link';
import './auth.css';

export function PageFooter() {
  return (
    <footer className="auth-pagefoot">
      <span className="auth-pagefoot__copy">Folio — Issue 09 · May 2026</span>
      <div className="auth-pagefoot__legal">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/contact">Contact</Link>
      </div>
    </footer>
  );
}
