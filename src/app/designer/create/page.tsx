'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createProjectAction } from '@/app/actions/projects';
import DevDebugPanel from './DevDebugPanel';

type DetailsCore = {
  projectType: string;
  stage: string;
  clientType: 'Residential' | 'Commercial';
  location: { city: string; region: string; country?: string };
  budgetBand: string;
};

// Long form create UI (existing functionality)
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
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Create Project</h1>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Project name</label>
            <input
              className="w-full border rounded-lg p-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Casa Verde Renovation"
              required
            />
          </div>

          {/* Project basics section */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-medium mb-3">Project basics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Project Type *</label>
                <select
                  className="w-full border rounded-lg p-2"
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
                <label className="block text-sm font-medium mb-1">Stage *</label>
                <select
                  className="w-full border rounded-lg p-2"
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
                <label className="block text-sm font-medium mb-1">Client Type *</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="clientType"
                      value="Residential"
                      checked={clientType === 'Residential'}
                      onChange={(e) => setClientType(e.target.value as 'Residential' | 'Commercial')}
                      className="mr-2"
                      required
                    />
                    Residential
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="clientType"
                      value="Commercial"
                      checked={clientType === 'Commercial'}
                      onChange={(e) => setClientType(e.target.value as 'Residential' | 'Commercial')}
                      className="mr-2"
                    />
                    Commercial
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Budget Band *</label>
                <select
                  className="w-full border rounded-lg p-2"
                  value={budgetBand}
                  onChange={(e) => setBudgetBand(e.target.value)}
                  required
                >
                  <option value="">Select budget</option>
                  <option value="<$25k">&lt;$25k</option>
                  <option value="$25–100k">$25–100k</option>
                  <option value="$100–300k">$100–300k</option>
                  <option value="$300k–$1M">$300k–$1M</option>
                  <option value="$1M+">$1M+</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">City *</label>
                <input
                  className="w-full border rounded-lg p-2"
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  placeholder="e.g., San Francisco"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Region/State *</label>
                <input
                  className="w-full border rounded-lg p-2"
                  value={locationRegion}
                  onChange={(e) => setLocationRegion(e.target.value)}
                  placeholder="e.g., CA"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="w-full border rounded-lg p-2"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional project notes"
            />
          </div>

          {err && <p className="text-red-600 text-sm">{err}</p>}

          <button
            type="submit"
            className="px-4 py-2 rounded-lg border"
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Create project'}
          </button>
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-2">Create a Project</h1>
        <p className="text-gray-600 mb-6">Give your project a title to get started</p>
        
        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Project Title *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="e.g., Modern Coastal Living Room"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Description (optional)</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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

          <button 
            type="submit" 
            className="w-full rounded-lg px-6 py-3 bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          </button>
        </form>
        
        <p className="text-xs text-gray-500 mt-6 text-center">
          Next: Upload images and tag products
        </p>
        
        <DevDebugPanel />
      </div>
    </div>
  );
}

// Main page component
export default function CreateDesignerProjectPage({ 
  searchParams 
}: { 
  searchParams?: { intent?: string } 
}) {
  const intent = (searchParams?.intent ?? 'folder').toLowerCase();

  if (intent === 'folder') {
    return <LongFormCreateUI />;
  }

  if (intent === 'publish_now') {
    return <PublishNowFlow />;
  }

  // fallback: default to folder
  return <LongFormCreateUI />;
} 