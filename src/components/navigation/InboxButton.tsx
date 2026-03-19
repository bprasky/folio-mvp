'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

const POLL_INTERVAL = 60000; // 60 seconds

export function InboxButton() {
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
    <Link href="/inbox" className="relative flex items-center justify-center" title="Inbox">
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
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center"
          style={{
            backgroundColor: '#2C2825',
            fontSize: '10px',
            lineHeight: 1,
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
