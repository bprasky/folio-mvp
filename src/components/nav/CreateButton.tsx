'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useSession } from 'next-auth/react';
import { normalizeRole } from '@/lib/permissions';
import {
  getCreateActions,
  needsUpgradeForContent,
  getUpgradePrompt,
  type ContentType,
  type VendorTier,
} from '@/lib/authz/createPermissions';

interface CreateButtonProps {
  /** Optional className for custom styling */
  className?: string;
  /** Variant for different visual styles */
  variant?: 'default' | 'compact' | 'icon';
}

/**
 * Role-aware Create button with dropdown menu.
 *
 * Shows different options based on user role and vendor tier:
 * - Designer: New Project, New Article
 * - Vendor Standard: New Event
 * - Vendor Pro+: New Event, New Collaboration Story
 * - Admin: All content types
 *
 * Tier-gated options show upgrade prompt.
 */
export default function CreateButton({ className, variant = 'default' }: CreateButtonProps) {
  const { data: session } = useSession();
  const role = normalizeRole(session?.user?.role);
  const vendorTier = (session?.user as any)?.vendorTier as VendorTier | undefined;
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Get available create actions based on role and tier
  const actions = getCreateActions(role, vendorTier);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  // Don't render if no actions available
  if (actions.length === 0) return null;

  const handleActionClick = (action: {
    href: string;
    contentType: ContentType;
    label: string;
  }) => {
    // Check if this action needs an upgrade
    const needsUpgrade = needsUpgradeForContent(role, action.contentType, vendorTier);

    if (needsUpgrade) {
      // Show upgrade prompt or redirect to pricing page
      const upgradeMessage = getUpgradePrompt(action.contentType);
      // For now, show an alert - in production this could be a modal
      if (typeof window !== 'undefined') {
        alert(upgradeMessage || 'Upgrade required for this feature');
      }
      setOpen(false);
      return;
    }

    setOpen(false);
    router.push(action.href);
  };

  const buttonClasses = clsx(
    'rounded-xl font-medium transition-colors',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
    {
      'px-3 py-1.5 text-sm bg-neutral-900 text-white hover:bg-neutral-800':
        variant === 'default',
      'px-2 py-1 text-xs bg-neutral-900 text-white hover:bg-neutral-800':
        variant === 'compact',
      'w-8 h-8 flex items-center justify-center bg-neutral-900 text-white hover:bg-neutral-800':
        variant === 'icon',
    },
    className
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={buttonClasses}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Create new content"
      >
        {variant === 'icon' ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        ) : (
          '+ Create'
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Create content options"
          className={clsx(
            'absolute right-0 mt-2 min-w-[200px] overflow-hidden rounded-xl',
            'border border-black/5 bg-white/95 backdrop-blur-md shadow-lg',
            'z-50'
          )}
        >
          {actions.map((action) => {
            const needsUpgrade = needsUpgradeForContent(
              role,
              action.contentType,
              vendorTier
            );
            const upgradePrompt = needsUpgrade
              ? getUpgradePrompt(action.contentType)
              : null;

            return (
              <button
                key={action.contentType}
                onClick={() => handleActionClick(action)}
                role="menuitem"
                className={clsx(
                  'block w-full px-4 py-2.5 text-left transition-colors',
                  'hover:bg-black/5',
                  needsUpgrade
                    ? 'opacity-60 cursor-not-allowed'
                    : 'text-neutral-900'
                )}
              >
                <span className="block text-sm font-medium">{action.label}</span>
                {action.description && !needsUpgrade && (
                  <span className="block text-xs text-neutral-500 mt-0.5">
                    {action.description}
                  </span>
                )}
                {needsUpgrade && upgradePrompt && (
                  <span className="block text-xs text-amber-600 mt-0.5">
                    {upgradePrompt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
