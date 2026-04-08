'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSaveToProjectFolder } from '@/components/projects/useSaveToProjectFolder';

interface UseProductActionsOptions {
  productId: string;
  href?: string;
  source?: string;
}

/**
 * Unified hook for product actions: Like, Save, Add to Project, View.
 * Wraps existing API endpoints and hooks into a single interface.
 */
export function useProductActions({ productId, href, source = 'interaction' }: UseProductActionsOptions) {
  const router = useRouter();
  const { openSaveDialog, modalProps } = useSaveToProjectFolder();

  const handleLike = useCallback(async () => {
    try {
      await fetch('/api/signals/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
    } catch (e) {
      console.error('[useProductActions] Like failed:', e);
    }
  }, [productId]);

  const handleSave = useCallback(async () => {
    try {
      await fetch('/api/signals/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
    } catch (e) {
      console.error('[useProductActions] Save failed:', e);
    }
  }, [productId]);

  const handleAddToProject = useCallback(() => {
    openSaveDialog({ productId, source });
  }, [productId, source, openSaveDialog]);

  const handleView = useCallback(() => {
    const url = href || `/products/${productId}`;
    router.push(url);
  }, [productId, href, router]);

  return {
    handleLike,
    handleSave,
    handleAddToProject,
    handleView,
    saveModalProps: modalProps,
  };
}
