import { flags } from '@/lib/flags';
import { safeNum } from './common';
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

const useDemo = (): boolean => {
  // Check flag (evaluated at build time)
  const flagEnabled = flags.vendorDemoData;
  
  // Check URL param (client-side only)
  const urlParamEnabled = isDemoParam();
  
  const result = flagEnabled || urlParamEnabled;
  
  // Diagnostic logging (remove after verification)
  if (typeof window !== 'undefined') {
    const urlParam = new URLSearchParams(window.location.search).get('demo');
    console.log('[DEMO] vendorDemoData flag:', flagEnabled);
    console.log('[DEMO] demo param from URL:', urlParam);
    console.log('[DEMO] isDemoParam() result:', urlParamEnabled);
    console.log('[DEMO] using demo data:', result);
    console.log('[DEMO] Current URL:', window.location.href);
  }
  
  return result;
};

/**
 * Vendor Event KPI Data Adapter
 * 
 * Provides event-related KPIs with demo data support for investor runs
 */

export type EventKPI = {
  totalRsvps: number | null;
  productsSaved: number | null;
  estProjectValueUsd: number | null;
  activeDesigners: number | null;
  deltas?: {
    rsvps?: number | null;
    saves?: number | null;
    value?: number | null;
    designers?: number | null;
  };
};

export type EventSummary = {
  id: string;
  name: string;
  city?: string;
  dateRange?: string;
  rsvps?: number | null;
  saves?: number | null;
  estValueUsd?: number | null;
  status: 'upcoming' | 'completed' | 'live';
};

/**
 * Fetch vendor event KPIs
 */
export async function fetchEventKPI(vendorId: string): Promise<EventKPI> {
  if (useDemo()) {
    try {
      const st = getInitialDemoState();
      console.log('[DEMO] returning mock event KPI data', st.events.portfolioTotals);
      return {
        totalRsvps: st.events.portfolioTotals.totalRsvps,
        productsSaved: st.events.portfolioTotals.productsSaved,
        estProjectValueUsd: st.events.portfolioTotals.estProjectValueUsd,
        activeDesigners: st.events.portfolioTotals.activeDesigners,
        deltas: st.events.portfolioTotals.deltas,
      };
    } catch (error) {
      console.error('[DEMO] Failed to load demo state:', error);
    }
  }

  try {
    // TODO: wire to real API endpoint
    // const response = await fetch(`/api/vendor/events/kpi?vendorId=${vendorId}`);
    // if (response.ok) return await response.json();
    
    return {
      totalRsvps: null,
      productsSaved: null,
      estProjectValueUsd: null,
      activeDesigners: null,
    };
  } catch {
    return {
      totalRsvps: null,
      productsSaved: null,
      estProjectValueUsd: null,
      activeDesigners: null,
    };
  }
}

/**
 * Fetch event summaries for listing
 */
export async function fetchEventSummaries(vendorId: string): Promise<EventSummary[]> {
  if (useDemo()) {
    const st = getInitialDemoState();
    return st.events.summaries.map((s: any) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      dateRange: s.dateRange,
      rsvps: s.rsvps ?? null,
      saves: s.saves ?? null,
      estValueUsd: s.estValueUsd ?? null,
      status: s.status as 'upcoming' | 'completed' | 'live',
    }));
  }

  try {
    // TODO: wire to real API endpoint
    return [];
  } catch {
    return [];
  }
}

/**
 * Fetch Event → Project Bridge metrics
 */
export async function fetchEventToProjectBridge(vendorId: string): Promise<{
  conversionPct: number | null;
  avgDays: number | null;
}> {
  if (useDemo()) {
    const st = getInitialDemoState();
    return {
      conversionPct: st.events.bridge.conversionPct,
      avgDays: st.events.bridge.avgDays,
    };
  }

  try {
    // TODO: wire to real API endpoint
    return { conversionPct: null, avgDays: null };
  } catch {
    return { conversionPct: null, avgDays: null };
  }
}

/**
 * Fetch event series data for charts
 */
export async function fetchEventSeries(vendorId: string): Promise<{
  eventPerformance: Array<{ event: string; avgRsvps: number }>;
  portfolioMomentum: Array<{ month: string; value: number }>;
}> {
  if (useDemo()) {
    const st = getInitialDemoState();
    return st.events.series;
  }
  return { eventPerformance: [], portfolioMomentum: [] };
}

// Legacy export for backward compatibility
export type VendorEventKPI = EventKPI;
export async function fetchVendorEventKPI(vendorId: string): Promise<VendorEventKPI> {
  return fetchEventKPI(vendorId);
}
