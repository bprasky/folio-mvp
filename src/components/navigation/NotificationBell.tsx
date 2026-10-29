'use client';

import { useState, useEffect, useId, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Bell } from 'lucide-react';
import { safeCallbackPath } from '@/lib/onboarding/professional-entry';
import styles from './navigation.module.css';

const CHANGED = 'folio:notifications-changed';
type Notif = { id: string; title: string; body: string; actionUrl: string | null; read: boolean };

export function NotificationBell() {
  const { data: session } = useSession();
  // Remount on account changes so another person's notices never remain visible.
  return session?.user?.id ? <AccountNotifications key={session.user.id} /> : null;
}

function AccountNotifications() {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController>();
  const panelId = useId();

  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    let pending = false, reload = false;
    async function load() {
      if (document.visibilityState === 'hidden') return;
      if (pending) { reload = true; return; }
      pending = true;
      try {
        const response = await fetch('/api/notifications', { cache: 'no-store', signal: request.signal });
        if (!response.ok) throw new Error('Could not load notifications.');
        const data = await response.json();
        if (request.signal.aborted) return;
        setItems(data.items ?? []); setUnread(data.unreadCount ?? 0); setLoaded(true); setError('');
      } catch { if (!request.signal.aborted) setError('Notifications are temporarily unavailable.'); }
      finally { pending = false; if (reload && !request.signal.aborted) { reload = false; void load(); } }
    }
    void load();
    const timer = setInterval(() => void load(), 60_000);
    window.addEventListener('focus', load);
    window.addEventListener(CHANGED, load);
    document.addEventListener('visibilitychange', load);
    return () => {
      request.abort(); clearInterval(timer);
      window.removeEventListener('focus', load); window.removeEventListener(CHANGED, load);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    window.dispatchEvent(new Event(CHANGED));
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  async function markRead(body: { id: string } | { all: true }) {
    setSaving(true);
    try {
      const response = await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: controller.current?.signal });
      if (!response.ok) throw new Error('Could not update notifications.');
      if (!controller.current?.signal.aborted) window.dispatchEvent(new Event(CHANGED));
    } catch { if (!controller.current?.signal.aborted) setError('Could not mark notifications as read. Please try again.'); }
    finally { if (!controller.current?.signal.aborted) setSaving(false); }
  }

  function onItem(item: Notif) {
    if (!item.read) void markRead({ id: item.id });
    const destination = safeCallbackPath(item.actionUrl, '');
    if (destination) { setOpen(false); router.push(destination); }
  }

  return <div ref={root} className={styles.notificationRoot} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <button ref={button} type="button" onClick={() => setOpen(value => !value)}
      className={`${styles.iconButton} ${styles.notificationButton}`} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      aria-expanded={open} aria-controls={open ? panelId : undefined} aria-haspopup="dialog">
      <Bell size={19} strokeWidth={1.5} aria-hidden="true" />
      {unread > 0 && <span className={styles.notificationBadge} aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
    </button>
    <span className="sr-only" role="status">{loaded && unread > 0 ? `${unread} unread notifications` : ''}</span>
    {open && <div ref={panel} id={panelId} role="dialog" aria-label="Notifications" tabIndex={-1} className={`${styles.popover} ${styles.notificationPanel}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-folio-border-subtle">
        <h2 className="text-sm font-semibold text-folio-text-primary">Notifications</h2>
        {unread > 0 && <button type="button" disabled={saving} onClick={() => void markRead({ all: true })} className="text-xs text-folio-text-secondary underline underline-offset-4 disabled:opacity-50">Mark all read</button>}
      </div>
      {error && <p role="alert" className="px-4 py-3 text-sm text-folio-text-secondary">{error}</p>}
      {!items.length && !error && <p className="px-4 py-6 text-sm text-folio-text-secondary text-center">{loaded ? 'You’re all caught up.' : 'Loading notifications…'}</p>}
      <ul>{items.map(item => <li key={item.id}>
        <button type="button" onClick={() => onItem(item)} className={`block w-full text-left px-4 py-3 border-b border-folio-border-subtle hover:bg-surface-ground transition-colors ${item.read ? 'opacity-70' : ''}`}>
          <span className="flex items-start gap-2">
            <span aria-hidden="true" className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${item.read ? '' : 'bg-[var(--accent)]'}`} />
            <span><span className="block text-sm font-medium text-folio-text-primary">{item.title}</span><span className="block text-xs text-folio-text-secondary mt-1">{item.body}</span></span>
          </span>
        </button>
      </li>)}</ul>
    </div>}
  </div>;
}
