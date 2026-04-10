/**
 * Tag interaction intelligence signals.
 * Fire-and-forget client-side signal recording for tag engagement analytics.
 * All signals include surface context for vendor intelligence.
 */

import type { TagSurface } from '@/components/project/interaction/types';

type TagSignalType =
  | 'tagged_image_hover'
  | 'tag_revealed'
  | 'tag_activated'
  | 'hologram_interaction'
  | 'product_view_navigate'
  | 'project_add'
  | 'product_save'
  | 'asset_download'
  | 'tag_dismissed';

interface TagSignalParams {
  type: TagSignalType;
  productId?: string;
  imageId?: string;
  surface: TagSurface;
  expansionType?: '2d' | '3d';
  duration?: number;
  projectId?: string;
  format?: string;
}

/**
 * Record a tag interaction signal. Fire-and-forget — errors are logged but don't block.
 * Uses the existing signals infrastructure via POST /api/signals/engagement.
 */
export function recordTagSignal(params: TagSignalParams): void {
  try {
    // Fire-and-forget: post to engagement endpoint
    fetch('/api/signals/engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: params.type,
        productId: params.productId || null,
        imageId: params.imageId || null,
        surface: params.surface,
        metadata: {
          expansionType: params.expansionType,
          duration: params.duration,
          projectId: params.projectId,
          format: params.format,
        },
      }),
    }).catch(() => {
      // Silent failure — engagement signals are non-critical
    });
  } catch {
    // Swallow — engagement signals never block interaction
  }
}
