'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface DesignerCardProps {
  name: string;
  profileImage: string | null;
  location: string | null;
  followerCount: number;
  projectCount: number;
  quote: string | null;
  productName?: string;
  projectName?: string;
  /** Whether identity is gated (pre-activation) */
  isGated?: boolean;
  className?: string;
}

export default function DesignerCard({
  name,
  profileImage,
  location,
  followerCount,
  projectCount,
  quote,
  productName,
  projectName,
  isGated = false,
  className = '',
}: DesignerCardProps) {
  return (
    <motion.div
      className={`rounded-neu bg-[var(--bg-base)] shadow-neu-raised p-6 flex flex-col gap-4 min-w-[280px] max-w-[340px] ${className}`}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      {/* Designer info */}
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-[#F5F3EF] flex-shrink-0">
          {isGated ? (
            <div className="w-full h-full bg-gradient-to-br from-[#D4CFC8] to-[#E8E4DF]" />
          ) : profileImage ? (
            <Image
              src={profileImage}
              alt={name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--text-tertiary)] font-medium text-lg">
              {name.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className={`font-medium text-[var(--text-primary)] truncate ${isGated ? 'filter blur-sm select-none' : ''}`}>
            {name}
          </p>
          {location && (
            <p className={`text-folio-meta text-[var(--text-tertiary)] truncate ${isGated ? 'filter blur-sm select-none' : ''}`}>
              {location}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-folio-meta">
        <div>
          <span className="font-semibold text-[var(--text-primary)]">
            {followerCount.toLocaleString()}
          </span>
          <span className="text-[var(--text-tertiary)] ml-1">followers</span>
        </div>
        <div>
          <span className="font-semibold text-[var(--text-primary)]">
            {projectCount}
          </span>
          <span className="text-[var(--text-tertiary)] ml-1">projects</span>
        </div>
      </div>

      {/* Quote */}
      {quote && (
        <blockquote className="border-l-2 border-[var(--accent)] pl-3 text-folio-body text-[var(--text-secondary)] italic">
          &ldquo;{quote}&rdquo;
        </blockquote>
      )}

      {/* Context */}
      {(productName || projectName) && (
        <div className="text-folio-meta text-[var(--text-tertiary)]">
          {productName && <span>Tagged <strong className="text-[var(--text-secondary)]">{productName}</strong></span>}
          {productName && projectName && <span> in </span>}
          {projectName && <span className="text-[var(--text-secondary)]">{projectName}</span>}
        </div>
      )}
    </motion.div>
  );
}
