'use client';

import { useState, useEffect, useCallback } from 'react';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import SourcebookCard from './SourcebookCard';
import NotesModal from './NotesModal';
import UseInProjectModal from './UseInProjectModal';
import RequestSampleModal from './RequestSampleModal';
import RequestQuoteModal from './RequestQuoteModal';
import ContactRepModal from './ContactRepModal';
import RepResolverModal from './RepResolverModal';
import type {
  SourcebookEntry,
  SourcebookSortField,
  SortDirection,
  SourcebookFilters,
  SourcebookStats,
} from '@/types/sourcebook';

export default function SourcebookPage() {
  const [entries, setEntries] = useState<SourcebookEntry[]>([]);
  const [stats, setStats] = useState<SourcebookStats>({
    totalProducts: 0,
    totalVendors: 0,
    totalProjects: 0,
    archivedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<SourcebookFilters>({});
  const [sortField, setSortField] = useState<SourcebookSortField>('lastUsedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [notesModal, setNotesModal] = useState<SourcebookEntry | null>(null);
  const [useInProjectModal, setUseInProjectModal] = useState<SourcebookEntry | null>(null);
  const [sampleModal, setSampleModal] = useState<SourcebookEntry | null>(null);
  const [quoteModal, setQuoteModal] = useState<SourcebookEntry | null>(null);
  const [contactModal, setContactModal] = useState<SourcebookEntry | null>(null);
  const [resolverModal, setResolverModal] = useState<SourcebookEntry | null>(null);
  const [resolverActionType, setResolverActionType] = useState<'SAMPLE_REQUEST' | 'QUOTE_REQUEST' | 'GENERAL'>('GENERAL');
  const [selectedRepUserId, setSelectedRepUserId] = useState<string | undefined>();

  const handleNeedResolution = (entry: SourcebookEntry, actionType: 'SAMPLE_REQUEST' | 'QUOTE_REQUEST' | 'GENERAL') => {
    setResolverActionType(actionType);
    setResolverModal(entry);
  };

  const handleRepSelected = (repUserId: string) => {
    setSelectedRepUserId(repUserId);
    // Re-open the original action modal with the selected rep
    if (resolverModal) {
      if (resolverActionType === 'SAMPLE_REQUEST') setSampleModal(resolverModal);
      else if (resolverActionType === 'QUOTE_REQUEST') setQuoteModal(resolverModal);
      else setContactModal(resolverModal);
    }
    setResolverModal(null);
  };

  const handleInviteRep = async (repName: string, repEmail: string, sendInvite: boolean) => {
    if (!resolverModal) return;
    await fetch('/api/designer/sourcebook/invite-rep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: resolverModal.productId,
        actionType: resolverActionType,
        repName,
        repEmail,
        sendInvite,
      }),
    });
  };

  const handleSendViaFolio = async (recipientName: string, recipientEmail: string) => {
    if (!resolverModal) return;

    // Build payload based on the current action type and modal data
    const payload: Record<string, unknown> = {
      type: resolverActionType,
      productId: resolverModal.productId,
      productName: resolverModal.productName,
      vendorName: resolverModal.productBrand || '',
    };

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: resolverActionType,
          productId: resolverModal.productId,
          recipientEmail,
          recipientName,
          payload,
        }),
      });

      const data = await res.json();
      if (res.ok && data.conversationId) {
        setResolverModal(null);
        window.location.href = `/inbox/${data.conversationId}`;
      }
    } catch {
      // Silently fail — user can retry
    }
  };

  const handleRequestSent = (conversationId: string) => {
    setSelectedRepUserId(undefined);
    // Could show a toast or navigate to inbox
    window.location.href = `/inbox/${conversationId}`;
  };

  const loadSourcebook = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.vendor) params.append('vendor', filters.vendor);
      if (filters.project) params.append('project', filters.project);
      if (filters.room) params.append('room', filters.room);
      if (filters.category) params.append('category', filters.category);
      if (searchTerm) params.append('search', searchTerm);
      if (showArchived) params.append('archived', 'true');

      const response = await fetch(`/api/designer/sourcebook?${params.toString()}`);

      if (!response.ok) throw new Error('Failed to load sourcebook');

      const data = await response.json();

      const entriesWithDates = data.entries.map((entry: SourcebookEntry) => ({
        ...entry,
        lastUsedAt: new Date(entry.lastUsedAt),
      }));

      setEntries(entriesWithDates);
      setStats(data.stats || stats);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load sourcebook';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters, searchTerm, showArchived]);

  useEffect(() => {
    loadSourcebook();
  }, [loadSourcebook]);

  // Sort entries client-side
  const sortedEntries = [...entries].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortField) {
      case 'productName':
        aValue = a.productName.toLowerCase();
        bValue = b.productName.toLowerCase();
        break;
      case 'productBrand':
        aValue = (a.productBrand || '').toLowerCase();
        bValue = (b.productBrand || '').toLowerCase();
        break;
      case 'category':
        aValue = (a.productCategory || '').toLowerCase();
        bValue = (b.productCategory || '').toLowerCase();
        break;
      case 'lastUsedAt':
        aValue = new Date(a.lastUsedAt).getTime();
        bValue = new Date(b.lastUsedAt).getTime();
        break;
      case 'tagCount':
        aValue = a.tagCount;
        bValue = b.tagCount;
        break;
      case 'projectCount':
        aValue = a.projects.length;
        bValue = b.projects.length;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SourcebookSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleFilterChange = (key: keyof SourcebookFilters, value: string) => {
    const newFilters = { ...filters };
    if (value === '') {
      delete newFilters[key];
    } else {
      (newFilters as Record<string, string>)[key] = value;
    }
    setFilters(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setShowArchived(false);
  };

  const handleSaveNotes = async (productId: string, notes: string | null) => {
    const res = await fetch('/api/designer/sourcebook/notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, notes }),
    });
    if (res.ok) {
      // Update local state optimistically
      setEntries(prev =>
        prev.map(e =>
          e.productId === productId ? { ...e, notes } : e
        )
      );
    }
  };

  const handleArchive = async (productId: string, archived: boolean) => {
    const res = await fetch('/api/designer/sourcebook/archive', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, archived }),
    });
    if (res.ok) {
      // Remove from current view if archiving (unless viewing archived)
      if (archived && !showArchived) {
        setEntries(prev => prev.filter(e => e.productId !== productId));
      } else {
        setEntries(prev =>
          prev.map(e =>
            e.productId === productId ? { ...e, archived } : e
          )
        );
      }
      // Refresh stats
      loadSourcebook();
    }
  };

  // Extract unique values for filter dropdowns
  const uniqueVendors = Array.from(new Set(
    entries.map(e => e.productBrand).filter(Boolean)
  )).sort() as string[];

  const uniqueProjects = entries
    .flatMap(e => e.projects)
    .reduce((acc, p) => {
      if (!acc.find(x => x.projectId === p.projectId)) acc.push(p);
      return acc;
    }, [] as Array<{ projectId: string; projectTitle: string; roomName: string | null }>)
    .sort((a, b) => a.projectTitle.localeCompare(b.projectTitle));

  const uniqueCategories = Array.from(new Set(
    entries.map(e => e.productCategory).filter(Boolean)
  )).sort() as string[];

  const hasActiveFilters = Object.keys(filters).length > 0 || searchTerm.length > 0 || showArchived;

  const SORT_OPTIONS: { value: SourcebookSortField; label: string }[] = [
    { value: 'lastUsedAt', label: 'Recently Used' },
    { value: 'projectCount', label: 'Most Used' },
    { value: 'productBrand', label: 'Vendor A\u2013Z' },
    { value: 'productName', label: 'Product A\u2013Z' },
    { value: 'tagCount', label: 'Tag Count' },
  ];

  return (
    <div className="min-h-screen bg-surface-canvas p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="folio-h1 text-folio-text-primary mb-3">Sourcebook</h1>
          <p className="folio-body text-folio-text-secondary">
            Your product specification catalog — every product you&apos;ve tagged across all projects.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass-surface rounded-xl p-4">
            <div className="text-folio-text-tertiary text-sm mb-1 font-medium">Products</div>
            <div className="text-2xl font-semibold text-folio-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
              {stats.totalProducts}
            </div>
          </div>
          <div className="glass-surface rounded-xl p-4">
            <div className="text-folio-text-tertiary text-sm mb-1 font-medium">Vendors</div>
            <div className="text-2xl font-semibold text-folio-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
              {stats.totalVendors}
            </div>
          </div>
          <div className="glass-surface rounded-xl p-4">
            <div className="text-folio-text-tertiary text-sm mb-1 font-medium">Projects</div>
            <div className="text-2xl font-semibold text-folio-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
              {stats.totalProjects}
            </div>
          </div>
          <div className="glass-surface rounded-xl p-4">
            <div className="text-folio-text-tertiary text-sm mb-1 font-medium">Archived</div>
            <div className="text-2xl font-semibold text-folio-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
              {stats.archivedCount}
            </div>
          </div>
        </div>

        {/* Search + Sort Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-grow relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadSourcebook(); }}
              placeholder="Search products, vendors, projects..."
              className="w-full px-4 py-2.5 pl-10 bg-white border border-folio-border-subtle rounded-lg text-folio-text-primary placeholder-[#A39E97] focus:outline-none focus:border-folio-border-strong focus:shadow-[0_0_0_3px_rgba(0,0,0,0.03)] transition-all"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-folio-text-tertiary"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <select
            value={sortField}
            onChange={(e) => handleSort(e.target.value as SourcebookSortField)}
            className="px-3 py-2.5 bg-white border border-folio-border-subtle rounded-lg text-sm text-folio-text-primary focus:outline-none focus:border-folio-border-strong transition-all"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Filters */}
        <div className="glass-surface rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="text-sm text-folio-text-secondary hover:text-folio-text-primary transition-colors font-medium"
              >
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              <label className="flex items-center gap-2 text-sm text-folio-text-secondary">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                Show Archived
              </label>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-folio-text-tertiary hover:text-folio-text-secondary transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">Vendor</label>
                <select
                  value={filters.vendor || ''}
                  onChange={(e) => handleFilterChange('vendor', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-folio-border-subtle rounded-lg text-folio-text-primary focus:outline-none focus:border-folio-border-strong transition-all"
                >
                  <option value="">All Vendors</option>
                  {uniqueVendors.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">Project</label>
                <select
                  value={filters.project || ''}
                  onChange={(e) => handleFilterChange('project', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-folio-border-subtle rounded-lg text-folio-text-primary focus:outline-none focus:border-folio-border-strong transition-all"
                >
                  <option value="">All Projects</option>
                  {uniqueProjects.map(p => (
                    <option key={p.projectId} value={p.projectId}>{p.projectTitle}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">Category</label>
                <select
                  value={filters.category || ''}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-folio-border-subtle rounded-lg text-folio-text-primary focus:outline-none focus:border-folio-border-strong transition-all"
                >
                  <option value="">All Categories</option>
                  {uniqueCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Entry List */}
        {loading ? (
          <RidgeCard padding="xl" className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
            <p className="mt-4 folio-body text-folio-text-secondary">Loading sourcebook...</p>
          </RidgeCard>
        ) : error ? (
          <RidgeCard padding="xl" className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="ridge" onClick={loadSourcebook}>Retry</Button>
          </RidgeCard>
        ) : sortedEntries.length === 0 ? (
          <RidgeCard padding="xl" className="text-center">
            <p className="folio-body text-folio-text-secondary mb-4">
              {hasActiveFilters
                ? 'No products found matching your filters.'
                : "You haven\u2019t tagged any products yet."}
            </p>
            {!hasActiveFilters && (
              <a href="/designer">
                <Button variant="accent">Start Tagging Products</Button>
              </a>
            )}
          </RidgeCard>
        ) : (
          <div className="space-y-3">
            {sortedEntries.map(entry => (
              <SourcebookCard
                key={entry.productId}
                entry={entry}
                onEditNotes={setNotesModal}
                onArchive={handleArchive}
                onUseInProject={setUseInProjectModal}
                onRequestSample={setSampleModal}
                onRequestQuote={setQuoteModal}
                onContactRep={setContactModal}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <NotesModal
        isOpen={!!notesModal}
        onClose={() => setNotesModal(null)}
        productName={notesModal?.productName || ''}
        productId={notesModal?.productId || ''}
        initialNotes={notesModal?.notes || null}
        onSave={handleSaveNotes}
      />

      <UseInProjectModal
        isOpen={!!useInProjectModal}
        onClose={() => setUseInProjectModal(null)}
        productName={useInProjectModal?.productName || ''}
        productBrand={useInProjectModal?.productBrand || null}
        currentProjectIds={useInProjectModal?.projects.map(p => p.projectId) || []}
      />

      <RequestSampleModal
        isOpen={!!sampleModal}
        onClose={() => { setSampleModal(null); setSelectedRepUserId(undefined); }}
        productId={sampleModal?.productId || ''}
        productName={sampleModal?.productName || ''}
        vendorName={sampleModal?.productBrand || ''}
        recipientUserId={selectedRepUserId}
        onSent={handleRequestSent}
        onNeedResolution={() => sampleModal && handleNeedResolution(sampleModal, 'SAMPLE_REQUEST')}
      />

      <RequestQuoteModal
        isOpen={!!quoteModal}
        onClose={() => { setQuoteModal(null); setSelectedRepUserId(undefined); }}
        productId={quoteModal?.productId || ''}
        productName={quoteModal?.productName || ''}
        vendorName={quoteModal?.productBrand || ''}
        recipientUserId={selectedRepUserId}
        onSent={handleRequestSent}
        onNeedResolution={() => quoteModal && handleNeedResolution(quoteModal, 'QUOTE_REQUEST')}
      />

      <ContactRepModal
        isOpen={!!contactModal}
        onClose={() => { setContactModal(null); setSelectedRepUserId(undefined); }}
        productId={contactModal?.productId || ''}
        productName={contactModal?.productName || ''}
        vendorName={contactModal?.productBrand || ''}
        recipientUserId={selectedRepUserId}
        onSent={handleRequestSent}
        onNeedResolution={() => contactModal && handleNeedResolution(contactModal, 'GENERAL')}
      />

      <RepResolverModal
        isOpen={!!resolverModal}
        onClose={() => setResolverModal(null)}
        productId={resolverModal?.productId || ''}
        productName={resolverModal?.productName || ''}
        vendorName={resolverModal?.productBrand || ''}
        onRepSelected={handleRepSelected}
        onInviteRep={handleInviteRep}
        onSendViaFolio={handleSendViaFolio}
      />
    </div>
  );
}
