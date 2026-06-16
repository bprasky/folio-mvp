'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaTag } from 'react-icons/fa';

/**
 * Dashboard entry point to the vendor review queue (/vendor/review).
 *
 * Self-contained client component: fetches the queue from the API so the server
 * dashboard page never imports server-only vendor context (which would drag
 * next/headers into the client `app/vendor/page.tsx` that imports the dashboard).
 * Renders nothing for non-vendors (API 403) or until the count is known.
 */
export default function ReviewQueueBanner() {
  const [count, setCount] = useState<number | null>(null);
  const [isVendor, setIsVendor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/vendor/review-queue')
      .then(async (res) => {
        if (!res.ok) return;
        const d = await res.json();
        if (!cancelled) {
          setIsVendor(true);
          setCount(Array.isArray(d.items) ? d.items.length : 0);
        }
      })
      .catch(() => {
        /* leave hidden */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isVendor) return null;

  return (
    <Link
      href="/vendor/review"
      className="flex items-center justify-between rounded-xl border border-folio-border-subtle bg-surface-card px-4 py-3 hover:border-[var(--accent)] transition-colors"
    >
      <span className="flex items-center gap-2 folio-body text-folio-text-primary">
        <FaTag className="h-4 w-4 text-[var(--accent)]" />
        Review products tagged as yours
      </span>
      {count != null && count > 0 && (
        <span className="ml-3 inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
