'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface Props {
  projectId: string;
  designerId: string | null;
  postStatus: string;
  variant?: 'default' | 'icon';
}

export function ShareToInstagramButton({
  projectId,
  designerId,
  postStatus,
  variant = 'default',
}: Props) {
  const { data: session } = useSession();

  // Only show for the project owner when published
  if (!session?.user?.id) return null;
  if (session.user.id !== designerId) return null;
  if (postStatus !== 'PUBLISHED') return null;

  if (variant === 'icon') {
    return (
      <Link
        href={`/designer/projects/${projectId}/instagram`}
        className="inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle,#E8E0D8)] p-2 text-[var(--text-secondary,#8B7B68)] transition-colors hover:border-[var(--accent,#C4B5A0)] hover:text-[var(--text-primary,#2C2420)]"
        title="Share to Instagram"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect
            x="1.5"
            y="1.5"
            width="13"
            height="13"
            rx="3.5"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="12" cy="4" r="0.8" fill="currentColor" />
        </svg>
      </Link>
    );
  }

  return (
    <Link
      href={`/designer/projects/${projectId}/instagram`}
      className="inline-flex items-center gap-2 rounded-xl border border-[#E8E0D8] bg-white px-4 py-2 text-[14px] font-medium text-[#2C2420] shadow-sm transition-all duration-200 hover:border-[#C4B5A0] hover:shadow-md"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect
          x="1.5"
          y="1.5"
          width="13"
          height="13"
          rx="3.5"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="12" cy="4" r="0.8" fill="currentColor" />
      </svg>
      Share to Instagram
    </Link>
  );
}
