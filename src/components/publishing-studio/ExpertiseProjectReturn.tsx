'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { expertiseIntent, expertiseReturnUrl } from '@/lib/publishing-studio/expertise-navigation';

/** Keep the comparison intention through the existing upload/processing screens. */
export function ExpertiseProjectReturn({ actorId, workspaceId, projectId, topic, projectIds }: {
  actorId: string; workspaceId: string | null; projectId: string; topic?: string; projectIds?: string;
}) {
  const key = `folio-expertise-return:${actorId}:${workspaceId || 'personal'}:${projectId}`;
  const [intent, setIntent] = useState<ReturnType<typeof expertiseIntent> | null>(null);
  useEffect(() => {
    try {
      if (topic !== undefined || projectIds !== undefined) {
        const next = expertiseIntent(topic, projectIds);
        sessionStorage.setItem(key, JSON.stringify(next)); setIntent(next);
      } else {
        const saved = sessionStorage.getItem(key);
        if (saved) { const value = JSON.parse(saved); setIntent(expertiseIntent(value.topic, Array.isArray(value.projectIds) ? value.projectIds.join(',') : '')); }
      }
    } catch { if (topic !== undefined || projectIds !== undefined) setIntent(expertiseIntent(topic, projectIds)); }
  }, [key, topic, projectIds]);
  if (!intent) return null;
  return <aside className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-b border-folio-border-subtle px-6 py-4" aria-label="Your expertise comparison">
    <div><p className="folio-ui">Adding evidence for My expertise</p><p className="folio-meta text-folio-text-secondary">{intent.topic || 'Explore a connection with your existing projects.'} Return after your photos and project details are ready.</p></div>
    <Link href={expertiseReturnUrl(intent, projectId)} className="folio-ui underline underline-offset-4">Return to my comparison</Link>
    <button className="folio-meta underline" onClick={() => { try { sessionStorage.removeItem(key); } catch {} setIntent(null); }}>Dismiss</button>
  </aside>;
}
