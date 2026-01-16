'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { DirectoryDesigner, DirectoryVendor } from '@/lib/directory/types';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Tab = 'designers' | 'vendors';
type ViewMode = 'overall' | 'rising';

export default function DirectoryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>(
    (searchParams.get('tab') as Tab) || 'designers'
  );
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) || 'overall'
  );
  const [designers, setDesigners] = useState<DirectoryDesigner[]>([]);
  const [vendors, setVendors] = useState<DirectoryVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load data
  const loadData = useCallback(async (reset: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const currentPage = reset ? 1 : page;
      const endpoint =
        activeTab === 'designers'
          ? `/api/directory/designers?page=${currentPage}&limit=50&view=${viewMode}`
          : `/api/directory/vendors?page=${currentPage}&limit=50&view=${viewMode}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error('Failed to load directory');
      }

      const data = await response.json();

      if (activeTab === 'designers') {
        setDesigners(reset ? data.items : [...designers, ...data.items]);
      } else {
        setVendors(reset ? data.items : [...vendors, ...data.items]);
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
  }, [activeTab, viewMode, page, designers, vendors]);

  // Load data on mount and when tab/view changes
  useEffect(() => {
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, viewMode]);

  // Update URL when tab/view changes
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    params.set('view', viewMode);
    router.replace(`/directory?${params.toString()}`, { scroll: false });
  }, [activeTab, viewMode, router]);

  const handleLoadMore = () => {
    setPage((p) => p + 1);
    loadData(false);
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleViewChange = (view: ViewMode) => {
    setViewMode(view);
    setPage(1);
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

  return (
    <div className="min-h-screen bg-[var(--bg-base)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-[var(--bg-elevated)] rounded-lg">
              <button
                onClick={() => handleTabChange('designers')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  activeTab === 'designers'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                Designers
              </button>
              <button
                onClick={() => handleTabChange('vendors')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  activeTab === 'vendors'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                Vendors
              </button>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-4">
              <select
                value={viewMode}
                onChange={(e) => handleViewChange(e.target.value as ViewMode)}
                className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)]"
              >
                <option value="overall">Overall</option>
                <option value="rising">Rising</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="folio-h1 text-[var(--text-primary)] mb-1">
                {viewMode === 'rising' ? 'Rising This Week' : 'Folio Top 100'}
              </h1>
              <p className="folio-body text-[var(--text-secondary)]">
                {activeTab === 'designers'
                  ? 'The most influential designers on Folio, ranked by quality and engagement.'
                  : 'Top vendors trusted by designers, ranked by designer engagement.'}
              </p>
            </div>
            {lastUpdated && (
              <span className="text-xs text-[var(--text-tertiary)]">
                Last updated: {formatLastUpdated()}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        {loading && (designers.length === 0 && vendors.length === 0) ? (
          <RidgeCard padding="xl" className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
            <p className="mt-4 folio-body text-[var(--text-secondary)]">
              Loading directory...
            </p>
          </RidgeCard>
        ) : error ? (
          <RidgeCard padding="xl" className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="ridge" onClick={() => loadData(true)}>
              Retry
            </Button>
          </RidgeCard>
        ) : activeTab === 'designers' && designers.length === 0 ? (
          <RidgeCard padding="xl" className="text-center">
            <p className="folio-body text-[var(--text-secondary)]">
              {viewMode === 'rising'
                ? 'No rising designers this week.'
                : 'No designers ranked yet.'}
            </p>
          </RidgeCard>
        ) : activeTab === 'vendors' && vendors.length === 0 ? (
          <RidgeCard padding="xl" className="text-center">
            <p className="folio-body text-[var(--text-secondary)]">
              {viewMode === 'rising'
                ? 'No rising vendors this week.'
                : 'No vendors ranked yet.'}
            </p>
          </RidgeCard>
        ) : (
          <>
            {/* Designers List */}
            {activeTab === 'designers' && (
              <div className="space-y-3">
                {designers.map((designer, index) => (
                  <DesignerRow key={designer.user.id} designer={designer} index={index} />
                ))}
              </div>
            )}

            {/* Vendors List */}
            {activeTab === 'vendors' && (
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
                  Showing {activeTab === 'designers' ? designers.length : vendors.length} of {total}
                </p>
              </div>
            )}
          </>
        )}
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
