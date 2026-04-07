'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface VendorRep {
  id: string;
  name: string;
  profileImage: string | null;
  title: string | null;
  phone: string | null;
  email: string | null;
  visitCount: number;
  lastContact: string;
  visits: Array<{
    id: string;
    metBy: { id: string; name: string };
    context: string | null;
    productCount: number;
    createdAt: string;
  }>;
}

interface VendorEntry {
  org: { id: string; name: string; type: string; logo: string | null };
  lastContact: string;
  reps: VendorRep[];
}

interface OrgVendorDirectoryProps {
  orgId: string;
}

export default function OrgVendorDirectory({ orgId }: OrgVendorDirectoryProps) {
  const [directory, setDirectory] = useState<VendorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`/api/org/${orgId}/vendor-directory`)
      .then((res) => res.json())
      .then((data) => {
        setDirectory(data.directory || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [orgId]);

  const filtered = search
    ? directory.filter(
        (v) =>
          v.org.name.toLowerCase().includes(search.toLowerCase()) ||
          v.reps.some((r) => r.name.toLowerCase().includes(search.toLowerCase()))
      )
    : directory;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg animate-pulse bg-folio-border-subtle" />
        ))}
      </div>
    );
  }

  if (directory.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 mx-auto text-folio-text-tertiary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <p className="text-folio-text-tertiary">No vendor contacts yet.</p>
        <p className="text-sm text-folio-text-tertiary mt-1">
          When team members connect with vendors via Folio Badge, they&apos;ll appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendors or reps..."
          className="w-full max-w-md px-4 py-2 text-sm border border-folio-border-subtle rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
      </div>

      {/* Vendor list */}
      <div className="space-y-4">
        {filtered.map((vendor) => (
          <div key={vendor.org.id} className="bg-surface-canvas rounded-lg border border-folio-border-subtle overflow-hidden">
            {/* Vendor org header */}
            <div className="px-5 py-4 border-b border-folio-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                {vendor.org.logo ? (
                  <Image src={vendor.org.logo} alt={vendor.org.name} width={32} height={32} className="rounded object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded bg-surface-elevated flex items-center justify-center text-xs font-medium text-folio-text-tertiary">
                    {vendor.org.name.charAt(0)}
                  </div>
                )}
                <div>
                  <Link href={`/org/${vendor.org.id}`} className="text-sm font-medium text-folio-text-primary hover:underline">
                    {vendor.org.name}
                  </Link>
                </div>
              </div>
              <span className="text-xs text-folio-text-tertiary">
                Last contact: {formatDate(vendor.lastContact)}
              </span>
            </div>

            {/* Reps */}
            <div className="divide-y divide-stone-50">
              {vendor.reps.map((rep) => (
                <div key={rep.id} className="px-5 py-3 flex items-start gap-4">
                  {/* Rep avatar */}
                  {rep.profileImage ? (
                    <Image src={rep.profileImage} alt={rep.name} width={36} height={36} className="rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-surface-elevated flex items-center justify-center text-xs text-folio-text-tertiary shrink-0">
                      {rep.name.charAt(0)}
                    </div>
                  )}

                  {/* Rep info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-folio-text-primary">{rep.name}</span>
                      {rep.title && <span className="text-xs text-folio-text-tertiary">({rep.title})</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-folio-text-tertiary">
                      {rep.visits[0]?.metBy && (
                        <span>Met by: {rep.visits[0].metBy.name}</span>
                      )}
                      {rep.visits[0]?.context && (
                        <>
                          <span className="text-folio-text-tertiary">&middot;</span>
                          <span>{rep.visits[0].context}</span>
                        </>
                      )}
                      {rep.visitCount > 1 && (
                        <>
                          <span className="text-folio-text-tertiary">&middot;</span>
                          <span>{rep.visitCount} visits</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {rep.phone && (
                      <a href={`tel:${rep.phone}`} className="p-1.5 rounded hover:bg-surface-elevated text-folio-text-tertiary hover:text-folio-text-secondary" title="Call">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                      </a>
                    )}
                    {rep.email && (
                      <a href={`mailto:${rep.email}`} className="p-1.5 rounded hover:bg-surface-elevated text-folio-text-tertiary hover:text-folio-text-secondary" title="Email">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
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
