import type { UIEvent } from "@/lib/normalizeEvent";
export type Size = "L" | "M" | "S";

export function score(e: UIEvent) {
  const rsvp = Math.log1p(e.rsvpCount ?? 0);
  const views = 0.6 * Math.log1p(e.viewCount ?? 0);
  const party = e.eventTypes.some(t => ["PARTY","LAUNCH","KEYNOTE"].includes(t)) ? 1 : 0;
  return rsvp + views + 1.25 * (e.promotionTier ?? 0) + party;
}

// Top 20% => L, next 40% => M, else S. promotionTier forces L.
export function bucketByPercentiles(es: UIEvent[]) {
  const scored = es.map(e => ({ e, s: score(e) }));
  const ordered = [...scored].sort((a,b) => b.s - a.s);
  const n = ordered.length || 1;
  const p80 = ordered[Math.floor(n * 0.20)]?.s ?? Infinity;
  const p40 = ordered[Math.floor(n * 0.60)]?.s ?? 0;
  return ordered.map(x => ({
    id: x.e.id,
    size: x.e.promotionTier ? "L" : (x.s >= p80 ? "L" : (x.s >= p40 ? "M" : "S")),
  }));
} 