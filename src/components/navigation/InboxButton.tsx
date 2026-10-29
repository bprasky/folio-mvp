'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Mail } from 'lucide-react';
import styles from './navigation.module.css';

const POLL_INTERVAL = 60000; // 60 seconds

export function InboxButton({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!session?.user) return;

    function fetchUnread() {
      fetch('/api/messages/unread-count')
        .then((res) => res.json())
        .then((data) => setUnreadCount(data.unreadCount ?? 0))
        .catch(() => {});
    }

    fetchUnread();
    const interval = setInterval(fetchUnread, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [session?.user]);

  if (!session?.user) return null;

  return (
    <Link href="/inbox" onClick={onNavigate} className={styles.menuAction}>
      <Mail size={16} strokeWidth={1.5} aria-hidden="true" />
      Inbox
      {unreadCount > 0 && (
        <span
          className={styles.unread}
          aria-label={`${unreadCount} unread messages`}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
