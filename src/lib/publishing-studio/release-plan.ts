import type { StudioFeedCard } from './types';
export type ReleasePlanItem = { sourceId: string; revision: string; planningDate: string | null };
export type ReleaseOption = { publication?: { kind: 'published' | 'dismissed'; destination: 'instagram' | 'other' | null }; preview?: StudioFeedCard['preview']; sourceId: string; revision: string; kind: 'introduction' | 'room'; title: string; caption: string; imageUrl: string | null; roomId?: string; editorHref: string; status: 'prepared' | 'draft_saved' | 'export_generated' };
export type ReleasePlanResponse = {
  project: { id: string; title: string }; purpose: string; options: ReleaseOption[];
  plan: { version: number; items: ReleasePlanItem[]; needsReview: boolean } | null;
};
export type ReleaseOpportunity = { historySourceId?: string; title?: string; preview?: StudioFeedCard['preview']; projectId: string; projectTitle: string; imageUrl: string | null; purpose: string; reason: string; roomCount: number; hasPlan: boolean; sourceIds: string[]; needsReview?: boolean };
export type ReleaseDiscovery = { opportunities: ReleaseOpportunity[]; plans: ReleaseOpportunity[] };

/** Dates are personal planning notes, never a scheduler or publication claim. */
export function validPlanningDate(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateReleaseItems(value: unknown, options: ReleaseOption[]): ReleasePlanItem[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4) return null;
  const ids = new Set<string>();
  for (let index = 0; index < value.length; index++) {
    const item = value[index];
    if (!item || typeof item !== 'object' || typeof item.sourceId !== 'string' || ids.has(item.sourceId)) return null;
    const option = options.find(option => option.sourceId === item.sourceId && option.revision === item.revision);
    if (!option || option.kind !== (index === 0 ? 'introduction' : 'room') || !validPlanningDate(item.planningDate)) return null;
    ids.add(item.sourceId);
  }
  return value.map(item => ({ sourceId: item.sourceId, revision: item.revision, planningDate: item.planningDate }));
}
