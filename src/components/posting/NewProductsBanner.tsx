'use client';

import { useState } from 'react';
import { FaTag, FaTimes } from 'react-icons/fa';

interface NewProductsBannerProps {
  projectId: string;
  newProductCount: number;
  onRegenerateClick: () => void;
}

/**
 * Banner shown when new products have been added since the last post generation.
 * Prompts the designer to regenerate their post to include the new products.
 */
export function NewProductsBanner({
  projectId,
  newProductCount,
  onRegenerateClick
}: NewProductsBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || newProductCount <= 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <FaTag className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-amber-900">
              {newProductCount} new product{newProductCount !== 1 ? 's' : ''} added
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Your post can now include these products in the materials ledger. Regenerate to update.
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400 hover:text-amber-600 transition-colors p-1"
          aria-label="Dismiss"
        >
          <FaTimes className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2 ml-11">
        <button
          onClick={onRegenerateClick}
          className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          Update Post
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="px-4 py-2 text-amber-700 text-sm hover:underline"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
