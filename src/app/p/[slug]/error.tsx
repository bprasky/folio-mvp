'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FaHome, FaExclamationTriangle, FaSync } from 'react-icons/fa';

export default function PostError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[PostPage] Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        <div className="mb-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaExclamationTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Unable to load this project</h1>
          <p className="text-[var(--text-secondary)] mb-4">
            Something went wrong while loading this project. Please try again or return to the homepage.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center px-6 py-3 bg-secondary text-primary rounded-lg hover:bg-secondary/90 transition-colors font-medium"
          >
            <FaSync className="mr-2" />
            Try Again
          </button>

          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 border border-[var(--ridge-outer)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-elevated)] transition-colors font-medium"
          >
            <FaHome className="mr-2" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
