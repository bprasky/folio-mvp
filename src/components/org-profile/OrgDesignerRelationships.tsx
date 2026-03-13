'use client';

import { useState, useEffect } from 'react';

interface RepInfo {
  repName: string;
  visitCount: number;
  lastActivity: string;
  productShareCount: number;
}

interface Relationship {
  designerOrg: { id: string; name: string; type: string; logo: string | null } | null;
  designerUser: { id: string; name: string; profileImage: string | null; role: string; title: string | null } | null;
  reps: RepInfo[];
  lastActivity: string;
  totalVisits: number;
  totalProductShares: number;
  status: 'active' | 'new' | 'dormant';
}

interface Stats {
  total: number;
  active: number;
  new: number;
  dormant: number;
}

interface OrgDesignerRelationshipsProps {
  orgId: string;
  isAdmin?: boolean;
}

export default function OrgDesignerRelationships({ orgId }: OrgDesignerRelationshipsProps) {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, new: 0, dormant: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'new' | 'dormant'>('all');

  useEffect(() => {
    fetch(`/api/org/${orgId}/designer-relationships`)
      .then((res) => res.json())
      .then((data) => {
        setRelationships(data.relationships || []);
        setStats(data.stats || { total: 0, active: 0, new: 0, dormant: 0 });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [orgId]);

  const filtered = filter === 'all' ? relationships : relationships.filter((r) => r.status === filter);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg animate-pulse" style={{ backgroundColor: '#E8E4DF' }} />
        ))}
      </div>
    );
  }

  if (relationships.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 mx-auto text-stone-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
        <p className="text-stone-500">No designer relationships yet.</p>
        <p className="text-sm text-stone-400 mt-1">
          When reps connect with designers via Folio Badge, relationships appear here.
        </p>
      </div>
    );
  }

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-green-50', text: 'text-green-700', label: 'Active' },
    new: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'New' },
    dormant: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Dormant' },
  };

  return (
    <div>
      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`text-sm ${filter === 'all' ? 'font-medium text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
        >
          All ({stats.total})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`text-sm ${filter === 'active' ? 'font-medium text-green-700' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Active ({stats.active})
        </button>
        <button
          onClick={() => setFilter('new')}
          className={`text-sm ${filter === 'new' ? 'font-medium text-blue-700' : 'text-stone-500 hover:text-stone-700'}`}
        >
          New ({stats.new})
        </button>
        <button
          onClick={() => setFilter('dormant')}
          className={`text-sm ${filter === 'dormant' ? 'font-medium text-amber-700' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Dormant ({stats.dormant})
        </button>
      </div>

      {/* Relationships list */}
      <div className="space-y-3">
        {filtered.map((rel, i) => {
          const displayName = rel.designerOrg?.name || rel.designerUser?.name || 'Unknown';
          const sc = statusColors[rel.status] || statusColors.active;

          return (
            <div key={i} className="bg-white rounded-lg border border-stone-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-stone-900">{displayName}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                      {sc.label}
                    </span>
                  </div>
                  {rel.designerOrg && (
                    <p className="text-xs text-stone-400 mb-2">Design Firm</p>
                  )}
                </div>
                <span className="text-xs text-stone-400">
                  Last activity: {formatDate(rel.lastActivity)}
                </span>
              </div>

              {/* Rep breakdown */}
              <div className="mt-3 space-y-1.5">
                {rel.reps.map((rep, j) => (
                  <div key={j} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        new Date(rep.lastActivity) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                          ? 'bg-green-400'
                          : 'bg-stone-300'
                      }`} />
                      <span className="text-stone-700">{rep.repName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-stone-400">
                      <span>{rep.visitCount} visit{rep.visitCount !== 1 ? 's' : ''}</span>
                      {rep.productShareCount > 0 && (
                        <span>{rep.productShareCount} products shared</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Dormancy warning */}
              {rel.status === 'dormant' && (
                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2 text-xs text-amber-600">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  No activity in 30+ days. Consider following up or reassigning.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
