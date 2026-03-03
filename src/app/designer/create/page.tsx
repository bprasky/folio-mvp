'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createProjectAction } from '@/app/actions/projects';
import DevDebugPanel from './DevDebugPanel';
import UnifiedCreateProjectUI from '@/components/UnifiedCreateProjectUI';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// DEPRECATED: Long form create UI (kept for reference, legacy links may still reference it)
function LongFormCreateUI() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState('');
  const [stage, setStage] = useState('');
  const [clientType, setClientType] = useState<'Residential' | 'Commercial'>('Residential');
  const [locationCity, setLocationCity] = useState('');
  const [locationRegion, setLocationRegion] = useState('');
  const [budgetBand, setBudgetBand] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    
    const detailsCore: DetailsCore = {
      projectType,
      stage,
      clientType,
      location: { city: locationCity, region: locationRegion, country: 'US' },
      budgetBand,
    };
    
    try {
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ name, description, detailsCore }),
      });
      
      if (r.status === 401) {
        setErr('You must be signed in as DESIGNER or ADMIN.');
      } else if (r.status === 403) {
        setErr('Your role is not permitted to create projects.');
      } else if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        setErr(errorData.error || 'Failed to create project.');
      } else {
        const json = await r.json();
        // API now returns { id: "..." } — just read id:
        const id = json?.id;
        if (!id) {
          setErr('Create API did not return an id.');
          return;
        }
        // Route to setup page for image upload + product tagging
        router.replace(`/project/${id}/setup`);
      }
    } catch (e: any) {
      setErr(e.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="folio-h1 text-[var(--text-primary)] mb-6">Create Project</h1>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block folio-body font-medium text-[var(--text-primary)] mb-1">Project name</label>
            <Input
              variant="ridge"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Casa Verde Renovation"
              required
            />
          </div>

          {/* Project basics section */}
          <div>
            <h3 className="folio-h3 text-[var(--text-primary)] mb-3">Project basics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block folio-body font-medium text-[var(--text-primary)] mb-1">Project Type *</label>
                <select
                  className="w-full ridge-input px-3 py-2"
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  required
                >
                  <option value="">Select project type</option>
                  <option value="New build">New build</option>
                  <option value="Whole-home renovation">Whole-home renovation</option>
                  <option value="Partial remodel">Partial remodel</option>
                  <option value="Spec house">Spec house</option>
                  <option value="Cosmetic refresh">Cosmetic refresh</option>
                  <option value="Commercial TI">Commercial TI</option>
                  <option value="Hospitality">Hospitality</option>
                  <option value="Multifamily">Multifamily</option>
                </select>
              </div>

              <div>
                <label className="block folio-body font-medium text-[var(--text-primary)] mb-1">Stage *</label>
                <select
                  className="w-full ridge-input px-3 py-2"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  required
                >
                  <option value="">Select stage</option>
                  <option value="Concept">Concept</option>
                  <option value="Schematic">Schematic</option>
                  <option value="Design Development">Design Development</option>
                  <option value="CD/Pre-spec">CD/Pre-spec</option>
                  <option value="Spec locked">Spec locked</option>
                  <option value="In procurement">In procurement</option>
                  <option value="Install">Install</option>
                </select>
              </div>

              <div>
                <label className="block folio-body font-medium text-[var(--text-primary)] mb-1">Client Type *</label>
                <div className="flex gap-4">
                  <label className="flex items-center text-[var(--text-primary)]">
                    <input
                      type="radio"
                      name="clientType"
                      value="Residential"
                      checked={clientType === 'Residential'}
                      onChange={(e) => setClientType(e.target.value as 'Residential' | 'Commercial')}
                      className="mr-2 accent-[var(--accent)]"
                      required
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
                <label className="block folio-body font-medium text-[var(--text-primary)] mb-1">Budget Band *</label>
                <select
                  className="w-full ridge-input px-3 py-2"
                  value={budgetBand}
                  onChange={(e) => setBudgetBand(e.target.value)}
                  required
                >
                  <option value="">Select budget</option>
                  <option value="<$25k">&lt;$25k</option>
                  <option value="$25–100k">$25-100k</option>
                  <option value="$100–300k">$100-300k</option>
                  <option value="$300k–$1M">$300k-$1M</option>
                  <option value="$1M+">$1M+</option>
                </select>
              </div>

              <div>
                <label className="block folio-body font-medium text-[var(--text-primary)] mb-1">City *</label>
                <Input
                  variant="ridge"
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  placeholder="e.g., San Francisco"
                  required
                />
              </div>

              <div>
                <label className="block folio-body font-medium text-[var(--text-primary)] mb-1">Region/State *</label>
                <Input
                  variant="ridge"
                  value={locationRegion}
                  onChange={(e) => setLocationRegion(e.target.value)}
                  placeholder="e.g., CA"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block folio-body font-medium text-[var(--text-primary)] mb-1">Description</label>
            <textarea
              className="w-full ridge-input px-3 py-2 min-h-[100px]"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional project notes"
            />
          </div>

          {err && <p className="text-red-600 text-sm">{err}</p>}

          <Button
            type="submit"
            variant="accent"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create project'}
          </Button>
        </form>

        <DevDebugPanel />
      </div>
    </div>
  );
}

// Canonical Quick Create flow (simple title → media/tagging)
function PublishNowFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await createProjectAction({ 
        name, 
        description: desc, 
        intent: 'publish_now' 
      });
      
      if (res?.ok && res.projectId) {
        // Route straight to media/tagging (use replace to prevent back button issues)
        const onboard = searchParams?.get('onboard') ?? '1';
        router.replace(`/project/${res.projectId}/setup?onboard=${onboard}`);
      } else {
        setErr('Failed to create project');
      }
    } catch (e: any) {
      setErr(e.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-6">
      <RidgeCard padding="xl" className="max-w-xl w-full">
        <h1 className="folio-h1 text-[var(--text-primary)] mb-2">Create a Project</h1>
        <p className="folio-body text-[var(--text-secondary)] mb-6">Give your project a title to get started</p>

        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="block folio-body font-medium text-[var(--text-primary)] mb-2">Project Title *</label>
            <Input
              variant="ridge"
              placeholder="e.g., Modern Coastal Living Room"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block folio-body font-medium text-[var(--text-primary)] mb-2">Description (optional)</label>
            <textarea
              className="w-full ridge-input px-4 py-3"
              placeholder="Brief description of your project..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
            />
          </div>

          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {err}
            </div>
          )}

          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Creating...
              </span>
            ) : (
              'Continue to Upload Images'
            )}
          </Button>
        </form>

        <p className="folio-meta mt-6 text-center">
          Next: Upload images and tag products
        </p>

        <DevDebugPanel />
      </RidgeCard>
    </div>
  );
}

// Main page component - unified flow
export default function CreateDesignerProjectPage() {
  // Legacy intent params are ignored - always show unified flow
  // This prevents 404s from old links while maintaining backward compatibility
  
  return (
    <>
      <UnifiedCreateProjectUI />
      <div className="fixed bottom-4 right-4">
        <DevDebugPanel />
      </div>
    </>
  );
} 