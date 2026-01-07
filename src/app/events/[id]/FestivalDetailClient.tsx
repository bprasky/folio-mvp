"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import FlowMosaic from "../../../components/feed/FlowMosaic";

const dev = process.env.NODE_ENV !== "production";

const toStr = (v: any) => (v == null ? "" : String(v));
const toISO = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v;         // assume server sent ISO already
  try { return (v as Date).toISOString(); } catch { return null; }
};

const getTypes = (e: any): string[] =>
  Array.isArray(e?.eventTypes) ? e.eventTypes.map((t: any) => String(t)) : [];

const getTitle = (e: any) => toStr(e?.title ?? e?.name);

const getImageUrl = (e: any) =>
  e?.heroImageUrl || e?.coverImageUrl || e?.imageUrl || "";

const parseOk = (iso: string | null) => !!iso && !Number.isNaN(Date.parse(iso!));



type FestivalDetailClientProps = {
  festival: any;             // from EVENT_SELECT_FULL (server-fetched)
  initialEvents: Array<{
    id: string;
    title?: string | null;
    name?: string | null;
    description?: string | null;
    startsAt?: string | Date | null;
    endsAt?: string | Date | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    city?: string | null;
    venue?: string | null;
    festivalId?: string | null;
    eventTypes?: string[] | null;
    heroImageUrl?: string | null;
    coverImageUrl?: string | null;
    imageUrl?: string | null;
  }>;
  canEdit?: boolean;
  festivalId?: string;     // optional if needed
};

