import type { StudioFeedCard } from './types';

export const PUBLICATION_HISTORY_NAMESPACE = 'studio_publication_history_v1';
export interface PublicationHistoryEntry {
  sourceId: string; roomId?: string; revision: string;
  kind: 'published' | 'dismissed'; destination: 'instagram' | 'other' | null;
  headline: string; caption: string; angle: string; evidence: string[]; recordedAt: string;
}
export interface ProjectPublicationHistory { projectId: string; version: number; entries: PublicationHistoryEntry[] }

export function parseHistoryEntries(value: unknown): PublicationHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is PublicationHistoryEntry => Boolean(entry && typeof entry === 'object'
    && typeof entry.sourceId === 'string' && typeof entry.revision === 'string'
    && (entry.roomId === undefined || typeof entry.roomId === 'string')
    && ['published', 'dismissed'].includes(entry.kind)
    && (entry.kind === 'published' ? ['instagram', 'other'].includes(entry.destination) : entry.destination === null)
    && ['headline','caption','angle','recordedAt'].every(key => typeof entry[key] === 'string')
    && Array.isArray(entry.evidence) && entry.evidence.every((text: unknown) => typeof text === 'string'))).slice(0, 100);
}

const words = (text: string) => new Set((text.toLowerCase().match(new RegExp('[\\p{L}\\p{N}]+', 'gu')) || [])
  .filter((word: string) => word.length > 2 && !['the','and','for','with','that','this','from','into','was','were','our','its','their','have','has','had','are'].includes(word)));
function overlap(a: string, b: string) {
  const left = words(a), right = words(b);
  if (Math.min(left.size, right.size) < 4) return a.trim().length > 0 && a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
  return Array.from(left).filter(word => right.has(word)).length / Math.max(left.size, right.size);
}

/** A headline change is not a new story. Project introductions do not consume room stories. */
export function shouldSuppressPublication(card: Pick<StudioFeedCard, 'id' | 'roomId' | 'caption' | 'pitch'>, entries: PublicationHistoryEntry[]): boolean {
  return entries.some(entry => (entry.roomId ?? null) === (card.roomId ?? null)
    && ((entry.kind === 'published' && !card.roomId && card.id.startsWith('project:') && entry.sourceId === card.id)
      || Math.max(overlap(card.caption, entry.caption), overlap(card.pitch || card.caption, entry.angle)) >= (entry.sourceId === card.id ? 0.72 : 0.85)));
}
