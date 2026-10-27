'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from '@/components/FolioImage';
import Link from 'next/link';
import type { DirectoryDesigner, DirectoryVendor } from '@/lib/directory/types';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ProfessionalCard from './ProfessionalCard';
import VendorCard from './VendorCard';

type Tab = 'designers' | 'architects' | 'builders' | 'vendors';
type ViewMode = 'browse' | 'ranked';
type BrowseSort = 'recent' | 'alpha' | 'projects';
type RankedView = 'overall' | 'rising';

const TABS: { id: Tab; label: string }[] = [
  { id: 'designers', label: 'Designers' },
  { id: 'architects', label: 'Architects' },
  { id: 'builders', label: 'Builders' },
  { id: 'vendors', label: 'Vendors' },
];

const BROWSE_SORTS: { value: BrowseSort; label: string }[] = [
  { value: 'recent', label: 'Recently Active' },
  { value: 'alpha', label: 'Alphabetical' },
  { value: 'projects', label: 'Most Projects' },
];

const REGIONS = [
  'New York', 'Los Angeles', 'San Francisco', 'Miami', 'Chicago',
  'Dallas', 'Seattle', 'Boston', 'Denver', 'Atlanta',
];

const STYLES = [
  'Modern', 'Traditional', 'Transitional', 'Contemporary', 'Minimalist',
  'Industrial', 'Coastal', 'Mediterranean', 'Mid-Century Modern', 'Eclectic',
];

