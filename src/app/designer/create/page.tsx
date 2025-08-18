'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type DetailsCore = {
  projectType: string;
  stage: string;
  clientType: 'Residential' | 'Commercial';
  location: { city: string; region: string; country?: string };
  budgetBand: string;
};

export default function CreateDesignerProjectPage() {
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
  const [whoami, setWhoami] = useState<any>(null);
  const [serverLogin, setServerLogin] = useState<any>(null);

  // fetch what the server sees
  useEffect(() => {
    fetch('/api/dev/whoami', { cache: 'no-store', credentials: 'same-origin' })
      .then(r => r.json()).then(setWhoami).catch(() => setWhoami(null));
  }, []);

  // DEV-ONLY: if the server doesn't see a Supabase session, auto-login via server route
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.NEXT_PUBLIC_AUTO_DEV_SUPABASE_LOGIN === 'true' &&
      whoami && !whoami.supabaseUserId
    ) {
      (async () => {
        const res = await fetch('/api/dev/supabase-login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ email: 'designer.demo@folioad.com', password: 'FolioDemo!2025' }),
        });
        const j = await res.json().catch(() => ({}));
        setServerLogin({ status: res.status, ...j });
        // refresh whoami after attempting login
        const r = await fetch('/api/dev/whoami', { cache: 'no-store', credentials: 'same-origin' });
        setWhoami(await r.json());
      })();
    }
  }, [whoami]);

  async function devSupabaseLogin() {
    // manual fallback button (still available)
    const res = await fetch('/api/dev/supabase-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: 'designer.demo@folioad.com', password: 'FolioDemo!2025' }),
    });
    const j = await res.json().catch(() => ({}));
    setServerLogin({ status: res.status, ...j });
    const r = await fetch('/api/dev/whoami', { cache: 'no-store', credentials: 'same-origin' });
    setWhoami(await r.json());
  }

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
      const sb = supabaseBrowser();
      const { data: sess } = await sb.auth.getSession();
      const token = sess?.session?.access_token;

      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.NEXT_PUBLIC_ALLOW_BEARER_FALLBACK === 'true' && token
            ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ name, description, detailsCore }),
      });
      if (!r.ok) {
        const t: any = await r.json().catch(() => ({}));
        throw new Error(t.error || 'Failed to create project');
      }
      const { id } = await r.json();
      router.replace(`/projects/${id}`);
    } catch (e: any) {
      setErr(e.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        {process.env.NODE_ENV !== 'production' && (
          <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm space-y-2">
            <div className="font-medium">Auth Debug</div>
            <div>Client origin: <code>{typeof window !== 'undefined' ? window.location.origin : ''}</code></div>
            <div>Server sees cookies: <code>{(whoami?.cookieNames || []).join(', ') || 'none'}</code></div>
            <div>Supabase user (server): <code>{whoami?.supabaseUserId || 'null'}</code></div>

            {serverLogin && (
              <div className="rounded bg-white p-2 border">
                <div>Server login status: <code>{serverLogin.status}</code></div>
                <div>ok: <code>{String(serverLogin.ok)}</code></div>
                <div>userId: <code>{serverLogin.userId || 'null'}</code></div>
                <div>error: <code>{serverLogin.error || 'none'}</code></div>
                <div>cookiesBefore: <code>{(serverLogin.cookiesBefore||[]).join(', ') || '[]'}</code></div>
                <div>cookiesAfter: <code>{(serverLogin.cookiesAfter||[]).join(', ') || '[]'}</code></div>
              </div>
            )}

            {!whoami?.supabaseUserId && (
              <button type="button" onClick={devSupabaseLogin} className="rounded border px-3 py-1">
                Dev: Sign in to Supabase as demo designer
              </button>
            )}
          </div>
        )}
        
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
      </div>
    </div>
  );
} 