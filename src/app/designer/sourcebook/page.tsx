'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import SourcebookGridCard from '@/components/designer/sourcebook/SourcebookGridCard';
import SourcebookFilters from '@/components/designer/sourcebook/SourcebookFilters';
import NotesModal from './NotesModal';
import UseInProjectModal from './UseInProjectModal';
import RequestSampleModal from './RequestSampleModal';
import RequestQuoteModal from './RequestQuoteModal';
import ContactRepModal from './ContactRepModal';
import RepResolverModal from './RepResolverModal';
import { CATEGORY_LABELS } from '@/types/structured-requests';
import type {
  SourcebookEntry,
  SourcebookSortField,
  SortDirection,
  SourcebookFilters as SourcebookFiltersType,
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

  const [filters, setFilters] = useState<SourcebookFiltersType>({});
  const [sortField, setSortField] = useState<SourcebookSortField>('lastUsedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);

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

  const handleRepSelected = (repUserId: string, requestTypes?: string[]) => {
    setSelectedRepUserId(repUserId);
    if (resolverModal) {
      if (resolverActionType === 'SAMPLE_REQUEST') setSampleModal(resolverModal);
      else if (resolverActionType === 'QUOTE_REQUEST') setQuoteModal(resolverModal);
      else setContactModal(resolverModal);
    }
    setResolverModal(null);

    // Show toast for on-platform rep notification
    const typeLabels = (requestTypes || [resolverActionType])
      .map(t => CATEGORY_LABELS[t] || t)
      .join(', ');
    toast.success(`Rep was notified for your ${typeLabels.toLowerCase()} request`);
  };

  const handleEmailSent = (result: { repName: string; repEmail: string; conversationId: string }) => {
    const vendorName = resolverModal?.productBrand || '';
    setResolverModal(null);

    // Save rep as contact prompt via actionable toast
    toast(`Email sent to ${result.repEmail}`, {
      description: `Would you like to confirm ${result.repName} as your rep for ${vendorName}? You can edit this in your vendor directory.`,
      action: {
        label: 'Confirm Rep',
        onClick: () => {
          fetch('/api/rep-contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vendorName,
              repName: result.repName,
              repEmail: result.repEmail,
            }),
          }).then(() => {
            toast.success(`${result.repName} confirmed as your rep for ${vendorName}`);
          }).catch(() => {
            toast.error('Failed to save rep contact');
          });
        },
      },
      duration: 10000,
    });
  };

  const handleRequestSent = (conversationId: string) => {
    setSelectedRepUserId(undefined);
    toast.success('Request sent successfully');
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

  const handleFilterChange = (key: keyof SourcebookFiltersType, value: string) => {
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
      if (archived && !showArchived) {
        setEntries(prev => prev.filter(e => e.productId !== productId));
      } else {
        setEntries(prev =>
          prev.map(e =>
            e.productId === productId ? { ...e, archived } : e
          )
        );
      }
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

  return (
    <div className="min-h-screen bg-surface-canvas p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h1 className="folio-h1 text-folio-text-primary mb-2">Sourcebook</h1>
          <p className="text-[13px] text-folio-text-tertiary">
            {stats.totalProducts} products &middot; {stats.totalVendors} vendors &middot; {stats.totalProjects} projects
          </p>
        </div>

        {/* Filter bar */}
        <SourcebookFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filters={filters}
          onFilterChange={handleFilterChange}
          sortField={sortField}
          onSortChange={handleSort}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
          uniqueVendors={uniqueVendors}
          uniqueCategories={uniqueCategories}
          uniqueProjects={uniqueProjects}
        />

        {/* Entry Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
            <p className="mt-4 text-[13px] text-folio-text-secondary">Loading sourcebook...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-600 mb-4 text-[13px]">{error}</p>
            <Button variant="ridge" onClick={loadSourcebook}>Retry</Button>
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[14px] text-folio-text-secondary mb-4">
              {hasActiveFilters
                ? 'No products matching these filters.'
                : 'Your Sourcebook builds itself as you tag products in projects.'}
            </p>
            {hasActiveFilters ? (
              <button
                onClick={clearFilters}
                className="text-[13px] text-[#c9a96e] hover:underline"
              >
                Clear Filters
              </button>
            ) : (
              <a href="/designer">
                <Button variant="accent">Go to Projects &rarr;</Button>
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedEntries.map(entry => (
              <SourcebookGridCard
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
        actionType={resolverActionType}
        onRepSelected={handleRepSelected}
        onEmailSent={handleEmailSent}
      />
    </div>
  );
}