export default function DirectoryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [activeTab, setActiveTab] = useState<Tab>(
    (searchParams.get('tab') as Tab) || 'designers'
  );
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('mode') as ViewMode) || 'browse'
  );
  const [browseSort, setBrowseSort] = useState<BrowseSort>(
    (searchParams.get('sort') as BrowseSort) || 'recent'
  );
  const [rankedView, setRankedView] = useState<RankedView>(
    (searchParams.get('view') as RankedView) || 'overall'
  );
  const [selectedRegion, setSelectedRegion] = useState(searchParams.get('region') || '');
  const [selectedStyle, setSelectedStyle] = useState(searchParams.get('style') || '');
  const [showBookmarked, setShowBookmarked] = useState(false);

  const [designers, setDesigners] = useState<DirectoryDesigner[]>([]);
  const [vendors, setVendors] = useState<DirectoryVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const isProfessionalTab = activeTab !== 'vendors';
  const isAuthenticated = authStatus === 'authenticated';

  const loadData = useCallback(async (reset: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const currentPage = reset ? 1 : page;
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', '50');

      if (viewMode === 'browse') {
        params.set('sort', browseSort);
      } else {
        params.set('sort', rankedView === 'rising' ? 'rising' : 'ranked');
      }

      if (selectedRegion) params.set('region', selectedRegion);
      if (selectedStyle) params.set('style', selectedStyle);
      if (showBookmarked) params.set('bookmarked', 'true');

      const endpoint = isProfessionalTab
        ? `/api/directory/designers?${params.toString()}`
        : `/api/directory/vendors?${params.toString()}`;

      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to load directory');

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
      if (reset) setPage(1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  }, [activeTab, viewMode, browseSort, rankedView, selectedRegion, selectedStyle, showBookmarked, page, designers, vendors, isProfessionalTab]);

  useEffect(() => {
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, viewMode, browseSort, rankedView, selectedRegion, selectedStyle, showBookmarked]);

  // Update URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    params.set('mode', viewMode);
    if (viewMode === 'browse') params.set('sort', browseSort);
    if (viewMode === 'ranked') params.set('view', rankedView);
    if (selectedRegion) params.set('region', selectedRegion);
    if (selectedStyle) params.set('style', selectedStyle);
    router.replace(`/directory?${params.toString()}`, { scroll: false });
  }, [activeTab, viewMode, browseSort, rankedView, selectedRegion, selectedStyle, router]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setPage(1);
    setSelectedRegion('');
    setSelectedStyle('');
    setShowBookmarked(false);
  };

  const handleLoadMore = () => {
    setPage(p => p + 1);
    loadData(false);
  };

  const isEmpty = isProfessionalTab ? designers.length === 0 : vendors.length === 0;
  const isInitialLoad = loading && isEmpty;

  return (
    <div className="min-h-screen bg-surface-canvas p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-surface-ground rounded-lg">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                    activeTab === tab.id
                      ? 'bg-[var(--bg-card)] text-folio-text-primary shadow-sm'
                      : 'text-folio-text-secondary hover:text-folio-text-primary'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-1 p-1 bg-surface-ground rounded-lg">
              <button
                onClick={() => setViewMode('browse')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  viewMode === 'browse'
                    ? 'bg-[var(--bg-card)] text-folio-text-primary shadow-sm'
                    : 'text-folio-text-secondary hover:text-folio-text-primary'
                )}
              >
                Browse
              </button>
              <button
                onClick={() => setViewMode('ranked')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  viewMode === 'ranked'
                    ? 'bg-[var(--bg-card)] text-folio-text-primary shadow-sm'
                    : 'text-folio-text-secondary hover:text-folio-text-primary'
                )}
              >
                Ranked
              </button>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            {viewMode === 'browse' ? (
              <>
                <select
                  value={browseSort}
                  onChange={(e) => { setBrowseSort(e.target.value as BrowseSort); setPage(1); }}
                  className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg text-folio-text-primary"
                >
                  {BROWSE_SORTS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <select
                  value={selectedRegion}
                  onChange={(e) => { setSelectedRegion(e.target.value); setPage(1); }}
                  className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg text-folio-text-primary"
                >
                  <option value="">All Locations</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                {isProfessionalTab && (
                  <select
                    value={selectedStyle}
                    onChange={(e) => { setSelectedStyle(e.target.value); setPage(1); }}
                    className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg text-folio-text-primary"
                  >
                    <option value="">All Styles</option>
                    {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}

                {isAuthenticated && (
                  <button
                    onClick={() => { setShowBookmarked(!showBookmarked); setPage(1); }}
                    className={cn(
                      'px-3 py-2 text-sm rounded-lg border transition-colors',
                      showBookmarked
                        ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]'
                        : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-folio-text-secondary'
                    )}
                  >
                    Bookmarked
                  </button>
                )}
              </>
            ) : (
              <select
                value={rankedView}
                onChange={(e) => { setRankedView(e.target.value as RankedView); setPage(1); }}
                className="px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg text-folio-text-primary"
              >
                <option value="overall">Overall</option>
                <option value="rising">Rising</option>
              </select>
            )}
          </div>

          {/* Title */}
          <div className="mt-4">
            <h1 className="folio-h1 text-folio-text-primary mb-1">
              {viewMode === 'browse' ? 'Directory' : rankedView === 'rising' ? 'Rising This Week' : 'Folio Top 100'}
            </h1>
            <p className="folio-body text-folio-text-secondary">
              {viewMode === 'browse'
                ? 'Discover design professionals on Folio.'
                : `The most ${activeTab === 'vendors' ? 'specified vendors' : 'influential professionals'} on Folio, ranked by quality and engagement.`}
            </p>
          </div>
        </div>

        {/* Content */}
        {isInitialLoad ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
              <p className="mt-4 folio-body text-folio-text-secondary">Loading directory...</p>
            </div>
          </div>
        ) : error && isEmpty ? (
          <DirectoryEmptyState tab={activeTab} />
        ) : isEmpty ? (
          <DirectoryEmptyState tab={activeTab} />
        ) : viewMode === 'browse' ? (
          <>
            {/* Card Grid */}
            {isProfessionalTab ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {designers.map(designer => (
                  <ProfessionalCard
                    key={designer.user.id}
                    designer={designer}
                    isAuthenticated={isAuthenticated}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {vendors.map(vendor => (
                  <VendorCard key={vendor.organization.id} vendor={vendor} />
                ))}
              </div>
            )}

            {hasMore && (
              <div className="mt-8 text-center">
                <Button variant="ridge" onClick={handleLoadMore} disabled={loading}>
                  {loading ? 'Loading...' : 'Load More'}
                </Button>
                <p className="mt-2 text-sm text-folio-text-tertiary">
                  Showing {isProfessionalTab ? designers.length : vendors.length} of {total}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Ranked List (existing layout) */}
            {isProfessionalTab && (
              <div className="space-y-3">
                {designers.map(designer => (
                  <DesignerRow key={designer.user.id} designer={designer} />
                ))}
              </div>
            )}

            {!isProfessionalTab && (
              <div className="space-y-3">
                {vendors.map(vendor => (
                  <VendorRow key={vendor.organization.id} vendor={vendor} />
                ))}
              </div>
            )}

            {hasMore && (
              <div className="mt-8 text-center">
                <Button variant="ridge" onClick={handleLoadMore} disabled={loading}>
                  {loading ? 'Loading...' : 'Load More'}
                </Button>
                <p className="mt-2 text-sm text-folio-text-tertiary">
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

function DirectoryEmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center max-w-md">
        <h2 className="folio-h1 text-folio-text-primary mb-6">
          {tab === 'vendors' ? 'No vendors yet.' : '#1 is open.'}
        </h2>
        <p className="folio-body text-folio-text-secondary mb-8 leading-relaxed">
          {tab === 'vendors'
            ? 'The Folio Directory launches with our first founding vendor partners. Check back soon.'
            : 'The Folio Directory launches with our first founding members. Early entrants start at the top while the field is wide open.'}
        </p>
        <Link href="/signup">
          <Button variant="accent" size="lg" className="px-8">
            Get Started
          </Button>
        </Link>
      </div>
    </div>
  );
}

function RankChange({ change }: { change: number }) {
  if (change === 0) return <span className="text-xs text-folio-text-tertiary">&mdash;</span>;
  if (change > 0) return <span className="text-xs text-green-600">+{change}</span>;
  return <span className="text-xs text-red-500">{change}</span>;
}

function DesignerRow({ designer }: { designer: DirectoryDesigner }) {
  return (
    <RidgeCard padding="lg">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-16 text-center">
          <div className="text-2xl font-semibold text-folio-text-primary">{designer.rank}</div>
          <RankChange change={designer.rankChange} />
        </div>

        <Link href={`/profile/${designer.user.id}`} className="flex-shrink-0">
          {designer.user.profileImage ? (
            <Image
              src={designer.user.profileImage}
              alt={designer.user.name}
              width={64}
              height={64}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-surface-ground flex items-center justify-center">
              <span className="text-xl font-medium text-folio-text-secondary">
                {designer.user.name.charAt(0)}
              </span>
            </div>
          )}
        </Link>

        <div className="flex-grow min-w-0">
          <Link href={`/profile/${designer.user.id}`}>
            <h3 className="text-lg font-semibold text-folio-text-primary hover:text-[var(--accent)] truncate">
              {designer.user.name}
            </h3>
          </Link>
          {designer.user.location && (
            <p className="text-sm text-folio-text-secondary">{designer.user.location}</p>
          )}
          {designer.user.bio && (
            <p className="text-sm text-folio-text-tertiary line-clamp-1 mt-1">
              &ldquo;{designer.user.bio}&rdquo;
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-folio-text-tertiary">
            <span>{designer.stats.totalSaves} saves</span>
            <span>{designer.stats.followerCount.toLocaleString()} followers</span>
            <span>{designer.stats.projectCount} projects</span>
          </div>
        </div>

        {designer.featuredProject && (
          <Link href={`/projects/${designer.featuredProject.id}`} className="flex-shrink-0 hidden md:block">
            <div className="w-32 h-20 rounded-lg overflow-hidden bg-surface-ground">
              {designer.featuredProject.heroImage ? (
                <Image
                  src={designer.featuredProject.heroImage}
                  alt={designer.featuredProject.title}
                  width={128}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-folio-text-tertiary">
                  No image
                </div>
              )}
            </div>
          </Link>
        )}
      </div>
    </RidgeCard>
  );
}

function VendorRow({ vendor }: { vendor: DirectoryVendor }) {
  return (
    <RidgeCard padding="lg">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-16 text-center">
          <div className="text-2xl font-semibold text-folio-text-primary">{vendor.rank}</div>
          <RankChange change={vendor.rankChange} />
        </div>

        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-surface-ground flex items-center justify-center">
          {vendor.organization.logo ? (
            <Image
              src={vendor.organization.logo}
              alt={vendor.organization.name}
              width={64}
              height={64}
              className="object-contain"
            />
          ) : (
            <span className="text-xl font-medium text-folio-text-secondary">
              {vendor.organization.name.charAt(0)}
            </span>
          )}
        </div>

        <div className="flex-grow min-w-0">
          <h3 className="text-lg font-semibold text-folio-text-primary truncate">
            {vendor.organization.name}
          </h3>
          <p className="text-sm text-folio-text-secondary capitalize">
            {vendor.organization.type.replace(/_/g, ' ').toLowerCase()}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-folio-text-tertiary">
            <span>{vendor.stats.designersTagging} designers</span>
            <span>{vendor.stats.projectsIncluded} projects</span>
            <span>{vendor.stats.catalogSize} products</span>
          </div>
        </div>
      </div>
    </RidgeCard>
  );
}
