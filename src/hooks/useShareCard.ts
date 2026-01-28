'use client';

import { useState, useCallback } from 'react';
import type { ShareCardResult, ShareCardVariant } from '@/lib/share-cards';

interface UseShareCardOptions {
  contributionId: string;
  autoGenerate?: boolean;
}

interface UseShareCardReturn {
  shareCards: ShareCardResult[];
  loading: boolean;
  error: string | null;
  selectedVariant: ShareCardVariant;
  setSelectedVariant: (variant: ShareCardVariant) => void;
  generateCards: (variants?: ShareCardVariant[]) => Promise<void>;
  trackShare: (action: 'download' | 'share') => Promise<void>;
  selectedCard: ShareCardResult | undefined;
}

export function useShareCard({
  contributionId,
  autoGenerate = false,
}: UseShareCardOptions): UseShareCardReturn {
  const [shareCards, setShareCards] = useState<ShareCardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ShareCardVariant>('instagram_post');

  const generateCards = useCallback(
    async (variants?: ShareCardVariant[]) => {
      setLoading(true);
      setError(null);

      try {
        // First check for existing cards
        const getResponse = await fetch(`/api/share-cards/${contributionId}`);
        if (getResponse.ok) {
          const getData = await getResponse.json();
          if (getData.shareCards.length > 0 && !autoGenerate) {
            setShareCards(getData.shareCards);
            setLoading(false);
            return;
          }
        }

        // Generate cards
        const response = await fetch(`/api/share-cards/${contributionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variants }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to generate share cards');
        }

        const data = await response.json();
        setShareCards(data.shareCards || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    },
    [contributionId, autoGenerate]
  );

  const trackShare = useCallback(
    async (action: 'download' | 'share') => {
      try {
        await fetch('/api/share-cards/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contributionId,
            action,
          }),
        });
      } catch (err) {
        console.error('Error tracking share:', err);
      }
    },
    [contributionId]
  );

  const selectedCard = shareCards.find((c) => c.variant === selectedVariant);

  return {
    shareCards,
    loading,
    error,
    selectedVariant,
    setSelectedVariant,
    generateCards,
    trackShare,
    selectedCard,
  };
}
