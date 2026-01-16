'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ProjectStatus = 'new_project' | 'completed_project';

type DetailsCore = {
  clientType: 'Residential' | 'Commercial';
  location: { city: string; region: string; country?: string };
};

// Unified Create Project UI - single form with optional advanced details
export default function UnifiedCreateProjectUI() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | ''>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clientType, setClientType] = useState<'Residential' | 'Commercial'>('Residential');
  const [locationCity, setLocationCity] = useState('');
  const [locationRegion, setLocationRegion] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    // Validate required project status
    if (!projectStatus) {
      setErr('Please select a project status.');
      return;
    }

    setLoading(true);

    const detailsCore: DetailsCore = {
      clientType,
      location: { city: locationCity, region: locationRegion, country: 'US' },
    };

    try {
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ name, description, projectStatus, detailsCore }),
      });

      if (r.status === 401) {
        setErr('You must be signed in to create projects.');
      } else if (r.status === 403) {
        setErr('You must be a member of a design firm to create projects.');
      } else if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        setErr(errorData.error || 'Failed to create project.');
      } else {
        const json = await r.json();
        const id = json?.id;
        if (!id) {
          setErr('Create API did not return an id.');
          return;
        }
        // Both new and completed projects go to media tab to upload images
        router.replace(`/project/${id}?view=media`);
      }
    } catch (e: any) {
      setErr(e.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-elevated)] flex items-center justify-center p-6">
      <div className="max-w-2xl w-full ridge-card p-8">
        <h1 className="text-3xl font-bold mb-2 text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-headline)' }}>Create a Project</h1>
        <p className="text-[var(--text-secondary)] mb-6">Give your project a title to get started</p>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">Project Title *</label>
            <input
              className="w-full border border-[var(--border)] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all bg-white"
              placeholder="e.g., Modern Coastal Living Room"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">Description (optional)</label>
            <textarea
              className="w-full border border-[var(--border)] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all bg-white"
              placeholder="Brief description of your project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">Project Status *</label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="projectStatus"
                  value="new_project"
                  checked={projectStatus === 'new_project'}
                  onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)}
                  className="mr-2 accent-[var(--accent)]"
                />
                <span className="text-[var(--text-primary)]">New Project</span>
                <span className="ml-2 text-xs text-[var(--text-tertiary)]">(still in progress)</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="projectStatus"
                  value="completed_project"
                  checked={projectStatus === 'completed_project'}
                  onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)}
                  className="mr-2 accent-[var(--accent)]"
                />
                <span className="text-[var(--text-primary)]">Completed Project</span>
                <span className="ml-2 text-xs text-[var(--text-tertiary)]">(ready to showcase)</span>
              </label>
            </div>
          </div>

          {/* Advanced Details Accordion */}
          <div className="border border-[var(--border)] rounded-lg bg-white">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--bg-elevated)] transition-colors rounded-lg"
            >
              <span className="font-medium text-[var(--text-primary)]">Advanced Details (optional)</span>
              <svg
                className={`w-5 h-5 text-[var(--text-tertiary)] transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showAdvanced && (
              <div className="px-4 pb-4 pt-2 space-y-4 border-t border-[var(--border)]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-[var(--text-primary)]">Client Type</label>
                    <div className="flex gap-4">
                      <label className="flex items-center text-[var(--text-primary)]">
                        <input
                          type="radio"
                          name="clientType"
                          value="Residential"
                          checked={clientType === 'Residential'}
                          onChange={(e) => setClientType(e.target.value as 'Residential' | 'Commercial')}
                          className="mr-2 accent-[var(--accent)]"
                        />
                        Residential
                      </label>
                      <label className="flex items-center text-[var(--text-primary)]">
                        <input
                          type="radio"
                          name="clientType"
                          value="Commercial"
                          checked={clientType === 'Commercial'}
                          onChange={(e) => setClientType(e.target.value as 'Residential' | 'Commercial')}
                          className="mr-2 accent-[var(--accent)]"
                        />
                        Commercial
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-[var(--text-primary)]">City</label>
                    <input
                      className="w-full border border-[var(--border)] rounded-lg p-2 bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                      value={locationCity}
                      onChange={(e) => setLocationCity(e.target.value)}
                      placeholder="e.g., San Francisco"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-[var(--text-primary)]">Region/State</label>
                    <input
                      className="w-full border border-[var(--border)] rounded-lg p-2 bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                      value={locationRegion}
                      onChange={(e) => setLocationRegion(e.target.value)}
                      placeholder="e.g., CA"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {err}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-lg px-6 py-3 bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Creating...
              </span>
            ) : (
              'Create Project'
            )}
          </button>
        </form>

        <p className="text-xs text-[var(--text-tertiary)] mt-6 text-center">
          Next: Upload images and tag products in the Media tab
        </p>
      </div>
    </div>
  );
}

