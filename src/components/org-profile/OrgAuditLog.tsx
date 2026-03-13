'use client';

import { useState, useEffect } from 'react';

interface AuditVisit {
  id: string;
  visitType: string;
  location: string | null;
  initiatorNotes: string | null;
  recipientNotes: string | null;
  createdAt: string;
  initiatorUser: { id: string; name: string; profileImage: string | null; title: string | null };
  recipientUser: { id: string; name: string; profileImage: string | null; title: string | null };
  initiatorOrg: { id: string; name: string; type: string; logo: string | null } | null;
  recipientOrg: { id: string; name: string; type: string; logo: string | null } | null;
  event: { id: string; title: string; location: string } | null;
  productShares: Array<{
    id: string;
    autoShared: boolean;
    savedByRecipient: boolean;
    product: { id: string; name: string };
  }>;
}

interface OrgAuditLogProps {
  orgId: string;
}

export default function OrgAuditLog({ orgId }: OrgAuditLogProps) {
  const [visits, setVisits] = useState<AuditVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/org/${orgId}/audit-log?page=${page}&limit=15`)
      .then((res) => res.json())
      .then((data) => {
        setVisits(data.visits || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [orgId, page]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg animate-pulse" style={{ backgroundColor: '#E8E4DF' }} />
        ))}
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500 text-sm">No exchanges recorded yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-2">
        {visits.map((visit) => {
          const sharedCount = visit.productShares.length;
          const savedCount = visit.productShares.filter((p) => p.savedByRecipient).length;
          const context = visit.event?.title || visit.location || visitTypeLabel(visit.visitType);

          return (
            <div key={visit.id} className="bg-white rounded-lg border border-stone-200 px-5 py-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {/* Initiator avatar */}
                  <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-xs text-stone-500 flex-shrink-0">
                    {visit.initiatorUser.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm text-stone-900">
                      <span className="font-medium">{visit.initiatorUser.name}</span>
                      {visit.initiatorOrg && (
                        <span className="text-stone-400"> ({visit.initiatorOrg.name})</span>
                      )}
                      <span className="text-stone-400 mx-1.5">&rarr;</span>
                      <span className="font-medium">{visit.recipientUser.name}</span>
                      {visit.recipientOrg && (
                        <span className="text-stone-400"> ({visit.recipientOrg.name})</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-stone-400">
                      <span>{context}</span>
                      {sharedCount > 0 && (
                        <>
                          <span>&middot;</span>
                          <span>{sharedCount} products shared</span>
                        </>
                      )}
                      {savedCount > 0 && (
                        <>
                          <span>&middot;</span>
                          <span className="text-green-600">{savedCount} saved</span>
                        </>
                      )}
                    </div>
                    {/* Notes preview */}
                    {(visit.initiatorNotes || visit.recipientNotes) && (
                      <p className="text-xs text-stone-400 mt-1.5 italic line-clamp-1">
                        {visit.initiatorNotes || visit.recipientNotes}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-stone-400 flex-shrink-0 ml-4">
                  {formatDate(visit.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs text-stone-500 border border-stone-200 rounded hover:bg-stone-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-stone-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs text-stone-500 border border-stone-200 rounded hover:bg-stone-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function visitTypeLabel(type: string) {
  const labels: Record<string, string> = {
    SHOWROOM: 'Showroom visit',
    EVENT: 'Event',
    TRADE_SHOW: 'Trade show',
    OTHER: 'Connection',
  };
  return labels[type] || 'Connection';
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
