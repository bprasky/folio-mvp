'use client';

import { Sparkles } from 'lucide-react';

interface NewProductsBannerProps {
  newCount: number;
  onUpdatePost: () => void;
  onDismiss: () => void;
}

/**
 * Banner displayed when new products have been tagged since the last post generation.
 * Prompts the designer to update their editorial post to include the new products.
 */
export function NewProductsBanner({
  newCount,
  onUpdatePost,
  onDismiss,
}: NewProductsBannerProps) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-amber-900">
            {newCount} new product{newCount !== 1 ? 's' : ''} tagged since your last post
          </p>
          <p className="text-sm text-amber-700 mt-1">
            Update your post to include them in the editorial.
          </p>
          <div className="flex gap-3 mt-3">
            <button
              onClick={onUpdatePost}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              Update Post
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-2 text-amber-600 hover:text-amber-800 text-sm font-medium transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
