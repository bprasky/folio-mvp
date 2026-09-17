'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StudioData } from '@/lib/publishing-studio/types';

export function useStudio(projectId?: string) {
  const [data, setData] = useState<StudioData | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setData(null);
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    fetch(`/api/publishing-studio${query}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load Publishing Studio.');
        return result as StudioData;
      })
      .then(setData)
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [projectId, revision]);
  return { data, error, reload };
}
