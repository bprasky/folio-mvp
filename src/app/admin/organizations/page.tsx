'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FaBuilding,
  FaSearch,
  FaFilter,
  FaCheck,
  FaCrown,
  FaShieldAlt,
  FaStar,
  FaUsers,
  FaSpinner,
  FaExternalLinkAlt,
  FaEdit,
  FaSave,
  FaTimes,
  FaPhone,
  FaNotes,
} from 'react-icons/fa';

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
  UNCLAIMED: 'bg-gray-100 text-gray-700',
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Organizations</h1>
            <p className="text-gray-600">Manage organizations, verification, and sales outreach</p>
          </div>
          <Link
            href="/admin"
            className="text-blue-600 hover:text-blue-800"
          >
            Back to Admin
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-gray-400">
            <p className="text-sm text-gray-600">Total Organizations</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-gray-400">
            <p className="text-sm text-gray-600">Unclaimed</p>
            <p className="text-2xl font-bold text-gray-900">{stats.unclaimed}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-400">
            <p className="text-sm text-gray-600">Claimed (Free)</p>
            <p className="text-2xl font-bold text-gray-900">{stats.claimed}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-purple-400">
            <p className="text-sm text-gray-600">Professional (Paid)</p>
            <p className="text-2xl font-bold text-gray-900">{stats.professional}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {typeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Organizations List */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <FaSpinner className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
            <p className="text-gray-500 mt-4">Loading organizations...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-red-500">{error}</p>
          </div>
        ) : organizations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <FaBuilding className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No organizations found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="bg-white rounded-lg shadow-sm p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {org.logo ? (
                        <img
                          src={org.logo}
                          alt={org.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <FaBuilding className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <Link
                          href={`/org/${org.id}`}
                          className="text-lg font-semibold text-gray-900 hover:text-blue-600"
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
                      <p className="text-sm text-gray-500 mb-2">
                        {org.type.replace('_', ' ')}
                        {org.website && (
                          <>
                            <span className="mx-2">•</span>
                            <a
                              href={org.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                            >
                              Website <FaExternalLinkAlt className="w-3 h-3" />
                            </a>
                          </>
                        )}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
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
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="UNCLAIMED">Unclaimed</option>
                      <option value="CLAIMED">Claimed</option>
                      <option value="PROFESSIONAL">Professional</option>
                    </select>
                    <Link
                      href={`/org/${org.id}`}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200"
                    >
                      View
                    </Link>
                  </div>
                </div>

                {/* Sales Notes Section */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <FaNotes className="w-4 h-4" />
                      <span className="font-medium">Sales Notes</span>
                      {org.salesContactedAt && (
                        <span className="text-gray-400">
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
                        className="text-gray-400 hover:text-gray-600"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveNotes(org.id)}
                          disabled={savingNotes}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
                        >
                          {savingNotes ? (
                            <FaSpinner className="w-3 h-3 animate-spin" />
                          ) : (
                            <FaSave className="w-3 h-3" />
                          )}
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingNotesId(null);
                            setEditingNotesValue('');
                          }}
                          className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm flex items-center gap-1"
                        >
                          <FaTimes className="w-3 h-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {org.salesNotes || 'No notes yet. Click edit to add notes.'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
