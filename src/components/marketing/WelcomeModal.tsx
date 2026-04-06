'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const SESSION_KEY = 'folio_welcome_dismissed';

const steps = [
  {
    title: 'Publish your work',
    description:
      'Upload your photography, walk through a brief interview, and Folio generates an editorial-quality project post \u2014 in your voice, under your name.',
  },
  {
    title: 'Run your projects',
    description:
      'Every product you tag builds your Sourcebook. Request quotes, track lead times, and manage procurement from one project board.',
  },
  {
    title: 'Own every conversation',
    description:
      'Vendor emails, rep texts, contractor updates \u2014 one searchable inbox linked to your projects and products. Nothing gets lost.',
  },
];

const whatYouGet = [
  'Editorial Publishing',
  'Sourcebook & Actions',
  'Project Procurement',
  'Unified Communications',
  'Directory & Discovery',
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
              <h2 className="font-headline italic text-4xl text-folio-text-primary leading-[1.1]">
                One place for your projects, your products, and every conversation in between.
              </h2>
              <p className="mt-4 text-sm leading-relaxed max-w-md mx-auto" style={{ color: 'rgba(40, 30, 24, 0.75)' }}>
                Folio is where interior designers publish work, manage
                procurement, and keep every vendor communication organized
                &mdash; from first quote to final install.
              </p>
            </div>

            {/* Divider */}
            <div className="px-7">
              <hr style={{ borderColor: 'rgba(201, 169, 110, 0.12)' }} />
            </div>

            {/* How it works */}
            <div className="px-7 py-8">
              <p
                className="uppercase tracking-widest text-xs font-medium mb-2"
                style={{ color: '#a07d3f' }}
              >
                The Process
              </p>
              <h3 className="font-headline italic text-2xl text-folio-text-primary mb-6">
                How it works
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {steps.map((step, i) => (
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
                    <h4 className="text-xs font-medium text-folio-text-primary mb-1">
                      {step.title}
                    </h4>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(40, 30, 24, 0.65)' }}>
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="px-7">
              <hr style={{ borderColor: 'rgba(201, 169, 110, 0.12)' }} />
            </div>

            {/* What You Get */}
            <div className="px-7 py-8">
              <p
                className="uppercase tracking-widest text-xs font-medium mb-2"
                style={{ color: '#a07d3f' }}
              >
                What You Get
              </p>
              <h3 className="font-headline italic text-2xl text-folio-text-primary mb-5">
                One platform for the whole studio.
              </h3>
              <div className="space-y-2">
                {whatYouGet.map((item, i) => (
                  <p
                    key={i}
                    className="text-sm text-folio-text-primary leading-relaxed"
                  >
                    <span style={{ color: '#c9a96e' }}>&#10022;</span>
                    {' '}{item}
                  </p>
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
