'use client';

import { useState, useEffect } from 'react';

interface TerritoryAssignment {
  id: string;
  repUser: { id: string; name: string; profileImage: string | null; title: string | null };
  designerOrg: { id: string; name: string; type: string; logo: string | null };
  assignedAt: string;
  expiresAt: string | null;
}

interface TerritorySettings {
  territoryLockEnabled: boolean;
  dormancyThresholdDays: number;
}

interface OrgTerritoryManagerProps {
  orgId: string;
  isAdmin: boolean;
}

export default function OrgTerritoryManager({ orgId, isAdmin }: OrgTerritoryManagerProps) {
  const [settings, setSettings] = useState<TerritorySettings | null>(null);
  const [assignments, setAssignments] = useState<TerritoryAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`/api/org/${orgId}/settings/territory`).then((r) => r.json()),
      fetch(`/api/org/${orgId}/territory/assign`).then((r) => r.json()),
    ])
      .then(([settingsData, assignData]) => {
        setSettings(settingsData);
        setAssignments(assignData.assignments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [orgId, isAdmin]);

  async function toggleSoftLock() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/org/${orgId}/settings/territory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ territoryLockEnabled: !settings.territoryLockEnabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      // silent
    }
    setSaving(false);
  }

  async function updateThreshold(days: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/org/${orgId}/settings/territory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dormancyThresholdDays: days }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      // silent
    }
    setSaving(false);
  }

  async function removeAssignment(assignmentId: string) {
    try {
      const res = await fetch(`/api/org/${orgId}/territory/${assignmentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      }
    } catch {
      // silent
    }
  }

  if (!isAdmin) return null;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: '#E8E4DF' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Territory Settings */}
      <div className="bg-white rounded-lg border border-stone-200 p-5">
        <h3 className="text-sm font-medium text-stone-900 mb-4">Territory Protection</h3>

        {/* Soft lock toggle */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-stone-700">Enable soft lock</p>
            <p className="text-xs text-stone-400 mt-0.5">
              When a rep connects with a designer firm that another rep already services, both reps are notified.
            </p>
          </div>
          <button
            onClick={toggleSoftLock}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings?.territoryLockEnabled ? 'bg-green-500' : 'bg-stone-300'
            } ${saving ? 'opacity-50' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings?.territoryLockEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Dormancy threshold */}
        <div className="flex items-center justify-between pt-4 border-t border-stone-100">
          <div>
            <p className="text-sm text-stone-700">Dormancy threshold</p>
            <p className="text-xs text-stone-400 mt-0.5">
              Days of inactivity before a relationship is flagged as dormant.
            </p>
          </div>
          <select
            value={settings?.dormancyThresholdDays || 30}
            onChange={(e) => updateThreshold(parseInt(e.target.value))}
            disabled={saving}
            className="text-sm border border-stone-200 rounded-lg px-3 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
          >
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      {/* Territory Assignments */}
      <div className="bg-white rounded-lg border border-stone-200 p-5">
        <h3 className="text-sm font-medium text-stone-900 mb-1">Territory Assignments</h3>
        <p className="text-xs text-stone-400 mb-4">
          Assign reps to specific designer firm accounts. One primary rep per firm.
        </p>

        {assignments.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-6">
            No territory assignments yet. Assign reps from the Relationships tab by clicking on a relationship.
          </p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {a.designerOrg.logo ? (
                      <img src={a.designerOrg.logo} alt="" className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-stone-200 flex items-center justify-center text-xs font-medium text-stone-500">
                        {a.designerOrg.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-stone-900">{a.designerOrg.name}</p>
                    <p className="text-xs text-stone-400">
                      Assigned to <span className="text-stone-600">{a.repUser.name}</span>
                      {a.repUser.title && ` (${a.repUser.title})`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeAssignment(a.id)}
                  className="text-xs text-stone-400 hover:text-red-500 transition-colors px-2 py-1"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
