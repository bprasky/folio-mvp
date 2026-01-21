'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import type { Product } from '@prisma/client';

interface BoostReviewPanelProps {
  opportunity: {
    id: string;
    projectId: string;
    questionId: string;
    fullAnswer: string;
    suggestedPullQuote: string | null;
    productIds: string[];
    sentiment: string;
    status: string;
    expiresAt: Date;
    designer: {
      id: string;
      name: string;
      profileImage: string | null;
      title: string | null;
      location: string | null;
    };
    project: {
      id: string;
      title: string;
      images: { url: string }[];
    };
    vendor: {
      id: string;
      name: string;
    };
    boost: {
      id: string;
      pullQuote: string;
      showInArticle: boolean;
      showOnVendorPage: boolean;
    } | null;
  };
  vendorProducts: Product[];
  canBoost: boolean;
  isExpired: boolean;
  isAlreadyBoosted: boolean;
}

export function BoostReviewPanel({
  opportunity,
  vendorProducts,
  canBoost,
  isExpired,
  isAlreadyBoosted,
}: BoostReviewPanelProps) {
  const router = useRouter();
  const [editedQuote, setEditedQuote] = useState(
    opportunity.suggestedPullQuote || opportunity.fullAnswer
  );
  const [showInArticle, setShowInArticle] = useState(true);
  const [showOnVendorPage, setShowOnVendorPage] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBoost = async () => {
    if (!editedQuote.trim()) {
      setError('Please enter a pull quote');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/vendor/boosts/${opportunity.id}/boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pullQuote: editedQuote,
          showInArticle,
          showOnVendorPage,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to boost');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to boost testimonial');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await fetch(`/api/vendor/boosts/${opportunity.id}/decline`, {
        method: 'POST',
      });
      router.push('/vendor/boosts');
    } catch (err) {
      setError('Failed to decline opportunity');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-light text-stone-800">Testimonial Opportunity</h1>
        <p className="text-stone-500 mt-1">
          {isAlreadyBoosted
            ? 'You boosted this testimonial'
            : isExpired
              ? 'This opportunity has expired'
              : `Expires ${formatDistanceToNow(new Date(opportunity.expiresAt), { addSuffix: true })}`}
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Designer & Project Context */}
      <div className="flex gap-6 p-6 bg-stone-50 rounded-lg">
        <img
          src={opportunity.designer.profileImage || '/default-avatar.png'}
          alt={opportunity.designer.name}
          className="w-16 h-16 rounded-full object-cover"
        />
        <div>
          <h2 className="font-medium text-stone-800">{opportunity.designer.name}</h2>
          <p className="text-sm text-stone-500">
            {opportunity.designer.title}
            {opportunity.designer.location && ` \u00B7 ${opportunity.designer.location}`}
          </p>
          <p className="text-sm text-stone-600 mt-2">
            Project: <strong>{opportunity.project.title}</strong>
          </p>
        </div>
      </div>

      {/* Project Images */}
      {opportunity.project.images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {opportunity.project.images.slice(0, 6).map((img, i) => (
            <img
              key={i}
              src={img.url}
              alt=""
              className="aspect-[4/3] object-cover rounded-lg"
            />
          ))}
        </div>
      )}

      {/* Your Products in This Project */}
      {vendorProducts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-stone-600 mb-3">
            Your products in this project
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {vendorProducts.map((product) => (
              <div key={product.id} className="flex-shrink-0 w-32 text-center">
                <img
                  src={product.imageUrl || '/product-placeholder.png'}
                  alt={product.name}
                  className="w-32 h-32 object-cover rounded-lg"
                />
                <p className="text-xs text-stone-600 mt-2 truncate">{product.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The Quote */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-stone-600">The testimonial</h3>

        {/* Full answer for context */}
        <div className="p-4 bg-stone-50 rounded-lg">
          <p className="text-sm text-stone-500 mb-2">Full answer:</p>
          <p className="text-stone-700 leading-relaxed">{opportunity.fullAnswer}</p>
        </div>

        {/* Editable pull quote */}
        {!isAlreadyBoosted && !isExpired && canBoost && (
          <div>
            <label className="text-sm text-stone-600 block mb-2">
              Pull quote (you can edit this):
            </label>
            <textarea
              value={editedQuote}
              onChange={(e) => setEditedQuote(e.target.value)}
              rows={4}
              className="w-full p-4 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
              placeholder="Select the best quote from the answer above..."
            />
          </div>
        )}

        {/* Display of boosted quote */}
        {isAlreadyBoosted && opportunity.boost && (
          <div className="border-l-4 border-stone-400 pl-4 py-2">
            <p className="text-lg text-stone-800 italic">"{opportunity.boost.pullQuote}"</p>
            <p className="text-sm text-stone-500 mt-2">— {opportunity.designer.name}</p>
          </div>
        )}
      </div>

      {/* Boost Options */}
      {!isAlreadyBoosted && !isExpired && canBoost && (
        <div className="space-y-4 p-6 border border-stone-200 rounded-lg">
          <h3 className="font-medium text-stone-800">Placement options</h3>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showInArticle}
              onChange={(e) => setShowInArticle(e.target.checked)}
              className="w-5 h-5 rounded border-stone-300"
            />
            <div>
              <p className="text-stone-800">Show in project editorial</p>
              <p className="text-sm text-stone-500">
                Quote appears in the published article with attribution
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnVendorPage}
              onChange={(e) => setShowOnVendorPage(e.target.checked)}
              className="w-5 h-5 rounded border-stone-300"
            />
            <div>
              <p className="text-stone-800">Show on your vendor page</p>
              <p className="text-sm text-stone-500">
                Testimonial appears in your Folio profile
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 pt-4 border-t border-stone-200">
        {isAlreadyBoosted ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircleIcon className="w-5 h-5" />
            <span>Boosted</span>
          </div>
        ) : isExpired ? (
          <p className="text-stone-500">This opportunity has expired</p>
        ) : !canBoost ? (
          <div className="flex-1">
            <p className="text-stone-600 mb-3">
              Upgrade to a paid plan to boost testimonials
            </p>
            <a
              href="/vendor/settings/billing"
              className="inline-block px-6 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700"
            >
              View Plans
            </a>
          </div>
        ) : (
          <>
            <button
              onClick={handleDecline}
              disabled={isSubmitting}
              className="px-6 py-2 text-stone-600 hover:text-stone-800 disabled:opacity-50"
            >
              Decline
            </button>
            <button
              onClick={handleBoost}
              disabled={isSubmitting || !editedQuote.trim()}
              className="px-6 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Boosting...' : 'Boost Testimonial'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
