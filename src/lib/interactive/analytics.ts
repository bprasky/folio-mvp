export type Analytic =
  | { ev: 'hover_tag'; productId: string; source: 'inline' | 'trail' }
  | { ev: 'open_hover_card'; productId: string }
  | { ev: 'save_to_board'; productIds: string[]; source: 'details' | 'inline' }
  | { ev: 'scroll_sync_image'; imageId: string; paragraphIndex: number };

export function track(a: Analytic) {
  try {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', a);
    // Hook: send to your analytics endpoint if needed.
    // fetch('/api/analytics', {method:'POST', body: JSON.stringify(a)});
  } catch {}
}


