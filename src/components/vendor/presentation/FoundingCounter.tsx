'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

interface FoundingCounterProps {
  totalSlots: number;
  spotsRemaining: number;
  invitesSent: number;
  isEligible: boolean;
  currentSlot: number | null;
  onClaim?: () => void;
  className?: string;
}

export default function FoundingCounter({
  totalSlots,
  spotsRemaining,
  invitesSent,
  isEligible,
  currentSlot,
  onClaim,
  className = '',
}: FoundingCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const [animatedRemaining, setAnimatedRemaining] = useState(totalSlots);

  useEffect(() => {
    if (!isInView) return;
    const timer = setTimeout(() => {
      setAnimatedRemaining(spotsRemaining);
    }, 300);
    return () => clearTimeout(timer);
  }, [isInView, spotsRemaining, totalSlots]);

  const claimedCount = totalSlots - spotsRemaining;

  return (
    <div ref={ref} className={`${className}`}>
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-folio-meta mb-2">
          <span className="text-folio-text-secondary font-medium">
            Founding Vendor Program
          </span>
          <span className="text-folio-text-tertiary">
            {animatedRemaining} of {totalSlots} spots remaining
          </span>
        </div>
        <div className="h-3 bg-surface-elevated rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[var(--accent)] to-[#D4A574] rounded-full"
            initial={{ width: 0 }}
            animate={isInView ? { width: `${(claimedCount / totalSlots) * 100}%` } : {}}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          />
        </div>
      </div>

      {/* Slot indicators */}
      <div className="grid grid-cols-10 gap-1.5 mb-6">
        {Array.from({ length: totalSlots }).map((_, i) => {
          const isClaimed = i < claimedCount;
          const isCurrentSlot = currentSlot !== null && i === currentSlot - 1;

          return (
            <motion.div
              key={i}
              className={`
                h-8 rounded-md flex items-center justify-center text-xs font-medium
                ${isCurrentSlot
                  ? 'bg-[var(--accent)] text-white ring-2 ring-[var(--accent)] ring-offset-2'
                  : isClaimed
                    ? 'bg-[var(--text-primary)] text-white'
                    : 'bg-surface-elevated text-folio-text-tertiary'
                }
              `}
              initial={{ scale: 0, opacity: 0 }}
              animate={isInView ? { scale: 1, opacity: 1 } : {}}
              transition={{ delay: 0.05 * i, duration: 0.3 }}
            >
              {i + 1}
            </motion.div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="flex gap-6 mb-6 text-folio-meta">
        <div>
          <span className="font-semibold text-folio-text-primary text-lg">
            {invitesSent}
          </span>
          <span className="text-folio-text-tertiary ml-1">invites sent</span>
        </div>
        <div>
          <span className="font-semibold text-folio-text-primary text-lg">
            {spotsRemaining}
          </span>
          <span className="text-folio-text-tertiary ml-1">spots remaining</span>
        </div>
      </div>

      {/* CTA */}
      {currentSlot ? (
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-elevated rounded-neu-sm">
          <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="text-folio-body text-folio-text-primary font-medium">
            You&apos;re Founding Vendor #{currentSlot}
          </span>
        </div>
      ) : isEligible ? (
        <button
          onClick={onClaim}
          className="w-full py-3.5 bg-[var(--text-primary)] text-white rounded-neu-btn font-medium text-folio-ui hover:bg-[var(--accent)] transition-colors"
        >
          Claim Your Founding Vendor Spot
        </button>
      ) : (
        <div className="text-center text-folio-meta text-folio-text-tertiary py-3">
          {spotsRemaining === 0 ? 'All founding vendor spots have been claimed' : 'Not currently eligible for the founding program'}
        </div>
      )}
    </div>
  );
}
