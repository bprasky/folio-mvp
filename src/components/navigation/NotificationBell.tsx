'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

const POLL_INTERVAL = 60000; // 60s, matching InboxButton

type Notif = {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const { data: session } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session?.user) return;
    function load() {
      fetch('/api/notifications')
        .then((r) => r.json())
        .then((d) => {
          setItems(d.items ?? []);
          setUnread(d.unreadCount ?? 0);
        })
        .catch(() => {});
    }
    load();
    const i = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(i);
  }, [session?.user]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!session?.user) return null;

  const markRead = (id: string) => {
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  };

  const onItem = (n: Notif) => {
    setOpen(false);
    if (!n.read) {
      markRead(n.id);
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.actionUrl) router.push(n.actionUrl);
  };

  const markAll = () => {
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    setUnread(0);
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
  };

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-11 w-11 sm:h-auto sm:w-auto items-center justify-center"
        title="Notifications"
        aria-label="Notifications"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'var(--text-secondary, #5C554D)' }}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center"
            style={{
              backgroundColor: '#2C2825',
              fontSize: 'var(--type-fine)',
              lineHeight: 'var(--lh-logo)',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-0 sm:right-auto sm:top-full mt-2 sm:w-80 max-h-96 overflow-y-auto rounded-xl border border-folio-border-subtle bg-surface-card shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-folio-border-subtle">
            <span className="text-sm font-semibold text-folio-text-primary">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-folio-text-tertiary hover:text-folio-text-primary">
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-folio-text-tertiary text-center">You&apos;re all caught up.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => onItem(n)}
                    className={`block w-full text-left px-4 py-3 border-b border-folio-border-subtle hover:bg-surface-ground transition-colors ${
                      n.read ? 'opacity-60' : ''
                    }`}
                  >
                    <span className="flex items-start gap-2">
                      {!n.read && (
                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--accent)]" />
                      )}
                      <span className={n.read ? 'pl-4' : ''}>
                        <span className="block text-sm font-medium text-folio-text-primary">{n.title}</span>
                        <span className="block text-xs text-folio-text-secondary">{n.body}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
