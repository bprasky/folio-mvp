'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const SESSION_KEY = 'folio_welcome_dismissed';

const pillars = [
  {
    title: 'Your story, told right every time',
    body: 'Folio digs deeper than any reporter can. The portfolio section of your website becomes a publication that keeps writing itself.',
  },
  {
    title: 'Price, sample, and specify from one place',
    body: "Every product you've ever speced lives in your Sourcebook. Sourcing stops meaning a morning of old project folders and cold emails.",
  },
  {
    title: 'Turn your inbox into action items',
    body: 'Connect your accounts and vendor back-and-forth becomes tasks that close with a click. Quotes chased, samples ordered, specs pulled, without leaving Folio.',
  },
  {
    title: 'Every project is months of social content',
    body: 'Upload your work and Folio writes the campaigns, articles, and posts for you. Cross-post, stay consistent, and the reach follows. Folio gives you the content. You run the publication.',
  },
];

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });
  const windowCenter = useRef({ x: 0, y: 0 });
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') return;
    if (status === 'loading') return;
    if (!sessionStorage.getItem(SESSION_KEY)) {
      setIsOpen(true);
    }
  }, [status]);

  useEffect(() => {
    windowCenter.current = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
  }, []);

  if (!isOpen) return null;

  function handleClose() {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setIsOpen(false);
  }

  function handleDismiss() {
    const target = document.querySelector('[data-folio-target="for-designers-nav"]');
    const rect = target?.getBoundingClientRect();
    if (rect) {
      setTargetPos({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
    setDismissing(true);
  }

  function handleAnimationComplete() {
    if (!dismissing) return;
    const target = document.querySelector('[data-folio-target="for-designers-nav"]');
    target?.classList.add('folio-nav-pulse');
    setTimeout(() => target?.classList.remove('folio-nav-pulse'), 800);
    handleClose();
  }

  return (
    <AnimatePresence>
      {!dismissing ? null : null}
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center glass-backdrop"
        initial={{ opacity: 0 }}
        animate={dismissing ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: dismissing ? 0.2 : 0.3 }}
        onClick={handleDismiss}
      >
        {/* Modal panel */}
        <motion.div
          className="relative w-[88%] max-w-[620px] max-h-[92vh] flex flex-col glass-overlay rounded-[20px]"
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={
            dismissing
              ? {
                  opacity: 0,
                  scale: 0.08,
                  x: targetPos.x - windowCenter.current.x,
                  y: targetPos.y - windowCenter.current.y,
                }
              : { opacity: 1, scale: 1, y: 0, x: 0 }
          }
          transition={
            dismissing
              ? { duration: 0.45, ease: [0.4, 0, 0.2, 1] }
              : { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
          }
          onAnimationComplete={handleAnimationComplete}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-7 py-4"
            style={{ borderBottom: '1px solid rgba(201, 169, 110, 0.12)' }}
          >
            <span className="font-headline text-xl tracking-wide font-semibold text-folio-text-primary">
              FOLIO
            </span>
            <button
              onClick={handleDismiss}
              className="p-2 -mr-2 rounded-full hover:bg-black/5 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-[#7a6e68]" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {/* Hero */}
            <div className="px-7 pt-8 pb-6 text-center">
              <h2 className="font-headline italic text-4xl text-folio-text-primary leading-[var(--lh-h1)]">
                Your story told right. Your studio run right.
              </h2>
              <p className="mt-4 text-sm leading-relaxed max-w-md mx-auto" style={{ color: 'rgba(40, 30, 24, 0.75)' }}>
                Folio is where interior designers publish their work, source
                their products, and turn vendor conversations into action.
                Built for the way studios already operate.
              </p>
            </div>

            {/* Divider */}
            <div className="px-7">
              <hr style={{ borderColor: 'rgba(201, 169, 110, 0.12)' }} />
            </div>

            {/* Pillars */}
            <div className="px-7 py-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pillars.map((pillar, i) => (
                  <div
                    key={i}
                    className="p-4 glass-surface glass-surface-sm"
                  >
                    <p
                      className="font-headline italic text-3xl mb-2"
                      style={{ color: 'rgba(201, 169, 110, 0.5)' }}
                    >
                      {i + 1}
                    </p>
                    <h4 className="text-base font-medium text-folio-text-primary mb-1.5">
                      {pillar.title}
                    </h4>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(40, 30, 24, 0.65)' }}>
                      {pillar.body}
                    </p>
                  </div>
                ))}
              </div>
              <Link
                href="/for-designers"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                className="inline-block mt-4 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                Explore all features &rarr;
              </Link>
            </div>

            {/* Divider */}
            <div className="px-7">
              <hr style={{ borderColor: 'rgba(201, 169, 110, 0.12)' }} />
            </div>

            {/* Founding cohort */}
            <div className="px-7 py-8 pb-4">
              <p
                className="uppercase tracking-widest text-xs font-medium mb-2"
                style={{ color: '#a07d3f' }}
              >
                Founding Designers
              </p>
              <h3 className="font-headline italic text-2xl text-folio-text-primary mb-5">
                We&rsquo;re building the founding cohort now.
              </h3>
              <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(40, 30, 24, 0.75)' }}>
                Folio is invite-only during its founding phase. Founding designers
                receive permanent recognition on the platform and structural
                advantages that don&rsquo;t go away as the platform grows.
              </p>
              <p className="text-xs font-medium text-folio-text-primary">
                If your work is ready, so are we.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div
            className="sticky bottom-0 z-10 flex flex-col sm:flex-row items-center justify-between gap-3 px-7 py-4"
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(0, 0, 0, 0.06)',
            }}
          >
            <Link
              href="/auth/signin"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="text-xs hover:text-folio-text-primary transition-colors"
              style={{ color: 'rgba(40, 30, 24, 0.6)' }}
            >
              Already have an account? Sign in
            </Link>
            <Link
              href="/auth/signup"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="accent-btn inline-block px-7 py-2.5 text-sm"
            >
              Apply to Join
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
