'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import type { DirectoryDesigner, DirectoryVendor } from '@/lib/directory/types';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Tab = 'designers' | 'architects' | 'builders' | 'vendors';
type ViewMode = 'overall' | 'rising' | 'region' | 'style';

const TABS: { id: Tab; label: string }[] = [
  { id: 'designers', label: 'Designers' },
  { id: 'architects', label: 'Architects' },
  { id: 'builders', label: 'Builders' },
  { id: 'vendors', label: 'Vendors' },
];

const TAB_SUBTITLES: Record<Tab, string> = {
  designers: 'The most influential designers on Folio, ranked by quality and engagement.',
  architects: 'The most influential architects on Folio, ranked by quality and engagement.',
  builders: 'The most influential builders on Folio, ranked by quality and engagement.',
  vendors: 'The most specified vendors on Folio, ranked by designer engagement.',
};

const VIEW_OPTIONS = [
  { value: 'overall', label: 'Overall' },
  { value: 'rising', label: 'Rising' },
  { value: 'region', label: 'By Region' },
  { value: 'style', label: 'By Style' },
];

const REGIONS = [
  'New York',
  'Los Angeles',
  'San Francisco',
  'Miami',
  'Chicago',
  'Dallas',
  'Seattle',
  'Boston',
  'Denver',
  'Atlanta',
];

const STYLES = [
  'Modern',
  'Traditional',
  'Transitional',
  'Contemporary',
  'Minimalist',
  'Industrial',
  'Coastal',
  'Mediterranean',
  'Mid-Century Modern',
  'Eclectic',
];

