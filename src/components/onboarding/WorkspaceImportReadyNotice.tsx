'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import './workspace-ready-notice.css';

type Notice = { id: string; type: string; title: string; body: string; actionUrl: string | null; read: boolean };

export function WorkspaceImportReadyNotice() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const pathname = usePathname();
  const suppressed = pathname?.startsWith('/auth/') || pathname?.startsWith('/onboarding');
  const [notice, setNotice] = useState<{ userId: string; item: Notice } | null>(null);
  const dismissed = useRef(new Set<string>());

  useEffect(() => {
    if (!userId || suppressed) return;
    const controller = new AbortController();
    let pending = false, reload = false;
    async function load() {
      if (document.visibilityState === 'hidden') return;
      if (pending) { reload = true; return; }
      pending = true;
      try {
        const response = await fetch('/api/notifications', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (controller.signal.aborted) return;
        const next = (data.items as Notice[] | undefined)?.find(item => item.type === 'WORKSPACE_IMPORT_READY' && !item.read && !dismissed.current.has(item.id) && item.actionUrl?.startsWith('/onboarding/workspace?import='));
        setNotice(next ? { userId: userId!, item: next } : null);
      } catch { /* The persistent notification remains in the header bell. */ }
      finally { pending = false; if (reload && !controller.signal.aborted) { reload = false; void load(); } }
    }
    void load();
    const timer = setInterval(() => void load(), 60_000);
    document.addEventListener('visibilitychange', load);
    window.addEventListener('focus', load);
    window.addEventListener('folio:notifications-changed', load);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', load); window.removeEventListener('focus', load); window.removeEventListener('folio:notifications-changed', load); };
  }, [userId, suppressed]);

  if (!userId || suppressed || notice?.userId !== userId) return null;
  const item = notice.item;
  const acknowledge = () => {
    dismissed.current.add(item.id); setNotice(null);
    void fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) })
      .then(response => { if (response.ok) window.dispatchEvent(new Event('folio:notifications-changed')); }).catch(() => {});
  };
  return <aside className="workspace-ready-notice" aria-label="Your Folio is ready" role="status">
    <button type="button" className="workspace-ready-notice__dismiss" aria-label="Dismiss profile ready notice" onClick={acknowledge}>×</button>
    <p className="workspace-ready-notice__eyebrow">Ready for your next step</p>
    <h2>{item.title}</h2><p>{item.body}</p>
    <Link href={item.actionUrl!} onClick={acknowledge}>Explore my Folio <span aria-hidden="true">↗</span></Link>
  </aside>;
}
