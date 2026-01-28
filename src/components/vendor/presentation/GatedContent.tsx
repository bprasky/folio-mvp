'use client';

import { motion } from 'framer-motion';

interface GatedContentProps {
  children: React.ReactNode;
  isGated: boolean;
  message?: string;
  ctaLabel?: string;
  onCTA?: () => void;
  className?: string;
}

/**
 * Shows blurred preview with overlay until admin activation.
 */
export default function GatedContent({
  children,
  isGated,
  message = 'Activate your account to see full details',
  ctaLabel = 'Activate Now',
  onCTA,
  className = '',
}: GatedContentProps) {
  if (!isGated) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Blurred content */}
      <div className="filter blur-md select-none pointer-events-none" aria-hidden>
        {children}
      </div>

      {/* Overlay */}
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-neu"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="text-center px-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#F5F3EF] flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--text-tertiary)]"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <p className="text-folio-body text-[var(--text-secondary)] mb-4 max-w-xs">
            {message}
          </p>
          {onCTA && (
            <button
              onClick={onCTA}
              className="px-6 py-2.5 bg-[var(--text-primary)] text-white rounded-neu-btn font-medium text-folio-ui hover:bg-[var(--accent)] transition-colors"
            >
              {ctaLabel}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
