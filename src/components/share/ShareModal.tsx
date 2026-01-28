'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { ShareCardPreview } from './ShareCardPreview';
import { ShareButtons } from './ShareButtons';
import type { ShareCardVariant, ShareCardResult } from '@/lib/share-cards';

interface ShareModalProps {
  contributionId: string;
  articleTitle: string;
  articleUrl: string;
  contributorCount?: number;
  onClose: () => void;
}

export function ShareModal({
  contributionId,
  articleTitle,
  articleUrl,
  contributorCount = 0,
  onClose,
}: ShareModalProps) {
  const [shareCards, setShareCards] = useState<ShareCardResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ShareCardVariant>('instagram_post');

  // Fetch or generate share cards
  useEffect(() => {
    async function loadShareCards() {
      try {
        // First try to get existing cards
        const response = await fetch(`/api/share-cards/${contributionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.shareCards.length > 0) {
            setShareCards(data.shareCards);
            setLoading(false);
            return;
          }
        }

        // Generate if none exist
        const genResponse = await fetch(`/api/share-cards/${contributionId}`, {
          method: 'POST',
        });
        if (genResponse.ok) {
          const genData = await genResponse.json();
          setShareCards(genData.shareCards || []);
        }
      } catch (error) {
        console.error('Error loading share cards:', error);
      } finally {
        setLoading(false);
      }
    }

    loadShareCards();
  }, [contributionId]);

  const handleShare = async (platform: string) => {
    // Track the share event
    try {
      await fetch('/api/share-cards/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contributionId,
          action: platform === 'download' ? 'download' : 'share',
        }),
      });
    } catch (error) {
      console.error('Error tracking share:', error);
    }
  };

  const selectedCard = shareCards.find((c) => c.variant === selectedVariant);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <RidgeCard padding="none" className="max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-subtle)] bg-gradient-to-r from-emerald-50 to-blue-50">
          <div className="flex items-start justify-between gap-4">
            <div className="text-center flex-1">
              <div className="text-4xl mb-2">🎉</div>
              <h2 className="folio-h2 mb-1">Your voice is live!</h2>
              <p className="folio-body text-[var(--text-secondary)]">
                You&apos;re featured in &ldquo;{articleTitle}&rdquo;
                {contributorCount > 1 && ` alongside ${contributorCount - 1} others`}.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <svg
                className="w-5 h-5 text-[var(--text-secondary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading ? (
            <div className="py-8 text-center text-[var(--text-secondary)]">
              Generating your share cards...
            </div>
          ) : (
            <>
              {/* Share card preview */}
              <div className="mb-6">
                <ShareCardPreview
                  shareCards={shareCards}
                  selectedVariant={selectedVariant}
                  onVariantChange={setSelectedVariant}
                />
              </div>

              {/* Share buttons */}
              <ShareButtons
                articleUrl={articleUrl}
                articleTitle={articleTitle}
                shareCardUrl={selectedCard?.imageUrl}
                onShare={handleShare}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)]">
          <Link
            href={articleUrl}
            className="block text-center text-[var(--accent)] hover:underline"
          >
            Read the full article →
          </Link>
        </div>
      </RidgeCard>
    </div>
  );
}
