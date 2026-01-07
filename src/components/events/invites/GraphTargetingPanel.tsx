"use client";

import { useState } from 'react';
import { Target, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface GraphTargetingPanelProps {
  eventId: string;
  onSuccess?: (count: number) => void;
}

export default function GraphTargetingPanel({ eventId, onSuccess }: GraphTargetingPanelProps) {
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetSpecialties, setTargetSpecialties] = useState<string[]>([]);
  const [targetLocations, setTargetLocations] = useState<string[]>([]);
  const [minEngagementScore, setMinEngagementScore] = useState<number>(0.5);
  const [minProximityScore, setMinProximityScore] = useState<number>(0.5);
  const [limit, setLimit] = useState<number>(50);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);

  const roles = ['DESIGNER', 'VENDOR', 'REP'];
  const commonSpecialties = ['Residential', 'Commercial', 'Hospitality', 'Healthcare'];
  const commonLocations = ['New York', 'Los Angeles', 'San Francisco', 'Chicago', 'Miami'];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResults([]);

    try {
      const response = await fetch(`/api/events/${eventId}/invites/targeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRoles: targetRoles.length > 0 ? targetRoles : undefined,
          targetSpecialties: targetSpecialties.length > 0 ? targetSpecialties : undefined,
          targetLocations: targetLocations.length > 0 ? targetLocations : undefined,
          minEngagementScore,
          minProximityScore,
          limit,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data.contacts || []);
      } else {
        setResult({ success: false, error: data.error || 'Failed to generate list' });
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message || 'Failed to generate list' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendInvites = async () => {
    if (results.length === 0) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch(`/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: results.map((c) => ({
            email: c.email,
            name: c.name,
            role: c.role,
            source: 'graph_targeting',
          })),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, count: data.created });
        onSuccess?.(data.created);
        setResults([]);
      } else {
        setResult({ success: false, error: data.error || 'Failed to send invites' });
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message || 'Failed to send invites' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-ink mb-2">Graph-Based Targeting</h3>
        <p className="text-sm text-stone-500 mb-4">
          Use engagement data and proximity scores to find the best audience
        </p>
      </div>

      {/* Targeting Criteria */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-2">Target Roles</label>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => {
                  setTargetRoles(
                    targetRoles.includes(role)
                      ? targetRoles.filter((r) => r !== role)
                      : [...targetRoles, role]
                  );
                }}
                className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                  targetRoles.includes(role)
                    ? 'bg-accent-200 border-accent-400 text-accent-700'
                    : 'bg-white border-stone-300 text-stone-600 hover:border-stone-400'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-2">Specialties</label>
          <div className="flex flex-wrap gap-2">
            {commonSpecialties.map((spec) => (
              <button
                key={spec}
                onClick={() => {
                  setTargetSpecialties(
                    targetSpecialties.includes(spec)
                      ? targetSpecialties.filter((s) => s !== spec)
                      : [...targetSpecialties, spec]
                  );
                }}
                className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                  targetSpecialties.includes(spec)
                    ? 'bg-accent-200 border-accent-400 text-accent-700'
                    : 'bg-white border-stone-300 text-stone-600 hover:border-stone-400'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Min Engagement Score: {minEngagementScore.toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={minEngagementScore}
              onChange={(e) => setMinEngagementScore(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Min Proximity Score: {minProximityScore.toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={minProximityScore}
              onChange={(e) => setMinProximityScore(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-2">Limit Results</label>
          <input
            type="number"
            min="1"
            max="500"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg"
          />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full px-4 py-2 bg-ink text-white rounded-lg font-medium hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <Target className="w-4 h-4" />
            <span>Generate Targeted List</span>
          </>
        )}
      </button>

      {results.length > 0 && (
        <div className="border border-stone-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-ink">
              Found {results.length} matching contacts
            </h4>
            <button
              onClick={handleSendInvites}
              disabled={isSubmitting}
              className="px-4 py-2 bg-accent-700 text-white rounded-lg text-sm font-medium hover:bg-accent-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : 'Send Invites'}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {results.slice(0, 10).map((contact, idx) => (
              <div key={idx} className="text-sm text-stone-600 py-1">
                {contact.name || contact.email} {contact.engagementScore && `(${(contact.engagementScore * 100).toFixed(0)}% engagement)`}
              </div>
            ))}
            {results.length > 10 && (
              <div className="text-xs text-stone-400 pt-2">
                +{results.length - 10} more contacts
              </div>
            )}
          </div>
        </div>
      )}

      {result && (
        <div
          className={`p-4 rounded-lg flex items-start space-x-3 ${
            result.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            {result.success ? (
              <p className="text-sm text-green-800">
                Successfully sent {result.count} invites
              </p>
            ) : (
              <p className="text-sm text-red-800">{result.error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}




