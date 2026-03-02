'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import SafeImage from '@/components/SafeImage';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'projects', label: 'Projects' },
  { id: 'shop', label: 'Shop' },
  { id: 'about', label: 'About' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

interface ProfileTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  user: {
    name: string;
    profileImage?: string | null;
  };
  firmName?: string | null;
}

export default function ProfileTabs({
  activeTab,
  onTabChange,
  user,
  firmName,
}: ProfileTabsProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const initials = user.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleTabClick = useCallback(
    (tabId: TabId) => {
      onTabChange(tabId);
    },
    [onTabChange]
  );

  return (
    <>
      {/* Sentinel element - when this scrolls out of view, show compact nav */}
      <div ref={sentinelRef} style={{ height: 0 }} />

      {/* Compact sticky nav on scroll */}
      <div
        className="compact-nav"
        style={{
          opacity: isScrolled ? 1 : 0,
          pointerEvents: isScrolled ? 'auto' : 'none',
          transform: isScrolled ? 'translateY(0)' : 'translateY(-100%)',
        }}
      >
        <div className="compact-nav-inner">
          <div className="compact-nav-user">
            {user.profileImage ? (
              <SafeImage
                src={user.profileImage}
                alt={user.name}
                width={30}
                height={30}
                className="w-[30px] h-[30px] rounded-full object-cover"
              />
            ) : (
              <div className="compact-avatar">{initials}</div>
            )}
            <div className="ml-2.5">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {user.name}
              </span>
              {firmName && (
                <span className="folio-meta ml-2">{firmName}</span>
              )}
            </div>
          </div>
          <div className="flex">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className="compact-tab"
                data-active={activeTab === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inline tab bar */}
      <div className="profile-tab-bar" style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>
        <div className="tab-bar-inner">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className="tab-item"
              data-active={activeTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .compact-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border);
          transition: all 0.3s ease;
        }
        .compact-nav-inner {
          max-width: 960px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          height: 56px;
        }
        .compact-nav-user {
          display: flex;
          align-items: center;
        }
        .compact-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--shadow-dark), var(--text-tertiary));
          color: var(--bg-base);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
        }
        .compact-tab {
          padding: 16px 16px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-tertiary);
          font-family: var(--font-body);
          font-weight: 400;
          font-size: 13px;
          cursor: pointer;
          letter-spacing: 0.04em;
          margin-left: auto;
        }
        .compact-tab:first-of-type {
          margin-left: auto;
        }
        .compact-tab[data-active='true'] {
          border-bottom-color: var(--text-primary);
          color: var(--text-primary);
          font-weight: 600;
        }
        .tab-bar-inner {
          display: flex;
          border-bottom: 1px solid var(--border);
          margin-bottom: 20px;
          position: sticky;
          top: 0;
          z-index: 40;
          background: var(--bg-base);
        }
        .tab-item {
          padding: 14px 24px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-tertiary);
          font-family: var(--font-body);
          font-weight: 400;
          font-size: 13px;
          cursor: pointer;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          transition: all 0.15s ease;
        }
        .tab-item[data-active='true'] {
          border-bottom-color: var(--text-primary);
          color: var(--text-primary);
          font-weight: 600;
        }
        .tab-item:hover {
          color: var(--text-primary);
        }
      `}</style>
    </>
  );
}
