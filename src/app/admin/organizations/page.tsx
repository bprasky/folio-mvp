'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FaBuilding,
  FaSearch,
  FaCheck,
  FaStar,
  FaUsers,
  FaSpinner,
  FaExternalLinkAlt,
  FaEdit,
  FaSave,
  FaTimes,
  FaNotes,
} from 'react-icons/fa';
import { RidgeCard, StatsCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Organization {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  website?: string;
  logo?: string;
  address?: string;
  phone?: string;
  verifiedAt?: string;
  createdAt: string;
  memberCount: number;
  projectCount: number;
  salesNotes?: string;
  salesContactedAt?: string;
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'UNCLAIMED', label: 'Unclaimed' },
  { value: 'CLAIMED', label: 'Claimed' },
  { value: 'PROFESSIONAL', label: 'Professional' },
];

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'DESIGN_FIRM', label: 'Design Firm' },
  { value: 'VENDOR', label: 'Vendor' },
  { value: 'MANUFACTURER', label: 'Manufacturer' },
  { value: 'SHOWROOM', label: 'Showroom' },
];

const statusColors: Record<string, string> = {
  UNCLAIMED: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
  CLAIMED: 'bg-blue-100 text-blue-700',
  PROFESSIONAL: 'bg-purple-100 text-purple-700',
};

const statusIcons: Record<string, React.ReactNode> = {
  UNCLAIMED: null,
  CLAIMED: <FaCheck className="w-3 h-3" />,
  PROFESSIONAL: <FaStar className="w-3 h-3" />,
};

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Sales notes editing
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    unclaimed: 0,
    claimed: 0,
    professional: 0,
  });

  useEffect(() => {
    fetchOrganizations();
  }, [searchQuery, statusFilter, typeFilter]);

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('type', typeFilter);
      params.append('limit', '100');

      const response = await fetch(`/api/admin/organizations?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }

      const data = await response.json();
      setOrganizations(data.organizations || []);
      setStats({
        total: data.total || 0,
        unclaimed: data.stats?.unclaimed || 0,
        claimed: data.stats?.claimed || 0,
        professional: data.stats?.professional || 0,
      });
    } catch (err) {
      setError('Failed to load organizations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async (orgId: string) => {
    setSavingNotes(true);
    try {
      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesNotes: editingNotesValue,
          salesContactedAt: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setOrganizations(prev =>
          prev.map(org =>
            org.id === orgId
              ? { ...org, salesNotes: editingNotesValue, salesContactedAt: new Date().toISOString() }
              : org
          )
        );
        setEditingNotesId(null);
        setEditingNotesValue('');
      }
    } catch (err) {
      console.error('Error saving notes:', err);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleStatusChange = async (orgId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchOrganizations();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="folio-h1 mb-2">Organizations</h1>
            <p className="folio-body">Manage organizations, verification, and sales outreach</p>
          </div>
          <Link
            href="/admin"
            className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            Back to Admin
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatsCard label="Total Organizations" value={stats.total} />
          <StatsCard label="Unclaimed" value={stats.unclaimed} />
          <StatsCard label="Claimed (Free)" value={stats.claimed} />
          <StatsCard label="Professional (Paid)" value={stats.professional} />
        </div>

        {/* Filters */}
        <RidgeCard padding="md" className="mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-tertiary)]" />
                <Input
                  type="text"
                  placeholder="Search organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="ridge-input px-4 py-2"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="ridge-input px-4 py-2"
              >
                {typeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </RidgeCard>

        {/* Organizations List */}
        {loading ? (
          <RidgeCard padding="xl" className="text-center">
            <FaSpinner className="w-8 h-8 animate-spin text-[var(--text-tertiary)] mx-auto" />
            <p className="text-[var(--text-secondary)] mt-4">Loading organizations...</p>
          </RidgeCard>
        ) : error ? (
          <RidgeCard padding="xl" className="text-center">
            <p className="text-red-500">{error}</p>
          </RidgeCard>
        ) : organizations.length === 0 ? (
          <RidgeCard padding="xl" className="text-center">
            <FaBuilding className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
            <p className="text-[var(--text-secondary)]">No organizations found</p>
          </RidgeCard>
        ) : (
          <div className="space-y-4">
            {organizations.map((org) => (
              <RidgeCard key={org.id} padding="lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-[var(--bg-elevated)] rounded-lg flex items-center justify-center flex-shrink-0">
                      {org.logo ? (
                        <img
                          src={org.logo}
                          alt={org.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <FaBuilding className="w-8 h-8 text-[var(--text-tertiary)]" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <Link
                          href={`/org/${org.id}`}
                          className="folio-h3 text-[var(--text-primary)] hover:text-[var(--accent)]"
                        >
                          {org.name}
                        </Link>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            statusColors[org.status]
                          }`}
                        >
                          {statusIcons[org.status]}
                          {org.status.toLowerCase()}
                        </span>
                      </div>
                      <p className="folio-meta mb-2">
                        {org.type.replace('_', ' ')}
                        {org.website && (
                          <>
                            <span className="mx-2">-</span>
                            <a
                              href={org.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--accent)] hover:text-[var(--accent-hover)] inline-flex items-center gap-1"
                            >
                              Website <FaExternalLinkAlt className="w-3 h-3" />
                            </a>
                          </>
                        )}
                      </p>
                      <div className="flex items-center gap-4 folio-meta">
                        <span className="flex items-center gap-1">
                          <FaUsers className="w-4 h-4" />
                          {org.memberCount} members
                        </span>
                        <span>
                          {org.projectCount} projects
                        </span>
                        <span>
                          Created {new Date(org.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={org.status}
                      onChange={(e) => handleStatusChange(org.id, e.target.value)}
                      className="ridge-input px-3 py-1.5 text-sm"
                    >
                      <option value="UNCLAIMED">Unclaimed</option>
                      <option value="CLAIMED">Claimed</option>
                      <option value="PROFESSIONAL">Professional</option>
                    </select>
                    <Link href={`/org/${org.id}`}>
                      <Button variant="ridge" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Sales Notes Section */}
                <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 folio-meta mb-2">
                      <FaNotes className="w-4 h-4" />
                      <span className="font-medium">Sales Notes</span>
                      {org.salesContactedAt && (
                        <span className="text-[var(--text-tertiary)]">
                          (Last contacted: {new Date(org.salesContactedAt).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                    {editingNotesId !== org.id && (
                      <button
                        onClick={() => {
                          setEditingNotesId(org.id);
                          setEditingNotesValue(org.salesNotes || '');
                        }}
                        className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                      >
                        <FaEdit className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {editingNotesId === org.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingNotesValue}
                        onChange={(e) => setEditingNotesValue(e.target.value)}
                        placeholder="Add sales notes, outreach history, contact info..."
                        className="ridge-input w-full px-3 py-2 text-sm"
                        rows={3}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          variant="accent"
                          size="sm"
                          onClick={() => handleSaveNotes(org.id)}
                          disabled={savingNotes}
                        >
                          {savingNotes ? (
                            <FaSpinner className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <FaSave className="w-3 h-3 mr-1" />
                          )}
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingNotesId(null);
                            setEditingNotesValue('');
                          }}
                        >
                          <FaTimes className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="folio-meta text-[var(--text-secondary)]">
                      {org.salesNotes || 'No notes yet. Click edit to add notes.'}
                    </p>
                  )}
                </div>
              </RidgeCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
