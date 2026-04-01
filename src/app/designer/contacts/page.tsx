'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import ContactImportUploader from '@/components/contacts/ContactImportUploader';
import ContactReviewList from '@/components/contacts/ContactReviewList';

interface VendorGroup {
  vendorName: string;
  vendorOrgId: string | null;
  contacts: ContactRecord[];
}

interface ContactRecord {
  id: string;
  name: string;
  email: string;
  company: string | null;
  title: string | null;
  vendorOrgId: string | null;
  vendorName: string | null;
  matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMATCHED' | null;
  isPreferredRep: boolean;
}

type ViewState = 'upload' | 'importing' | 'review' | 'manage';

export default function ContactsPage() {
  const [viewState, setViewState] = useState<ViewState>('upload');
  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([]);
  const [unmatchedContacts, setUnmatchedContacts] = useState<ContactRecord[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [importStats, setImportStats] = useState<{
    totalRaw: number;
    totalFiltered: number;
    matchedCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      setVendorGroups(data.vendorGroups || []);
      setUnmatchedContacts(data.unmatched || []);
      setTotalContacts(data.total || 0);
      setViewState(data.total > 0 ? 'manage' : 'upload');
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleImportComplete = (stats: { totalRaw: number; totalFiltered: number; matchedCount: number }) => {
    setImportStats(stats);
    setViewState('review');
    loadContacts();
  };

  const handleConfirmImport = async (preferredRepIds: string[]) => {
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredRepIds }),
    });
    setViewState('manage');
    loadContacts();
  };

  const handleTogglePreferredRep = async (contactId: string, isPreferred: boolean) => {
    await fetch(`/api/contacts/${contactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPreferredRep: isPreferred }),
    });
    loadContacts();
  };

  const handleDeleteContact = async (contactId: string) => {
    await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
    loadContacts();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] p-6">
        <div className="max-w-3xl mx-auto">
          <div className="h-8 w-48 rounded-lg animate-pulse" style={{ backgroundColor: '#E8E4DF' }} />
          <div className="mt-8 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: '#E8E4DF' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="folio-h1 text-[var(--text-primary)] mb-3">Contacts</h1>
          <p className="folio-body text-[var(--text-secondary)]">
            Import your professional contacts so Folio can connect you with your vendor reps automatically.
          </p>
        </div>

        {/* Upload view */}
        {(viewState === 'upload' || viewState === 'importing') && (
          <ContactImportUploader
            onImportComplete={handleImportComplete}
            isImporting={viewState === 'importing'}
            onImportStart={() => setViewState('importing')}
          />
        )}

        {/* Review view — after import, before confirmation */}
        {viewState === 'review' && (
          <div>
            {importStats && (
              <div className="glass-surface rounded-xl p-4 mb-6">
                <p className="text-sm text-[var(--text-primary)] font-medium">
                  Import complete
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {importStats.totalRaw} contacts processed · {importStats.totalFiltered} professional · {importStats.matchedCount} matched to vendors
                </p>
              </div>
            )}

            <ContactReviewList
              vendorGroups={vendorGroups}
              onConfirm={handleConfirmImport}
              onSkip={() => setViewState('manage')}
            />
          </div>
        )}

        {/* Manage view — ongoing contact management */}
        {viewState === 'manage' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-[var(--text-secondary)]">
                {totalContacts} contacts imported
              </p>
              <Button
                variant="ridge"
                onClick={() => setViewState('upload')}
              >
                Import More
              </Button>
            </div>

            {vendorGroups.length === 0 && unmatchedContacts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-[var(--text-tertiary)]">No contacts imported yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {vendorGroups.map(group => (
                  <div key={group.vendorName} className="glass-surface rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-medium text-[var(--text-primary)]">
                        {group.vendorName}
                      </h3>
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
                        backgroundColor: group.contacts[0]?.matchConfidence === 'HIGH' ? '#E8F5E9' :
                          group.contacts[0]?.matchConfidence === 'MEDIUM' ? '#FFF8E1' : '#F3F0ED',
                        color: group.contacts[0]?.matchConfidence === 'HIGH' ? '#2E7D32' :
                          group.contacts[0]?.matchConfidence === 'MEDIUM' ? '#F57F17' : '#8B8178',
                      }}>
                        {group.contacts.length} contact{group.contacts.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.contacts.map(contact => (
                        <div key={contact.id} className="flex items-center justify-between py-2 border-b border-[#F0EDE9] last:border-b-0">
                          <div>
                            <p className="text-sm text-[var(--text-primary)]">{contact.name}</p>
                            <p className="text-xs text-[var(--text-tertiary)]">
                              {contact.email}
                              {contact.title && ` · ${contact.title}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleTogglePreferredRep(contact.id, !contact.isPreferredRep)}
                              className="text-xs px-2 py-1 rounded-full transition-colors"
                              style={{
                                backgroundColor: contact.isPreferredRep ? '#2C2825' : '#F0EDE9',
                                color: contact.isPreferredRep ? '#fff' : '#5C554D',
                              }}
                            >
                              {contact.isPreferredRep ? 'My Rep' : 'Set as Rep'}
                            </button>
                            <button
                              onClick={() => handleDeleteContact(contact.id)}
                              className="text-xs text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {unmatchedContacts.length > 0 && (
                  <div className="glass-surface rounded-xl p-4">
                    <h3 className="text-sm font-medium text-[var(--text-tertiary)] mb-3">
                      Unmatched Contacts ({unmatchedContacts.length})
                    </h3>
                    <div className="space-y-2">
                      {unmatchedContacts.slice(0, 10).map(contact => (
                        <div key={contact.id} className="flex items-center justify-between py-2 border-b border-[#F0EDE9] last:border-b-0">
                          <div>
                            <p className="text-sm text-[var(--text-secondary)]">{contact.name}</p>
                            <p className="text-xs text-[var(--text-tertiary)]">{contact.email}{contact.company && ` · ${contact.company}`}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteContact(contact.id)}
                            className="text-xs text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {unmatchedContacts.length > 10 && (
                        <p className="text-xs text-[var(--text-tertiary)] pt-2">
                          + {unmatchedContacts.length - 10} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
