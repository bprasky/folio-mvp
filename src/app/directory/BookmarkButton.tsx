'use client';

import { useState } from 'react';

interface BookmarkButtonProps {
  professionalId: string;
  initialBookmarked: boolean;
  onToggle?: (professionalId: string, bookmarked: boolean) => void;
}

export default function BookmarkButton({
  professionalId,
  initialBookmarked,
  onToggle,
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setLoading(true);
    try {
      const method = bookmarked ? 'DELETE' : 'POST';
      const res = await fetch('/api/directory/bookmarks', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ professionalId }),
      });

      if (res.ok) {
        setBookmarked(!bookmarked);
        onToggle?.(professionalId, !bookmarked);
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-elevated)]"
      aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
      title={bookmarked ? 'Remove bookmark' : 'Bookmark'}
    >
      {bookmarked ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--accent)" stroke="var(--accent)" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )}
    </button>
  );
}
