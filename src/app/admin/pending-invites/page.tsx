'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
        return 'bg-yellow-100 text-yellow-800';
      case 'READY':
        return 'bg-blue-100 text-blue-800';
      case 'INVITED':
        return 'bg-green-100 text-green-800';
      case 'ARCHIVED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center py-12">
            <div className="text-gray-500">Loading pending invites...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
              ← Back to Admin Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Pending Vendor Invites</h1>
            <p className="text-gray-600 mt-1">
              Vendors tagged by designers but not yet onboarded ({candidates.length} total)
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white"
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="READY">Ready</option>
              <option value="INVITED">Invited</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white"
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
            <label htmlFor="multiDesigner" className="text-sm text-gray-700">
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
            <label htmlFor="hasContacts" className="text-sm text-gray-700">
              Has contacts only
            </label>
          </div>
        </div>

        {/* Table */}
        {candidates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg mb-2">No pending invites found</p>
            <p className="text-gray-400 text-sm">
              When designers tag products with vendor information, they'll appear here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contacts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Designers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Projects
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tags
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    First Seen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {candidates.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedCandidate(candidate)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{candidate.vendorName}</div>
                      {candidate.vendorWebsite && (
                        <div className="text-sm text-gray-500">
                          <a
                            href={candidate.vendorWebsite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {candidate.vendorWebsite.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {candidate.aggregates.contactCount > 0 ? (
                        <span className="font-medium">
                          {candidate.aggregates.contactCount}
                          {candidate.aggregates.uniqueDomainsCount > 1 && (
                            <span className="text-gray-500 ml-1">
                              ({candidate.aggregates.uniqueDomainsCount} domains)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {candidate.aggregates.designerCount}
                      {candidate.aggregates.multiDesigner && (
                        <span className="ml-1 text-blue-600" title="Multiple designers">★</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {candidate.aggregates.projectCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {candidate.aggregates.signalCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detail Drawer */}
        {selectedCandidate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">{selectedCandidate.vendorName}</h2>
                  <button
                    onClick={() => setSelectedCandidate(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Website</label>
                    <p className="text-sm text-gray-900">
                      {selectedCandidate.vendorWebsite ? (
                        <a
                          href={selectedCandidate.vendorWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {selectedCandidate.vendorWebsite}
                        </a>
                      ) : (
                        '—'
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Contacts</label>
                    <p className="text-sm text-gray-900">
                      {selectedCandidate.aggregates.contactCount} contact
                      {selectedCandidate.aggregates.contactCount !== 1 ? 's' : ''} across{' '}
                      {selectedCandidate.aggregates.uniqueDomainsCount} domain
                      {selectedCandidate.aggregates.uniqueDomainsCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
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
                    <label className="text-sm font-medium text-gray-700">First Seen</label>
                    <p className="text-sm text-gray-900">
                      {selectedCandidate.firstSeenByDesigner?.name || 'Unknown'} in project "
                      {selectedCandidate.firstSeenInProject?.title || 'Untitled'}"
                      <br />
                      <span className="text-gray-500">
                        {new Date(selectedCandidate.createdAt).toLocaleString()}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Aggregates</label>
                    <p className="text-sm text-gray-900">
                      {selectedCandidate.aggregates.designerCount} designer
                      {selectedCandidate.aggregates.designerCount !== 1 ? 's' : ''} ×{' '}
                      {selectedCandidate.aggregates.projectCount} project
                      {selectedCandidate.aggregates.projectCount !== 1 ? 's' : ''} ×{' '}
                      {selectedCandidate.aggregates.signalCount} tag
                      {selectedCandidate.aggregates.signalCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {selectedCandidate.contacts.length > 0 && (
                  <div className="mb-6">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Contacts Captured ({selectedCandidate.contacts.length})
                    </label>
                    <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto">
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
                          <div key={domain} className="border-b border-gray-200 last:border-b-0 p-3">
                            <div className="font-medium text-sm text-gray-900 mb-2">{domain}</div>
                            <div className="space-y-1">
                              {contacts.map((contact) => (
                                <div key={contact.id} className="text-sm text-gray-700">
                                  <span className="font-medium">{contact.email}</span>
                                  {contact.name && <span className="text-gray-500 ml-2">({contact.name})</span>}
                                  <span className="text-gray-400 text-xs ml-2">
                                    via {contact.designer.name} • {new Date(contact.createdAt).toLocaleDateString()}
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
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Signals ({selectedCandidate.signals.length})
                  </label>
                  <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Designer</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Project</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedCandidate.signals.map((signal) => (
                          <tr key={signal.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">{signal.designer.name}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {signal.project?.title || '—'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
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
                    <button
                      onClick={() => updateStatus(selectedCandidate.id, 'READY')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Mark Ready
                    </button>
                  )}
                  {selectedCandidate.status !== 'ARCHIVED' && (
                    <button
                      onClick={() => updateStatus(selectedCandidate.id, 'ARCHIVED')}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      Archive
                    </button>
                  )}
                  <button
                    onClick={() => copyBlitzPack(selectedCandidate)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Copy Blitz Pack
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