export default function FestivalDetailClient({ festival, initialEvents, canEdit = false, festivalId }: FestivalDetailClientProps) {
  const { data: session } = useSession();
  const [events, setEvents] = useState(() =>
    (initialEvents ?? []).map(e => ({
      ...e,
      title: String(e?.title ?? e?.name ?? ""),
      eventTypes: Array.isArray(e?.eventTypes) ? e.eventTypes.map(String) : [],
    }))
  );
  
  // State for toolbar controls
  const [viewMode, setViewMode] = useState<"festival"|"grid"|"list">("festival");
  const [sortMode, setSortMode] = useState<"chronological"|"trending"|"most-buzz">("chronological");
  const [sortOption, setSortOption] = useState<'trending' | 'chronological' | 'most-rsvps' | 'category'>('trending');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');

  // Use the passed canEdit prop, fallback to session-based check
  const userCanEdit = canEdit || (session?.user as any)?.role === 'ADMIN';

  const stage = { total: events.length };
  let pass = events.slice();

  if (dev) console.log("[filter] total:", stage.total);

  // (a) TYPE FILTER (tolerant)
  if (eventTypeFilter && eventTypeFilter !== 'all') {
    const set = new Set([eventTypeFilter]);
    pass = pass.filter(e => {
      const types = Array.isArray(e.eventTypes) ? e.eventTypes : [];
      if (types.length === 0) return true;          // ← DO NOT exclude untyped
      return types.some(t => set.has(String(t)));
    });
  }
  if (dev) console.log("[filter] after type:", pass.length);

  // (b) SEARCH FILTER (tolerant) - DISABLED for now
  // const q = toStr(searchQuery).toLowerCase();
  // if (q) {
  //   pass = pass.filter(e => {
  //     const hay = [
  //       getTitle(e),
  //       toStr(e?.description),
  //       toStr(e?.city),
  //       toStr(e?.venue),
  //     ].join(" ").toLowerCase();
  //     return hay.includes(q);
  //   });
  // }
  // if (dev) console.log("[filter] after search:", pass.length);

  // (c) IMAGE FILTER — DISABLED by default (only apply if you have an explicit toggle)
  // if (Boolean(showOnlyWithImage)) {
  //   pass = pass.filter(e => !!getImageUrl(e));
  // }
  // if (dev) console.log("[filter] after image:", pass.length);

  // (d) DATE FILTER — DISABLED for now to avoid excluding seeded rows
  // If you really need it, make it tolerant like below and guard with a toggle.
  // if (false /* ENABLE_DATE_FILTER */) {
  //   pass = pass.filter(e => {
  //     const s = toISO(e.startsAt as any);
  //     const en = toISO(e.endsAt as any);
  //     // if neither date parses, DO NOT exclude
  //     if (!parseOk(s) && !parseOk(en)) return true;
  //     // example "upcoming" rule (customize as needed):
  //     const now = Date.now();
  //     const startMs = parseOk(s) ? Date.parse(s!) : now;
  //     const endMs   = parseOk(en) ? Date.parse(en!) : startMs;
  //     return endMs >= now; // keep anything not ended yet
  //   });
  // }
  // if (dev) console.log("[filter] after date:", pass.length);

  // (e) SORT (tolerant)
  switch (sortOption) {
    case 'trending':
    case 'most-rsvps':
      pass.sort((a, b) => ((b as any).rsvpCount ?? 0) - ((a as any).rsvpCount ?? 0));
      break;
    case 'chronological':
      pass.sort((a, b) => {
        const as = parseOk(a?.startsAt as any) ? Date.parse(a.startsAt as string) : 0;
        const bs = parseOk(b?.startsAt as any) ? Date.parse(b.startsAt as string) : 0;
        if (as !== bs) return as - bs;
        return getTitle(a).localeCompare(getTitle(b));
      });
      break;
    case 'category':
      pass.sort((a, b) => getTitle(a).toLowerCase().localeCompare(getTitle(b).toLowerCase()));
      break;
  }

  // derive filteredAndSortedEvents = useMemo(... sortMode, filters over events ...)
  const filteredAndSortedEvents = useMemo(() => {
    let result = events.slice();

    // Apply category filter
    if (selectedCategory && selectedCategory !== 'all') {
      result = result.filter(event => {
        const name = getTitle(event).toLowerCase();
        if (selectedCategory === 'party') return name.includes('party') || name.includes('celebration');
        if (selectedCategory === 'talk') return name.includes('talk') || name.includes('keynote') || name.includes('presentation');
        if (selectedCategory === 'workshop') return name.includes('workshop') || name.includes('class');
        if (selectedCategory === 'showroom') return name.includes('showroom') || name.includes('tour');
        if (selectedCategory === 'networking') return name.includes('networking') || name.includes('meet');
        return true;
      });
    }

    // Apply event type filter
    if (eventTypeFilter && eventTypeFilter !== 'all') {
      result = result.filter(event => {
        const types = Array.isArray(event.eventTypes) ? event.eventTypes : [];
        if (types.length === 0) return true;
        return types.some(t => String(t).toLowerCase() === eventTypeFilter);
      });
    }

    // Apply sorting
    switch (sortMode) {
      case 'chronological':
        result.sort((a, b) => {
          const as = parseOk(a?.startsAt as any) ? Date.parse(a.startsAt as string) : 0;
          const bs = parseOk(b?.startsAt as any) ? Date.parse(b.startsAt as string) : 0;
          if (as !== bs) return as - bs;
          return getTitle(a).localeCompare(getTitle(b));
        });
        break;
      case 'trending':
        result.sort((a, b) => ((b as any).rsvpCount ?? 0) - ((a as any).rsvpCount ?? 0));
        break;
      case 'most-buzz':
        result.sort((a, b) => {
          const aScore = ((a as any).rsvpCount ?? 0) * 3 + ((a as any).viewCount ?? 0);
          const bScore = ((b as any).rsvpCount ?? 0) * 3 + ((b as any).viewCount ?? 0);
          return bScore - aScore;
        });
        break;
    }

    return result;
  }, [events, selectedCategory, eventTypeFilter, sortMode]);

  // Get unique event types for filter dropdown
  const eventTypes = ['all', 'talk', 'exhibition', 'party', 'workshop', 'networking', 'demo'];
  
  // Get unique categories from events
  const categories = useMemo(() => {
    const cats = events.map(event => {
      const name = getTitle(event).toLowerCase();
      if (name.includes('party') || name.includes('celebration')) return 'party';
      if (name.includes('talk') || name.includes('keynote') || name.includes('presentation')) return 'talk';
      if (name.includes('workshop') || name.includes('class')) return 'workshop';
      if (name.includes('showroom') || name.includes('tour')) return 'showroom';
      if (name.includes('networking') || name.includes('meet')) return 'networking';
      return 'other';
    });
    return ['all', ...Array.from(new Set(cats))];
  }, [events]);

  return (
    <div className="pt-0">
      {/* Festival Banner/Hero */}
      <div className="relative w-full h-64 md:h-80 lg:h-96 bg-gradient-to-br from-folio-accent to-folio-accent-dark">
        {festival?.imageUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${festival.imageUrl})` }}
          />
        )}
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 flex flex-col justify-end h-full p-6 md:p-8">
          <div className="max-w-4xl mx-auto w-full">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">
              {festival?.title || 'Festival'}
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-4 max-w-2xl">
              {festival?.description || 'Join us for an amazing festival experience'}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-white/80">
              <div className="flex items-center gap-2">
                <span className="text-lg">📍</span>
                <span>{festival?.location || 'Location TBD'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">📅</span>
                <span>
                  {festival?.startDate && festival?.endDate 
                    ? `${new Date(festival.startDate).toLocaleDateString()} - ${new Date(festival.endDate).toLocaleDateString()}`
                    : 'Dates TBD'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Single compact sticky controls bar */}
      <div className="sticky top-0 z-30 mt-2 mb-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-folio-border bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 px-3 sm:px-4 py-2 shadow-sm text-sm">
          {/* LEFT: Sort */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-gray-500">Sort:</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as "chronological"|"trending"|"most-buzz")}
              className="h-9 px-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-folio-accent"
            >
              <option value="chronological">📅 Chronological</option>
              <option value="trending">🔥 Trending</option>
              <option value="most-buzz">💬 Most Buzz</option>
            </select>
          </div>
          
          {/* MIDDLE: Category + Type */}
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 px-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-folio-accent"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="h-9 px-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-folio-accent"
            >
              {eventTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
          
          {/* RIGHT: Count */}
          <div className="ml-auto">
            <span className="hidden md:inline text-gray-500">{filteredAndSortedEvents.length} events</span>
          </div>
        </div>
      </div>

      {/* Feed section (minimal top margin) */}
      <div className="mt-2">
        {filteredAndSortedEvents.length > 0 ? (
          <FlowMosaic events={filteredAndSortedEvents as any[]} canEdit={userCanEdit} />
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎭</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {filteredAndSortedEvents.length === 0 ? 'No events found for this festival' : 'No events match your filters'}
            </h3>
            <p className="text-gray-600 mb-4">
              {filteredAndSortedEvents.length === 0 
                ? 'This festival doesn\'t have any events yet.'
                : 'Try adjusting your filters to see more events.'
              }
            </p>
            {eventTypeFilter !== 'all' && (
              <button
                onClick={() => setEventTypeFilter('all')}
                className="text-folio-accent hover:text-folio-accent-dark transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 