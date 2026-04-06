'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

interface VendorInviteCandidate {
  id: string;
  vendorName: string;
  vendorWebsite: string | null;
  repEmail: string | null;
  repName: string | null;
  status: 'PENDING' | 'READY' | 'INVITED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  firstSeenByDesigner: {
    id: string;
    name: string;
    email: string;
  } | null;
  firstSeenInProject: {
    id: string;
    title: string;
  } | null;
  aggregates: {
    designerCount: number;
    projectCount: number;
    signalCount: number;
    contactCount: number;
    uniqueDomainsCount: number;
    multiDesigner: boolean;
    lastSeenAt: string;
  };
  signals: Array<{
    id: string;
    designer: {
      id: string;
      name: string;
      email: string;
    };
    project: {
      id: string;
      title: string;
    } | null;
    tagId: string | null;
    createdAt: string;
  }>;
  contacts: Array<{
    id: string;
    email: string;
    name: string | null;
    domain: string | null;
    designer: {
      id: string;
      name: string;
      email: string;
    };
    project: {
      id: string;
      title: string;
    } | null;
    source: string;
    createdAt: string;
  }>;
}

export default function PendingInvitesPage() {
  const [candidates, setCandidates] = useState<VendorInviteCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'READY' | 'INVITED' | 'ARCHIVED' | ''>('');
  const [selectedCandidate, setSelectedCandidate] = useState<VendorInviteCandidate | null>(null);
  const [sortBy, setSortBy] = useState<'signals' | 'newest' | 'oldest'>('signals');
  const [multiDesignerOnly, setMultiDesignerOnly] = useState(false);
  const [hasContactsOnly, setHasContactsOnly] = useState(false);

  useEffect(() => {
    fetchCandidates();
  }, [statusFilter, sortBy, multiDesignerOnly, hasContactsOnly]);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('sortBy', sortBy);
      const response = await fetch(`/api/admin/pending-invites?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      let filtered = data.candidates || [];

      // Apply client-side filters
      if (multiDesignerOnly) {
        filtered = filtered.filter((c: VendorInviteCandidate) => c.aggregates.multiDesigner);
      }
      if (hasContactsOnly) {
        filtered = filtered.filter((c: VendorInviteCandidate) => c.aggregates.contactCount > 0);
      }

      setCandidates(filtered);
    } catch (error) {
      console.error('Error fetching candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (candidateId: string, newStatus: 'READY' | 'ARCHIVED') => {
    try {
      const response = await fetch('/api/admin/pending-invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, status: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update');
      await fetchCandidates();
      if (selectedCandidate?.id === candidateId) {
        setSelectedCandidate(null);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const copyBlitzPack = (candidate: VendorInviteCandidate) => {
    // Group contacts by domain
    const contactsByDomain: Record<string, typeof candidate.contacts> = {};
    candidate.contacts.forEach((contact) => {
      const domain = contact.domain || 'unknown';
      if (!contactsByDomain[domain]) {
        contactsByDomain[domain] = [];
      }
      contactsByDomain[domain].push(contact);
    });

    // Build contact list
    const contactList = Object.entries(contactsByDomain)
      .map(([domain, contacts]) => {
        const emails = contacts.map((c) => c.email).join(', ');
        return `${domain}: ${emails}`;
      })
      .join('\n');

    const snippet = `VENDOR: ${candidate.vendorName}
${candidate.vendorWebsite ? `WEBSITE: ${candidate.vendorWebsite}` : ''}

METRICS:
- ${candidate.aggregates.designerCount} designer${candidate.aggregates.designerCount !== 1 ? 's' : ''}
- ${candidate.aggregates.projectCount} project${candidate.aggregates.projectCount !== 1 ? 's' : ''}
- ${candidate.aggregates.signalCount} tag${candidate.aggregates.signalCount !== 1 ? 's' : ''}
- ${candidate.aggregates.contactCount} contact${candidate.aggregates.contactCount !== 1 ? 's' : ''} across ${candidate.aggregates.uniqueDomainsCount} domain${candidate.aggregates.uniqueDomainsCount !== 1 ? 's' : ''}

CONTACTS BY DOMAIN:
${contactList || 'No contacts captured yet'}

OUTREACH TEMPLATE:
Hi ${candidate.contacts[0]?.name || 'Team'},

I noticed that ${candidate.aggregates.designerCount} designer${candidate.aggregates.designerCount !== 1 ? 's' : ''} on Folio have tagged products from ${candidate.vendorName} in their projects.

We'd love to have ${candidate.vendorName} join Folio as a vendor partner. Folio is a platform where designers discover and source products, and we're building a community of top design professionals.

Would you be interested in learning more about joining Folio?

Best regards,
The Folio Team`;
    navigator.clipboard.writeText(snippet);
    alert('Blitz pack copied to clipboard!');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-100 text-amber-800';
      case 'READY':
        return 'bg-blue-100 text-blue-800';
      case 'INVITED':
        return 'bg-green-100 text-green-800';
      case 'ARCHIVED':
        return 'bg-surface-ground text-folio-text-secondary';
      default:
        return 'bg-surface-ground text-folio-text-secondary';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-canvas py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center py-12">
            <div className="text-folio-text-secondary">Loading pending invites...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-[var(--accent)] hover:text-[var(--accent-hover)] folio-meta mb-2 inline-block">
              Back to Admin Dashboard
            </Link>
            <h1 className="folio-h1">Pending Vendor Invites</h1>
            <p className="folio-body mt-1">
              Vendors tagged by designers but not yet onboarded ({candidates.length} total)
            </p>
          </div>
        </div>

        {/* Filters */}
        <RidgeCard padding="md" className="mb-6">
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="block folio-meta mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="ridge-input px-3 py-2"
              >
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="READY">Ready</option>
                <option value="INVITED">Invited</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div>
              <label className="block folio-meta mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="ridge-input px-3 py-2"
              >
                <option value="signals">Most Signals</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="multiDesigner"
                checked={multiDesignerOnly}
                onChange={(e) => setMultiDesignerOnly(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="multiDesigner" className="folio-meta">
                Multi-designer only
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hasContacts"
                checked={hasContactsOnly}
                onChange={(e) => setHasContactsOnly(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="hasContacts" className="folio-meta">
                Has contacts only
              </label>
            </div>
          </div>
        </RidgeCard>

        {/* Table */}
        {candidates.length === 0 ? (
          <RidgeCard padding="xl" className="text-center">
            <p className="folio-body mb-2">No pending invites found</p>
            <p className="folio-meta">
              When designers tag products with vendor information, they&apos;ll appear here.
            </p>
          </RidgeCard>
        ) : (
          <RidgeCard padding="none" className="overflow-hidden">
            <table className="min-w-full divide-y divide-[var(--border-subtle)]">
              <thead className="bg-surface-ground">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                    Contacts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                    Designers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                    Projects
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                    Tags
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                    First Seen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface-canvas divide-y divide-[var(--border-subtle)]">
                {candidates.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className="hover:bg-surface-ground/50 cursor-pointer"
                    onClick={() => setSelectedCandidate(candidate)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-folio-text-primary">{candidate.vendorName}</div>
                      {candidate.vendorWebsite && (
                        <div className="text-sm text-folio-text-secondary">
                          <a
                            href={candidate.vendorWebsite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {candidate.vendorWebsite.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-folio-text-primary">
                      {candidate.aggregates.contactCount > 0 ? (
                        <span className="font-medium">
                          {candidate.aggregates.contactCount}
                          {candidate.aggregates.uniqueDomainsCount > 1 && (
                            <span className="text-folio-text-secondary ml-1">
                              ({candidate.aggregates.uniqueDomainsCount} domains)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-folio-text-tertiary">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-folio-text-primary">
                      {candidate.aggregates.designerCount}
                      {candidate.aggregates.multiDesigner && (
                        <span className="ml-1 text-[var(--accent)]" title="Multiple designers">*</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-folio-text-primary">
                      {candidate.aggregates.projectCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-folio-text-primary">
                      {candidate.aggregates.signalCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-folio-text-secondary">
                      {new Date(candidate.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          candidate.status
                        )}`}
                      >
                        {candidate.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCandidate(candidate);
                        }}
                        className="text-[var(--accent)] hover:text-[var(--accent-hover)] mr-3"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </RidgeCard>
        )}

        {/* Detail Drawer */}
        {selectedCandidate && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <RidgeCard padding="lg" className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="folio-h2">{selectedCandidate.vendorName}</h2>
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="text-folio-text-tertiary hover:text-folio-text-secondary"
                >
                  x
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="folio-meta font-medium">Website</label>
                  <p className="text-sm text-folio-text-primary">
                    {selectedCandidate.vendorWebsite ? (
                      <a
                        href={selectedCandidate.vendorWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
                      >
                        {selectedCandidate.vendorWebsite}
                      </a>
                    ) : (
                      '-'
                    )}
                  </p>
                </div>
                <div>
                  <label className="folio-meta font-medium">Contacts</label>
                  <p className="text-sm text-folio-text-primary">
                    {selectedCandidate.aggregates.contactCount} contact
                    {selectedCandidate.aggregates.contactCount !== 1 ? 's' : ''} across{' '}
                    {selectedCandidate.aggregates.uniqueDomainsCount} domain
                    {selectedCandidate.aggregates.uniqueDomainsCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div>
                  <label className="folio-meta font-medium">Status</label>
                  <p className="text-sm">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                        selectedCandidate.status
                      )}`}
                    >
                      {selectedCandidate.status}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="folio-meta font-medium">First Seen</label>
                  <p className="text-sm text-folio-text-primary">
                    {selectedCandidate.firstSeenByDesigner?.name || 'Unknown'} in project &quot;
                    {selectedCandidate.firstSeenInProject?.title || 'Untitled'}&quot;
                    <br />
                    <span className="text-folio-text-secondary">
                      {new Date(selectedCandidate.createdAt).toLocaleString()}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="folio-meta font-medium">Aggregates</label>
                  <p className="text-sm text-folio-text-primary">
                    {selectedCandidate.aggregates.designerCount} designer
                    {selectedCandidate.aggregates.designerCount !== 1 ? 's' : ''} x{' '}
                    {selectedCandidate.aggregates.projectCount} project
                    {selectedCandidate.aggregates.projectCount !== 1 ? 's' : ''} x{' '}
                    {selectedCandidate.aggregates.signalCount} tag
                    {selectedCandidate.aggregates.signalCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {selectedCandidate.contacts.length > 0 && (
                <div className="mb-6">
                  <label className="folio-meta font-medium mb-2 block">
                    Contacts Captured ({selectedCandidate.contacts.length})
                  </label>
                  <div className="border border-[var(--border-subtle)] rounded-lg max-h-64 overflow-y-auto">
                    {(() => {
                      // Group contacts by domain
                      const contactsByDomain: Record<string, typeof selectedCandidate.contacts> = {};
                      selectedCandidate.contacts.forEach((contact) => {
                        const domain = contact.domain || 'unknown';
                        if (!contactsByDomain[domain]) {
                          contactsByDomain[domain] = [];
                        }
                        contactsByDomain[domain].push(contact);
                      });

                      return Object.entries(contactsByDomain).map(([domain, contacts]) => (
                        <div key={domain} className="border-b border-[var(--border-subtle)] last:border-b-0 p-3">
                          <div className="font-medium text-sm text-folio-text-primary mb-2">{domain}</div>
                          <div className="space-y-1">
                            {contacts.map((contact) => (
                              <div key={contact.id} className="text-sm text-folio-text-secondary">
                                <span className="font-medium">{contact.email}</span>
                                {contact.name && <span className="text-folio-text-secondary ml-2">({contact.name})</span>}
                                <span className="text-folio-text-tertiary text-xs ml-2">
                                  via {contact.designer.name} - {new Date(contact.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <label className="folio-meta font-medium mb-2 block">
                  Signals ({selectedCandidate.signals.length})
                </label>
                <div className="border border-[var(--border-subtle)] rounded-lg max-h-64 overflow-y-auto">
                  <table className="min-w-full divide-y divide-[var(--border-subtle)]">
                    <thead className="bg-surface-ground">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-folio-text-secondary">Designer</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-folio-text-secondary">Project</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-folio-text-secondary">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-surface-canvas divide-y divide-[var(--border-subtle)]">
                      {selectedCandidate.signals.map((signal) => (
                        <tr key={signal.id}>
                          <td className="px-4 py-2 text-sm text-folio-text-primary">{signal.designer.name}</td>
                          <td className="px-4 py-2 text-sm text-folio-text-primary">
                            {signal.project?.title || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-folio-text-secondary">
                            {new Date(signal.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3">
                {selectedCandidate.status === 'PENDING' && (
                  <Button
                    variant="accent"
                    onClick={() => updateStatus(selectedCandidate.id, 'READY')}
                  >
                    Mark Ready
                  </Button>
                )}
                {selectedCandidate.status !== 'ARCHIVED' && (
                  <Button
                    variant="ridge"
                    onClick={() => updateStatus(selectedCandidate.id, 'ARCHIVED')}
                  >
                    Archive
                  </Button>
                )}
                <Button
                  variant="accent"
                  onClick={() => copyBlitzPack(selectedCandidate)}
                >
                  Copy Blitz Pack
                </Button>
              </div>
            </RidgeCard>
          </div>
        )}
      </div>
    </div>
  );
}
