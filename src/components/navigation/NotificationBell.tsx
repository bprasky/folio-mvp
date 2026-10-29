'use client';

import { useState, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Bell } from 'lucide-react';
import styles from './navigation.module.css';

const POLL_INTERVAL = 60000; // 60s, matching InboxButton

type Notif = {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationBell({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelId = useId();

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
    if (n.actionUrl) { onNavigate?.(); router.push(n.actionUrl); }
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
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={styles.menuAction}
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <Bell size={16} strokeWidth={1.5} aria-hidden="true" />
        Notifications
        {unread > 0 && (
          <span
            className={styles.unread}
            aria-label={`${unread} unread notifications`}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div id={panelId} className={styles.notificationPanel}>
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
