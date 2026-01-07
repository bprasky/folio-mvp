'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import NavEdgeHandle from './NavEdgeHandle';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import clsx from 'clsx';
import { navItemsForRole } from '@/lib/navItems';
import { normalizeRole } from '@/lib/permissions';
import { trackNav } from '@/lib/telemetry';
import GlassCreateButton from './GlassCreateButton';

const NAV_W = 272;

function getPinned() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('folio:navPinned') === 'true';
}

export default function GlassNavRail({ mode }: { mode: 'top' | 'side' | 'landing_glass' }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const reduce = useReducedMotion();

  // All hooks must be at the top (before any conditional returns)
  const [mounted, setMounted] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false); // Manual collapse override
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Hydration: set mounted flag and load pinned state client-side only
  useEffect(() => {
    setMounted(true);
    setPinned(getPinned());
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Cross-tab sync for pinned state
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'folio:navPinned' && e.newValue != null) {
        setPinned(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    localStorage.setItem('folio:navPinned', String(next));
    // trigger synthetic event for same-tab listeners (optional)
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'folio:navPinned', newValue: String(next) })
    );
    trackNav({ type: 'nav_pin', pinned: next });
  };

  const shouldRender = mode === 'landing_glass' || pinned;
  const items = useMemo(() => navItemsForRole(session?.user?.role), [session?.user?.role]);
  const role = normalizeRole(session?.user?.role);

  // Role-aware profile route
  const profileHref =
    role === 'DESIGNER'
      ? '/designer/profile'
      : role === 'VENDOR'
      ? '/vendor/profile'
      : role === 'ADMIN'
      ? '/admin/profile'
      : '/profile';

  // Sign out: clear local/session flags and redirect to auth
  const handleSignOut = async () => {
    try {
      // "Dehydrate" any client-side role/nav state
      try {
        localStorage.removeItem('folio:navPinned');
        sessionStorage.removeItem('folio:firstNavDone');
        // add other local keys here if you store role or mode
      } catch {}
      await signOut({ callbackUrl: '/auth/signin' });
    } catch (e) {
      // As a fallback, just navigate to signin
      window.location.href = '/auth/signin';
    }
  };

  const openRail = () => {
    // Cancel any pending close
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (!open) trackNav({ type: 'nav_open', mode });
    setOpen(true);
    setCollapsed(false); // Reset collapsed state when opening
  };

  const closeRail = () => {
    // Delay closing to prevent flicker when moving from handle to rail
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      if (open) trackNav({ type: 'nav_close', mode });
      setOpen(false);
      closeTimerRef.current = null;
    }, 300); // 300ms grace period
  };

  // Don't render until client-side mounted (avoid SSR mismatch)
  if (!mounted) return null;

  return (
    <>
      {/* Left edge handle - ALWAYS VISIBLE on all routes */}
      <NavEdgeHandle
        ariaControls="landing-glass-rail"
        onOpen={openRail}
        onClose={closeRail}
        isOpen={open}
      />

      {/* Glass rail - only renders in landing_glass mode OR when pinned OR when opened by handle (unless manually collapsed) */}
      <AnimatePresence initial={false}>
        {!collapsed && (shouldRender || open) && (
          <motion.aside
            id="landing-glass-rail"
            role="navigation"
            aria-label="Glass navigation rail"
            initial={{ x: -NAV_W, opacity: 0.92 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -NAV_W, opacity: 0.92 }}
            transition={
              reduce ? { duration: 0.001 } : { type: 'spring', stiffness: 380, damping: 40 }
            }
            onMouseEnter={openRail}
            onMouseLeave={() => !pinned && closeRail()}
            className={clsx(
              'fixed left-0 top-0 z-[70] h-screen w-[272px]',
              'backdrop-blur-[var(--glass-blur,12px)]',
              'bg-[rgba(250,249,247,var(--glass-alpha,0.12))]',
              'ring-1 ring-inset ring-white/10',
              'shadow-[0_8px_24px_rgba(0,0,0,0.08)]',
              'flex flex-col'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
              <Link href="/events" className="font-serif text-xl text-neutral-900 hover:text-neutral-700">
                Folio
              </Link>
              <div className="flex items-center gap-2">
                <GlassCreateButton />
                <button
                  onClick={() => {
                    setCollapsed(true);
                    setOpen(false);
                    trackNav({ type: 'nav_close', mode });
                  }}
                  aria-label="Collapse navigation"
                  className="rounded-xl px-2 py-1 text-xs text-neutral-700/80 hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                  title="Collapse"
                >
                  ←
                </button>
                <button
                  onClick={togglePin}
                  aria-label={pinned ? 'Unpin navigation' : 'Pin navigation'}
                  className="rounded-xl px-3 py-1 text-xs text-neutral-700/80 hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                  title={pinned ? 'Pinned' : 'Pin'}
                >
                  {pinned ? '📌' : 'Pin'}
                </button>
              </div>
            </div>

            {/* Nav Items */}
            <nav className="mt-2 flex-1 overflow-y-auto px-3 py-2">
              {/* Profile is universal and should always be discoverable */}
              <Link
                href={profileHref}
                className={clsx(
                  'mb-2 block rounded-2xl px-4 py-2.5 text-[15px] font-medium outline-none transition-all duration-200',
                  'text-neutral-900/85 hover:text-neutral-900 hover:bg-white/40'
                )}
              >
                Profile
              </Link>

              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => trackNav({ type: 'nav_click', href: item.href })}
                  className={clsx(
                    'mb-1 block rounded-2xl px-4 py-2.5 text-[15px] font-medium outline-none transition-all duration-200',
                    'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                    pathname.startsWith(item.href)
                      ? 'bg-white/50 text-neutral-900 shadow-sm'
                      : 'text-neutral-900/85 hover:text-neutral-900 hover:bg-white/40'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Footer: role badge + Sign out */}
            <div className="px-5 py-4 border-t border-white/10">
              <div className="mb-2 flex items-center justify-between text-xs text-neutral-700/70">
                <span>© 2025 Folio</span>
                {session?.user?.role && (
                  <span className="text-neutral-600 capitalize">
                    {String(session.user.role).toLowerCase()}
                  </span>
                )}
              </div>
              <button
                onClick={handleSignOut}
                className="w-full rounded-xl bg-neutral-900/90 px-3 py-2 text-left text-sm font-medium text-white hover:bg-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Sign out
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile backdrop */}
      <AnimatePresence>
        {open && !pinned && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeRail}
            className="fixed inset-0 z-[65] bg-black/20 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>
    </>
  );
}

