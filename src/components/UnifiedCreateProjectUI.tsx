'use client';

import { useMemo, useState } from 'react';
import { projectEntryHref } from '@/lib/onboarding/professional-entry';
import { CreateProjectGuide } from '@/components/interviews/CreateProjectGuide';
import { COMPLETION_MONTHS, completionDateInputError } from '@/lib/projects/completionDate';
import { useRouter, useSearchParams } from 'next/navigation';
import { expertiseIntent } from '@/lib/publishing-studio/expertise-navigation';
import { useSession } from 'next-auth/react';

import { createProjectDraftWriter } from '@/lib/projects/saveProjectDraft';

// Unified Create Project UI - single form with optional advanced details
export default function UnifiedCreateProjectUI() {
  const [manualEntry, setManualEntry] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const operatingAsOrgId = (session?.user as any)?.operatingAsOrgId as string | null ?? null;
  const operatingAsOrgName = (session?.user as any)?.operatingAsOrg?.name as string | null ?? null;
  const writer = useMemo(() => createProjectDraftWriter(undefined, `folio:legacy-create:${session?.user?.id}:${operatingAsOrgId}`), [session?.user?.id, operatingAsOrgId]);
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [description, setDescription] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clientType, setClientType] = useState<'Residential' | 'Commercial'>('Residential');
  const [locationCity, setLocationCity] = useState('');
  const [locationRegion, setLocationRegion] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const dateError = completionDateInputError(year, month);
    if (dateError) { setErr(dateError); return; }

    setLoading(true);

    try {
      const id = await writer({
        title: name.trim(), description, projectStatus: 'completed_project', timeline: 'PAST',
        clientType: clientType === 'Residential' ? 'RESIDENTIAL' : 'COMMERCIAL',
        city: locationCity, regionState: locationRegion, designerOrgId: operatingAsOrgId,
        completedYear: Number(year), completedMonth: month ? Number(month) : null,
      });
        // Completed projects start with photographs.
        const next = new URLSearchParams({ view: 'media' });
        if (searchParams.has('expertiseTopic') || searchParams.has('expertiseProjects')) {
          const intent = expertiseIntent(searchParams.get('expertiseTopic'), searchParams.get('expertiseProjects'));
          next.set('expertiseTopic', intent.topic); next.set('expertiseProjects', intent.projectIds.join(','));
        }
        router.replace(`/project/${encodeURIComponent(id)}?${next}`);
    } catch (e: any) {
      setErr(e.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  if (!operatingAsOrgId) {
    return (
      <div className="min-h-screen bg-surface-ground flex items-center justify-center p-6">
        <div className="max-w-md w-full ridge-card p-8 text-center">
          <h1 className="text-2xl font-bold mb-4 text-folio-text-primary" style={{ fontFamily: 'var(--font-headline)' }}>Select a firm to create projects under</h1>
          <p className="text-folio-text-secondary mb-6">
            Find your firm or create one to share your work. Your personal account stays with you.
          </p>
          <button
            onClick={() => router.push(projectEntryHref(session?.user, `/designer/create?${searchParams.toString()}`))}
            className="rounded-lg px-6 py-2 bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors"
          >
            Find or create my firm
          </button>
        </div>
      </div>
    );
  }

  if (!manualEntry && session?.user?.id) return <CreateProjectGuide key={`${session.user.id}:${operatingAsOrgId}`} actorId={session.user.id} workspaceId={operatingAsOrgId} onManual={() => setManualEntry(true)} />;

  return (
    <div className="min-h-screen bg-surface-ground flex items-center justify-center p-6">
      <div className="max-w-2xl w-full ridge-card p-8">
        <h1 className="text-3xl font-bold mb-2 text-folio-text-primary" style={{ fontFamily: 'var(--font-headline)' }}>Add a completed project</h1>
        <p className="text-folio-text-secondary mb-6">
          Creating under <strong>{operatingAsOrgName || 'your firm'}</strong>
        </p>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2 text-folio-text-primary">Project Title *</label>
            <input
              className="w-full border border-folio-border-subtle rounded-lg px-4 py-3 focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all bg-white"
              placeholder="e.g., Modern Coastal Living Room"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-folio-text-primary">When was it completed?</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-folio-text-primary">Year *
                <input aria-label="Completion year" type="number" inputMode="numeric" min={1800} max={new Date().getUTCFullYear()} required value={year} onChange={event => setYear(event.target.value)} placeholder="e.g., 2024" className="mt-1 w-full border border-folio-border-subtle rounded-lg px-4 py-3 bg-white" />
              </label>
              <label className="block text-sm text-folio-text-primary">Month, if known
                <select aria-label="Completion month" value={month} onChange={event => setMonth(event.target.value)} className="mt-1 w-full border border-folio-border-subtle rounded-lg px-4 py-3 bg-white">
                  <option value="">Month unknown</option>
                  {COMPLETION_MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
                </select>
              </label>
            </div>
            <p className="text-sm text-folio-text-secondary">For older projects, the year alone is fine.</p>
          </fieldset>

          <div>
            <label className="block text-sm font-medium mb-2 text-folio-text-primary">Description (optional)</label>
            <textarea
              className="w-full border border-folio-border-subtle rounded-lg px-4 py-3 focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all bg-white"
              placeholder="Brief description of your project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Advanced Details Accordion */}
          <div className="border border-folio-border-subtle rounded-lg bg-white">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-ground transition-colors rounded-lg"
            >
              <span className="font-medium text-folio-text-primary">Advanced Details (optional)</span>
              <svg
                className={`w-5 h-5 text-folio-text-tertiary transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showAdvanced && (
              <div className="px-4 pb-4 pt-2 space-y-4 border-t border-folio-border-subtle">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-folio-text-primary">Client Type</label>
                    <div className="flex gap-4">
                      <label className="flex items-center text-folio-text-primary">
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
                      <label className="flex items-center text-folio-text-primary">
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
                    <label className="block text-sm font-medium mb-1 text-folio-text-primary">City</label>
                    <input
                      className="w-full border border-folio-border-subtle rounded-lg p-2 bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                      value={locationCity}
                      onChange={(e) => setLocationCity(e.target.value)}
                      placeholder="e.g., San Francisco"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-folio-text-primary">Region/State</label>
                    <input
                      className="w-full border border-folio-border-subtle rounded-lg p-2 bg-white focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
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

        <p className="text-xs text-folio-text-tertiary mt-6 text-center">
          Next: Upload images and tag products in the Media tab
        </p>
      </div>
    </div>
  );
}

