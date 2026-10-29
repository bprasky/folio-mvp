import type { ReactNode } from 'react';
import Link from 'next/link';
import './professional-setup.css';

export function ProfessionalSetupFrame({ children, stage, wide = false }: { children: ReactNode; stage: 'business' | 'workspace'; wide?: boolean }) {
  return <div className="auth-shell professional-setup">
    <header className="professional-setup__header">
      <Link href="/" className="folio-logo-text" aria-label="Folio home">Folio</Link>
      <Link href="/settings" className="professional-setup__account">Account settings</Link>
    </header>
    <main className={`professional-setup__layout${wide ? ' professional-setup__layout--wide' : ''}`}>
      {!wide ? <aside className="professional-setup__story" aria-label="Welcome to Folio">
        {/* Decorative photography continues the visual language of the signup page. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1800&q=80" alt="" />
        <div className="professional-setup__story-copy">
          <span className="professional-setup__eyebrow">Your work belongs here</span>
          <p className="professional-setup__statement">{stage === 'business' ? <>A place for the work.<br /><em>And the people behind it.</em></> : <>You’ve done the work.<br /><em>Let’s bring it into Folio.</em></>}</p>
          <p className="professional-setup__caption">{stage === 'business' ? 'Connect with your practice, then make room for the stories only you can tell.' : 'A thoughtful starting point for your profile, your projects, and the conversations to come.'}</p>
        </div>
      </aside> : null}
      <div className="professional-setup__content space-y-6">{children}</div>
    </main>
  </div>;
}