export default function DirectoryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [activeTab, setActiveTab] = useState<Tab>(
    (searchParams.get('tab') as Tab) || 'designers'
  );
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) || 'overall'
  );
  const [selectedRegion, setSelectedRegion] = useState<string>(
    searchParams.get('region') || ''
  );
  const [selectedStyle, setSelectedStyle] = useState<string>(
    searchParams.get('style') || ''
  );
  const [designers, setDesigners] = useState<DirectoryDesigner[]>([]);
  const [vendors, setVendors] = useState<DirectoryVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Determine if current tab is for professionals (designers/architects/builders)
  const isProfessionalTab = activeTab !== 'vendors';

  // Load data
  const loadData = useCallback(async (reset: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const currentPage = reset ? 1 : page;

      // Build query params
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', '50');
      params.set('view', viewMode === 'region' || viewMode === 'style' ? 'overall' : viewMode);

      if (viewMode === 'region' && selectedRegion) {
        params.set('region', selectedRegion);
      }
      if (viewMode === 'style' && selectedStyle) {
        params.set('style', selectedStyle);
      }

      // For architects and builders, we use the designers endpoint with a role filter
      // The API needs to support this - for now, all professional roles use designers endpoint
      const endpoint = isProfessionalTab
        ? `/api/directory/designers?${params.toString()}`
        : `/api/directory/vendors?${params.toString()}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error('Failed to load directory');
      }

      const data = await response.json();

      if (isProfessionalTab) {
        setDesigners(reset ? data.items : [...designers, ...data.items]);
        setVendors([]);
      } else {
        setVendors(reset ? data.items : [...vendors, ...data.items]);
        setDesigners([]);
      }

      setHasMore(data.pagination.hasMore);
      setTotal(data.pagination.total);
      setLastUpdated(new Date(data.lastUpdated));

      if (reset) setPage(1);
    } catch (err: unknown) {
      console.error('Error loading directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  }, [activeTab, viewMode, selectedRegion, selectedStyle, page, designers, vendors, isProfessionalTab]);

  // Load data on mount and when filters change
  useEffect(() => {
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, viewMode, selectedRegion, selectedStyle]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    params.set('view', viewMode);
    if (viewMode === 'region' && selectedRegion) {
      params.set('region', selectedRegion);
    }
    if (viewMode === 'style' && selectedStyle) {
      params.set('style', selectedStyle);
    }
    router.replace(`/directory?${params.toString()}`, { scroll: false });
  }, [activeTab, viewMode, selectedRegion, selectedStyle, router]);

  const handleLoadMore = () => {
    setPage((p) => p + 1);
    loadData(false);
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setPage(1);
    // Reset secondary filters when changing tabs
    setSelectedRegion('');
    setSelectedStyle('');
  };

  const handleViewChange = (view: ViewMode) => {
    setViewMode(view);
    setPage(1);
    // Reset secondary filters when changing view mode
    if (view !== 'region') setSelectedRegion('');
    if (view !== 'style') setSelectedStyle('');
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    const diff = Date.now() - lastUpdated.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return lastUpdated.toLocaleDateString();
  };

  // Determine CTA link based on auth status
  const getCtaLink = () => {
    if (authStatus === 'unauthenticated') {
      return '/signup';
    }
    // Check if user is Pro (simplified check - you may need to fetch this)
    const isPro = session?.user?.subscriptionTier === 'PRO' || session?.user?.subscriptionTier === 'ENTERPRISE';
    if (!isPro) {
      return '/settings/subscription';
    }
    return '/projects/new';
  };

  const getCtaText = () => {
    if (authStatus === 'unauthenticated') {
      return 'Get Started';
    }
    const isPro = session?.user?.subscriptionTier === 'PRO' || session?.user?.subscriptionTier === 'ENTERPRISE';
    if (!isPro) {
      return 'Upgrade to Pro';
    }
    return 'Publish Your First Project';
  };

  // Check if data is empty (no results)
  const isEmpty = isProfessionalTab ? designers.length === 0 : vendors.length === 0;
  const isInitialLoad = loading && isEmpty;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-[var(--bg-elevated)] rounded-lg">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                    activeTab === tab.id
                      ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-2">
              <select
                value={viewMode}
                onChange={(e) => handleViewChange(e.target.value as ViewMode)}
                className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)]"
              >
                {VIEW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* Secondary filter for region */}
              {viewMode === 'region' && (
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)]"
                >
                  <option value="">All Regions</option>
                  {REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              )}

              {/* Secondary filter for style */}
              {viewMode === 'style' && (
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)]"
                >
                  <option value="">All Styles</option>
                  {STYLES.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="folio-h1 text-[var(--text-primary)] mb-1">
                {viewMode === 'rising' ? 'Rising This Week' : 'Folio Top 100'}
              </h1>
              <p className="folio-body text-[var(--text-secondary)]">
                {TAB_SUBTITLES[activeTab]}
              </p>
            </div>
            {lastUpdated && !isEmpty && (
              <span className="text-xs text-[var(--text-tertiary)]">
                Last updated: {formatLastUpdated()}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
              <p className="mt-4 folio-body text-[var(--text-secondary)]">
                Loading directory...
              </p>
            </div>
          </div>
        ) : error && isEmpty ? (
          // Error state - but make it less alarming if it's just empty data
          <DirectoryEmptyState
            tab={activeTab}
            ctaLink={getCtaLink()}
            ctaText={getCtaText()}
          />
        ) : isEmpty ? (
          // Empty state - invitation to participate
          <DirectoryEmptyState
            tab={activeTab}
            ctaLink={getCtaLink()}
            ctaText={getCtaText()}
          />
        ) : (
          <>
            {/* Professional List (Designers, Architects, Builders) */}
            {isProfessionalTab && (
              <div className="space-y-3">
                {designers.map((designer, index) => (
                  <DesignerRow key={designer.user.id} designer={designer} index={index} />
                ))}
              </div>
            )}

            {/* Vendors List */}
            {!isProfessionalTab && (
              <div className="space-y-3">
                {vendors.map((vendor, index) => (
                  <VendorRow key={vendor.organization.id} vendor={vendor} index={index} />
                ))}
              </div>
            )}

            {/* Load More */}
            {hasMore && (
              <div className="mt-8 text-center">
                <Button
                  variant="ridge"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Load More'}
                </Button>
                <p className="mt-2 text-sm text-[var(--text-tertiary)]">
                  Showing {isProfessionalTab ? designers.length : vendors.length} of {total}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Empty state component for when a directory category has no ranked members
 */
function DirectoryEmptyState({
  tab,
  ctaLink,
  ctaText,
}: {
  tab: Tab;
  ctaLink: string;
  ctaText: string;
}) {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center max-w-md">
        <h2 className="folio-h1 text-[var(--text-primary)] mb-6">
          #1 is open.
        </h2>
        <p className="folio-body text-[var(--text-secondary)] mb-8 leading-relaxed">
          The Folio Directory launches with our first founding members.
          Early entrants start at the top while the field is wide open.
        </p>
        <Link href={ctaLink}>
          <Button variant="accent" size="lg" className="px-8">
            {ctaText}
          </Button>
        </Link>
      </div>
    </div>
  );
}

function DesignerRow({ designer, index }: { designer: DirectoryDesigner; index: number }) {
  return (
    <RidgeCard padding="lg">
      <div className="flex items-center gap-4">
        {/* Rank */}
        <div className="flex-shrink-0 w-16 text-center">
          <div className="text-2xl font-semibold text-[var(--text-primary)]">
            {designer.rank}
          </div>
          <RankChange change={designer.rankChange} />
        </div>

        {/* Avatar */}
        <Link href={`/profiles/${designer.user.id}`} className="flex-shrink-0">
          {designer.user.profileImage ? (
            <Image
              src={designer.user.profileImage}
              alt={designer.user.name}
              width={64}
              height={64}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
              <span className="text-xl font-medium text-[var(--text-secondary)]">
                {designer.user.name.charAt(0)}
              </span>
            </div>
          )}
        </Link>

        {/* Info */}
        <div className="flex-grow min-w-0">
          <Link href={`/profiles/${designer.user.id}`}>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] truncate">
              {designer.user.name}
            </h3>
          </Link>
          {designer.user.location && (
            <p className="text-sm text-[var(--text-secondary)]">
              {designer.user.location}
            </p>
          )}
          {designer.user.bio && (
            <p className="text-sm text-[var(--text-tertiary)] line-clamp-1 mt-1">
              &ldquo;{designer.user.bio}&rdquo;
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-tertiary)]">
            <span>{designer.stats.totalSaves} saves</span>
            <span>{designer.stats.followerCount.toLocaleString()} followers</span>
            <span>{designer.stats.projectCount} projects</span>
          </div>
        </div>

        {/* Featured Project */}
        {designer.featuredProject && (
          <Link
            href={`/projects/${designer.featuredProject.id}`}
            className="flex-shrink-0 hidden md:block"
          >
            <div className="w-32 h-20 rounded-lg overflow-hidden bg-[var(--bg-elevated)]">
              {designer.featuredProject.heroImage ? (
                <Image
                  src={designer.featuredProject.heroImage}
                  alt={designer.featuredProject.title}
                  width={128}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {designer.featuredProject.title}
                  </span>
                </div>
              )}
            </div>
          </Link>
        )}
      </div>
    </RidgeCard>
  );
}

function VendorRow({ vendor, index }: { vendor: DirectoryVendor; index: number }) {
  return (
    <RidgeCard padding="lg">
      <div className="flex items-center gap-4">
        {/* Rank */}
        <div className="flex-shrink-0 w-16 text-center">
          <div className="text-2xl font-semibold text-[var(--text-primary)]">
            {vendor.rank}
          </div>
          <RankChange change={vendor.rankChange} />
        </div>

        {/* Logo */}
        <Link href={`/org/${vendor.organization.id}`} className="flex-shrink-0">
          {vendor.organization.logo ? (
            <Image
              src={vendor.organization.logo}
              alt={vendor.organization.name}
              width={64}
              height={64}
              className="rounded-lg object-contain bg-white p-2"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center">
              <span className="text-xl font-medium text-[var(--text-secondary)]">
                {vendor.organization.name.charAt(0)}
              </span>
            </div>
          )}
        </Link>

        {/* Info */}
        <div className="flex-grow min-w-0">
          <Link href={`/org/${vendor.organization.id}`}>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] truncate">
              {vendor.organization.name}
            </h3>
          </Link>
          <p className="text-sm text-[var(--text-secondary)] capitalize">
            {vendor.organization.type.toLowerCase().replace('_', ' ')}
          </p>
          {vendor.organization.description && (
            <p className="text-sm text-[var(--text-tertiary)] line-clamp-1 mt-1">
              {vendor.organization.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-tertiary)]">
            <span>{vendor.stats.designersTagging} designers</span>
            <span>{vendor.stats.projectsIncluded} projects</span>
            <span>{vendor.stats.catalogSize} products</span>
          </div>
        </div>
      </div>
    </RidgeCard>
  );
}

function RankChange({ change }: { change: number }) {
  if (change === 0) {
    return (
      <span className="text-xs text-[var(--text-tertiary)]">
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        'text-xs font-medium',
        change > 0 ? 'text-green-600' : 'text-red-500'
      )}
    >
      {change > 0 ? `▲${change}` : `▼${Math.abs(change)}`}
    </span>
  );
}
