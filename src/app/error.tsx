'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FaHome, FaExclamationTriangle, FaSync } from 'react-icons/fa';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        <div className="mb-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaExclamationTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Something went wrong!</h1>
          <p className="text-gray-600 mb-4">
            We encountered an unexpected error. Please try refreshing the page or go back to the homepage.
          </p>
          {error.message && (
            <details className="text-left bg-gray-50 p-4 rounded-lg mb-4">
              <summary className="cursor-pointer font-medium text-gray-800 mb-2">
                Error Details
              </summary>
              <code className="text-sm text-red-600 break-all">
                {error.message}
              </code>
            </details>
          )}
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
            className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            <FaHome className="mr-2" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
} 