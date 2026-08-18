import { flags } from '@/lib/flags';
import { getInitialDemoState } from './demoStore';

/**
 * Check if demo mode is enabled (via flag or URL param)
 * Works in both server and client contexts
 */
const isDemoParam = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('demo') === '1';
  } catch {
    return false;
  }
};

/**
 * NOT a React hook — a plain predicate. Named `isDemoDataEnabled` rather than
 * `useDemo` because the `use` prefix made rules-of-hooks treat every call site
 * as a conditional hook call, reporting violations in code that was correct.
 * A lint rule firing on sound code trains people to ignore it.
 */
const isDemoDataEnabled = (): boolean => {
  const flagEnabled = flags.vendorDemoData;
  const urlParamEnabled = isDemoParam();
  const result = flagEnabled || urlParamEnabled;
  
  // Diagnostic logging (remove after verification)
  if (typeof window !== 'undefined') {
    console.log('[DEMO] vendorDemoData flag:', flagEnabled);
    console.log('[DEMO] demo param:', new URLSearchParams(window.location.search).get('demo'));
    console.log('[DEMO] using demo data:', result);
  }
  
  return result;
};

/**
 * Vendor Project KPI Data Adapter
 * 
 * Provides project-related KPIs with demo data support for investor runs
 */

export type ProjectKPI = {
  saves: number | null;
  tags: number | null;
  influenceValueUsd: number | null;
  conversionPct: number | null;
};

/**
 * Fetch vendor project KPIs
 */
export async function fetchProjectKPI(vendorId: string): Promise<ProjectKPI> {
  if (isDemoDataEnabled()) {
    try {
      const st = getInitialDemoState();
      console.log('[DEMO] returning mock project KPI data', st.projects.kpi);
      return {
        saves: st.projects.kpi.saves,
        tags: st.projects.kpi.tags,
        influenceValueUsd: st.projects.kpi.influenceValueUsd,
        conversionPct: st.projects.kpi.conversionPct,
      };
    } catch (error) {
      console.error('[DEMO] Failed to load demo state:', error);
    }
  }

  try {
    // TODO: wire to real API endpoint
    // const response = await fetch(`/api/vendor/projects/kpi?vendorId=${vendorId}`);
    // if (response.ok) return await response.json();
    
    return {
      saves: null,
      tags: null,
      influenceValueUsd: null,
      conversionPct: null,
    };
  } catch {
    return {
      saves: null,
      tags: null,
      influenceValueUsd: null,
      conversionPct: null,
    };
  }
}

/**
 * Fetch top designers by influence
 */
export async function fetchTopDesigners(vendorId: string): Promise<Array<{
  id: string;
  name: string;
  influenceScore: number;
}>> {
  if (isDemoDataEnabled()) {
    const st = getInitialDemoState();
    return st.projects.topDesigners;
  }
  return [];
}

/**
 * Fetch tagged projects
 */
export async function fetchTaggedProjects(vendorId: string): Promise<Array<{
  id: string;
  title: string;
  tags: number;
  valueUsd: number;
}>> {
  if (isDemoDataEnabled()) {
    const st = getInitialDemoState();
    return st.projects.taggedProjects;
  }
  return [];
}

// Legacy export for backward compatibility
export type VendorProjectKPI = ProjectKPI;
export async function fetchVendorProjectKPI(vendorId: string): Promise<VendorProjectKPI> {
  return fetchProjectKPI(vendorId);
}
