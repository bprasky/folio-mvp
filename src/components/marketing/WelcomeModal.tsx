'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const SESSION_KEY = 'folio_welcome_dismissed';

const steps = [
  {
    title: 'Upload your photography',
    description:
      'Bring in the images from your completed project, room by room.',
  },
  {
    title: 'Tell the story',
    description:
      'A brief interview walks you through the decisions, the brief, and the details that don\u2019t make it into the photos.',
  },
  {
    title: 'Folio does the rest',
    description:
      'Your project is structured into a professional post \u2014 your name, your products, your voice attached to every room.',
  },
];

const pillars = [
  { label: 'Your Specifications', title: 'A directory that builds itself', href: '/for-designers/directory' },
  { label: 'Your Editorial', title: 'Posts that keep working', href: '/for-designers/editorial' },
  { label: 'Your Identity', title: 'A bio that evolves with your work', href: '/for-designers/bio' },
  { label: 'Your Credit', title: 'Get credited for what you specify', href: '/for-designers/attribution' },
  { label: 'Your Clients', title: 'Find clients whose taste already matches yours', href: '/for-designers/client-matching' },
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
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          background: 'rgba(0,0,0,0.15)',
        }}
        initial={{ opacity: 0 }}
        animate={dismissing ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: dismissing ? 0.2 : 0.3 }}
        onClick={handleDismiss}
      >
        {/* Modal panel */}
        <motion.div
          className="relative w-[88%] max-w-[620px] max-h-[92vh] flex flex-col overflow-hidden"
          style={{
            background: 'rgba(245, 242, 237, 0.45)',
            backdropFilter: 'blur(40px) saturate(160%) brightness(1.08)',
            WebkitBackdropFilter: 'blur(40px) saturate(160%) brightness(1.08)',
            border: '1px solid rgba(255, 255, 255, 0.28)',
            borderRadius: '20px',
            boxShadow:
              '0 8px 48px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.35) inset',
          }}
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
            <span className="font-headline text-xl tracking-wide font-semibold text-[#1a1410]">
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
              <h2 className="font-headline italic text-4xl text-[#1a1410] leading-[1.1]">
                Your work is the product.
                <br />
                Folio treats it that way.
              </h2>
              <p className="mt-4 text-sm leading-relaxed max-w-md mx-auto" style={{ color: 'rgba(40, 30, 24, 0.75)' }}>
                Folio is where interior designers publish completed projects as
                structured, documented records.
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
                style={{ color: '#c9a96e' }}
              >
                The Process
              </p>
              <h3 className="font-headline italic text-2xl text-[#1a1410] mb-6">
                How it works
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {steps.map((step, i) => (
                  <div
                    key={i}
                    className="p-4"
                    style={{
                      background: 'rgba(255, 255, 255, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.22)',
                      backdropFilter: 'blur(8px)',
                      borderRadius: '12px',
                    }}
                  >
                    <p
                      className="font-headline italic text-3xl mb-2"
                      style={{ color: 'rgba(201, 169, 110, 0.5)' }}
                    >
                      {i + 1}
                    </p>
                    <h4 className="text-xs font-medium text-[#1a1410] mb-1">
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
                style={{ color: '#c9a96e' }}
              >
                What You Get
              </p>
              <h3 className="font-headline italic text-2xl text-[#1a1410] mb-5">
                Built around your work. Not theirs.
              </h3>
              <div className="space-y-2.5">
                {pillars.map((pillar, i) => (
                  <Link
                    key={i}
                    href={pillar.href}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClose();
                    }}
                    className="flex items-baseline gap-3 group py-2 transition-colors hover:bg-black/[0.02] -mx-2 px-2 rounded-lg"
                    style={{
                      borderBottom:
                        i < pillars.length - 1
                          ? '1px solid rgba(201, 169, 110, 0.1)'
                          : 'none',
                    }}
                  >
                    <span className="uppercase tracking-widest text-[10px] whitespace-nowrap min-w-[100px]" style={{ color: 'rgba(40, 30, 24, 0.6)' }}>
                      {pillar.label}
                    </span>
                    <span className="font-headline italic text-sm text-[#1a1410] group-hover:text-[#c9a96e] transition-colors">
                      {pillar.title}
                    </span>
                    <span className="text-[#c9a96e]/40 text-sm ml-auto shrink-0">
                      &rarr;
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="px-7">
              <hr style={{ borderColor: 'rgba(201, 169, 110, 0.12)' }} />
            </div>

            {/* Founding cohort */}
            <div className="px-7 py-8 pb-4">
              <p
                className="uppercase tracking-widest text-xs font-medium mb-2"
                style={{ color: '#c9a96e' }}
              >
                Founding Designers
              </p>
              <h3 className="font-headline italic text-2xl text-[#1a1410] mb-5">
                We&rsquo;re building the founding cohort now.
              </h3>
              <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(40, 30, 24, 0.75)' }}>
                Folio is invite-only during its founding phase. Founding designers
                receive permanent recognition on the platform and structural
                advantages that don&rsquo;t go away as the platform grows.
              </p>
              <p className="text-xs font-medium text-[#1a1410]">
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
              className="text-xs hover:text-[#1a1410] transition-colors"
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
