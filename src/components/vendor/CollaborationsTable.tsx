'use client';

import React, { useState, useEffect } from 'react';
import { FaEdit, FaPause, FaPlay, FaDollarSign } from 'react-icons/fa';

interface Collaboration {
  id: string;
  project: {
    id: string;
    name: string;
  };
  designer: {
    id: string;
    name: string;
    email: string;
  } | null;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'ENDED';
  spendEnabled: boolean;
  spendPerSaveUsd: number | null;
  spendPerClickUsd: number | null;
  budgetCapUsd: number | null;
  signals: {
    savesCount: number;
    clicksCount: number;
    spendUsd: number;
    budgetUsedPct: number;
    lastSignalAt: string | null;
  };
  activatedAt: string | null;
  pausedAt: string | null;
  createdAt: string;
}

interface CollaborationsTableProps {
  vendorOrgId: string;
}

export default function CollaborationsTable({ vendorOrgId }: CollaborationsTableProps) {
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Collaboration>>({});

  useEffect(() => {
    fetchCollaborations();
  }, [vendorOrgId]);

  const fetchCollaborations = async () => {
    try {
      const res = await fetch('/api/vendor/collaborations');
      if (res.ok) {
        const data = await res.json();
        setCollaborations(data.collaborations || []);
      }
    } catch (error) {
      console.error('Error fetching collaborations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (collab: Collaboration) => {
    setEditingId(collab.id);
    setEditForm({
      spendEnabled: collab.spendEnabled,
      spendPerSaveUsd: collab.spendPerSaveUsd,
      spendPerClickUsd: collab.spendPerClickUsd,
      budgetCapUsd: collab.budgetCapUsd,
      collaborationStatus: collab.status,
    });
  };

  const handleSave = async (id: string) => {
    try {
      const res = await fetch(`/api/vendor/collaborations/${id}/spend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        setEditingId(null);
        fetchCollaborations();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update');
      }
    } catch (error) {
      console.error('Error updating collaboration:', error);
      alert('Failed to update collaboration');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/vendor/collaborations/${id}/spend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collaborationStatus: newStatus }),
      });

      if (res.ok) {
        fetchCollaborations();
      }
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      ACTIVE: 'bg-green-100 text-green-800',
      PAUSED: 'bg-surface-ground text-folio-text-primary',
      ENDED: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || colors.PENDING}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return <div className="p-4">Loading collaborations...</div>;
  }

  if (collaborations.length === 0) {
    return (
      <div className="p-8 text-center text-folio-text-secondary">
        <p>No collaborations found. Collaborations are created when vendors participate in designer projects.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-folio-border-subtle overflow-hidden">
      <div className="px-6 py-4 border-b border-folio-border-subtle">
        <h2 className="text-lg font-semibold text-folio-text-primary">Discovery Budget Collaborations</h2>
        <p className="text-sm text-folio-text-secondary mt-1">Manage spend settings for designer collaborations</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--ridge-outer)]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Project
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Designer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Saves
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Clicks
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Spend (month)
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Budget Cap
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                % Used
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Last Signal
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[var(--ridge-outer)]">
            {collaborations.map((collab) => (
              <tr key={collab.id} className="hover:bg-surface-ground">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-folio-text-primary">{collab.project.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {collab.designer ? (
                    <div className="text-sm text-folio-text-primary">{collab.designer.name}</div>
                  ) : (
                    <div className="text-sm text-folio-text-tertiary">—</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(collab.status)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-folio-text-primary">
                  {collab.signals.savesCount}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-folio-text-primary">
                  {collab.signals.clicksCount}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-folio-text-primary">
                  ${collab.signals.spendUsd.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-folio-text-secondary">
                  {collab.budgetCapUsd ? `$${collab.budgetCapUsd.toFixed(2)}` : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end">
                    <div className="w-16 bg-surface-ground rounded-full h-2 mr-2">
                      <div
                        className={`h-2 rounded-full ${
                          collab.signals.budgetUsedPct > 90
                            ? 'bg-red-500'
                            : collab.signals.budgetUsedPct > 75
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, collab.signals.budgetUsedPct)}%` }}
                      />
                    </div>
                    <span className="text-sm text-folio-text-secondary">{collab.signals.budgetUsedPct.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-folio-text-secondary">
                  {collab.signals.lastSignalAt
                    ? new Date(collab.signals.lastSignalAt).toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEdit(collab)}
                      className="text-[var(--accent)] hover:text-blue-800"
                      title="Edit spend settings"
                    >
                      <FaEdit />
                    </button>
                    {(collab.status === 'ACTIVE' || collab.status === 'PAUSED') && (
                      <button
                        onClick={() => handleToggleStatus(collab.id, collab.status)}
                        className="text-folio-text-secondary hover:text-folio-text-primary"
                        title={collab.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                      >
                        {collab.status === 'ACTIVE' ? <FaPause /> : <FaPlay />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit Discovery Budget Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-folio-text-primary mb-1">
                  <input
                    type="checkbox"
                    checked={editForm.spendEnabled ?? false}
                    onChange={(e) => setEditForm({ ...editForm, spendEnabled: e.target.checked })}
                    className="mr-2"
                  />
                  Enable spend
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-folio-text-primary mb-1">
                  Spend per Save ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.spendPerSaveUsd ?? ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, spendPerSaveUsd: e.target.value ? parseFloat(e.target.value) : null })
                  }
                  className="w-full border border-folio-border-subtle rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-folio-text-primary mb-1">
                  Spend per Click ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.spendPerClickUsd ?? ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, spendPerClickUsd: e.target.value ? parseFloat(e.target.value) : null })
                  }
                  className="w-full border border-folio-border-subtle rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-folio-text-primary mb-1">
                  Budget Cap ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.budgetCapUsd ?? ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, budgetCapUsd: e.target.value ? parseFloat(e.target.value) : null })
                  }
                  className="w-full border border-folio-border-subtle rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-folio-text-primary mb-1">Status</label>
                <select
                  value={editForm.collaborationStatus ?? 'PENDING'}
                  onChange={(e) => setEditForm({ ...editForm, collaborationStatus: e.target.value as any })}
                  className="w-full border border-folio-border-subtle rounded-lg px-3 py-2"
                >
                  <option value="PENDING">Pending</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                  <option value="ENDED">Ended</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2 border border-folio-border-subtle rounded-lg text-folio-text-primary hover:bg-surface-ground"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(editingId)}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}








