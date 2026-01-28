'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

interface DesignerQuote {
  quote: string;
  designerName: string;
  designerProfileImage: string | null;
  designerProfileUrl: string;
  projectName: string;
  projectUrl: string;
}

interface DesignerQuotesProps {
  quotes: DesignerQuote[];
  className?: string;
}

/**
 * Displays designer quotes/testimonials for a vendor product page.
 * Shows quotes from designers who have added the product to their shop.
 */
export default function DesignerQuotes({ quotes, className = '' }: DesignerQuotesProps) {
  if (quotes.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-folio-ui font-semibold text-[var(--text-primary)]">
        What designers are saying
      </h3>

      <div className="space-y-4">
        {quotes.map((item, i) => (
          <motion.div
            key={`${item.designerProfileUrl}-${i}`}
            className="bg-[#F5F3EF] rounded-neu-sm p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <blockquote className="text-folio-body text-[var(--text-primary)] italic mb-3">
              &ldquo;{item.quote}&rdquo;
            </blockquote>

            <div className="flex items-center gap-3">
              {/* Designer avatar */}
              <div className="relative w-8 h-8 rounded-full overflow-hidden bg-[#E8E4DF] flex-shrink-0">
                {item.designerProfileImage ? (
                  <Image
                    src={item.designerProfileImage}
                    alt={item.designerName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-folio-meta text-[var(--text-tertiary)] font-medium">
                    {item.designerName.charAt(0)}
                  </div>
                )}
              </div>

              {/* Attribution */}
              <div className="text-folio-meta text-[var(--text-secondary)]">
                <span>&mdash; </span>
                <Link
                  href={item.designerProfileUrl}
                  className="text-[var(--text-primary)] font-medium hover:text-[var(--accent)] transition-colors"
                >
                  {item.designerName}
                </Link>
                <span className="mx-1">&bull;</span>
                <span>used at </span>
                <Link
                  href={item.projectUrl}
                  className="text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
                >
                  {item.projectName}
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
