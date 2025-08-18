'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaHeart, FaFilter, FaTh, FaList, FaEdit } from 'react-icons/fa';
import FestivalEditOverlay from '@/components/feed/FestivalEditOverlay';
import EventBadge from './EventBadge';
import dynamic from "next/dynamic";
import FlowFeed from "@/components/feed/FlowFeed";
import FlowMosaic from "@/components/feed/FlowMosaic";
import { useSearchParams } from "next/navigation";

const GridInspector = process.env.NODE_ENV !== "production"
  ? dynamic(() => import("@/components/dev/GridInspector"), { ssr: false })
  : (() => null);

function fmtTime(v: unknown) {
  if (v == null) return "";
  // If it's already a Date
  if (v instanceof Date) {
    const hh = String(v.getHours()).padStart(2, "0");
    const mm = String(v.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  // If it's a string (ISO or "HH:MM[:SS]")
  const s = String(v);
  // ISO like "2025-08-13T14:37:00Z" → capture HH:MM
  const iso = s.match(/T(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}`;
  // Plain "HH:MM[:SS]" → normalize to HH:MM
  const parts = s.split(":");
  if (parts.length >= 2) {
    const hh = parts[0].padStart(2, "0");
    const mm = parts[1].padStart(2, "0");
    return `${hh}:${mm}`;
  }
  // Fallback: just take first 5 chars if long enough
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function getTitle(e: { title?: string | null; name?: string | null }) {
  return String(e?.title ?? e?.name ?? "");
}

function fmtDateISO(v: unknown) {
  if (!v) return "";
  const s = typeof v === "string" ? v : (v as Date)?.toISOString?.() ?? "";
  // Expecting ISO; show YYYY-MM-DD
  return s ? s.slice(0, 10) : "";
}

function getAuthorName(e: any): string {
  // Prefer nested relation, fall back to flat fields if present
  const n =
    e?.createdBy?.name ??
    e?.createdByName ??
    e?.authorName ??
    e?.ownerName ??
    null;
  return typeof n === "string" ? n : "";
}

function getImageUrl(e: any) {
  return e?.heroImageUrl || e?.coverImageUrl || e?.imageUrl || "";
}

const isUntyped = (e:any) => !Array.isArray(e?.eventTypes) || e.eventTypes.length === 0;

const toStr = (v:any) => (v == null ? "" : String(v));
const toISO = (v:any): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v;
  try { return (v as Date).toISOString(); } catch { return null; }
};

type UIEvent = {
  id: string;
  title?: string | null;
  name?: string | null;
  date?: string;
  time?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  location?: string;
  city?: string | null;
  venue?: string | null;
  description?: string;
  imageUrl?: string;
  heroImageUrl?: string | null;
  coverImageUrl?: string | null;
  rsvp_count?: number;
  rsvp_change_24h?: number;
  created_at?: string;
  eventTypes?: string[] | null;
  createdBy?: { name?: string | null } | null;
  createdByName?: string | null;
  badges?: string[];
};

interface FestivalEvent extends UIEvent {
  name: string;
  date: string;
  time: string;
  location: string;
  description: string;
  rsvp_count: number;
  createdBy: {
    id: string;
    name: string;
    companyName?: string;
  };
}

interface FestivalFibonacciFeedProps {
  events: FestivalEvent[];
  canEdit?: boolean;
  viewMode?: 'festival' | 'list' | 'grid';
}

type SortOption = 'trending' | 'chronological' | 'most-rsvps' | 'category';
type ViewMode = 'festival' | 'list' | 'grid';

export default function FestivalFibonacciFeed({ events, canEdit = false, viewMode = 'festival' }: FestivalFibonacciFeedProps) {
  const dev = process.env.NODE_ENV !== 'production';
  
  const [sortOption, setSortOption] = useState<SortOption>('trending');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const search = useSearchParams();
  const flowToggle = search?.get("flow");
  const enableFlow = flowToggle !== "0"; // default ON, ?flow=0 disables

  // Find the variable that controls the current view (often `view` or `selectedView`).
  const rawView = viewMode ?? 'festival';
  const viewKey = String(rawView).toLowerCase();

  if (dev) {
    console.log('[FestivalFeed] view=', viewKey, 'events=', (events?.length ?? 0));
  }

  // Ensure events is an array
  const safeEvents = Array.isArray(events) ? events : [];



  // Get unique categories from events
  const categories = useMemo(() => {
    const cats = safeEvents.map(event => {
      // Extract category from event name or description
      const name = getTitle(event).toLowerCase();
      if (name.includes('party') || name.includes('celebration')) return 'party';
      if (name.includes('talk') || name.includes('keynote') || name.includes('presentation')) return 'talk';
      if (name.includes('workshop') || name.includes('class')) return 'workshop';
      if (name.includes('showroom') || name.includes('tour')) return 'showroom';
      if (name.includes('networking') || name.includes('meet')) return 'networking';
      return 'other';
    });
    return ['all', ...Array.from(new Set(cats))];
  }, [safeEvents]);

  // Sort and filter events
  const sortedEvents = useMemo(() => {
    let filtered = safeEvents;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = safeEvents.filter(event => {
        const name = getTitle(event).toLowerCase();
        switch (selectedCategory) {
          case 'party': return name.includes('party') || name.includes('celebration');
          case 'talk': return name.includes('talk') || name.includes('keynote') || name.includes('presentation');
          case 'workshop': return name.includes('workshop') || name.includes('class');
          case 'showroom': return name.includes('showroom') || name.includes('tour');
          case 'networking': return name.includes('networking') || name.includes('meet');
          default: return true;
        }
      });
    }

    // Sort events
    switch (sortOption) {
      case 'trending':
        return filtered.sort((a, b) => b.rsvp_count - a.rsvp_count);
      case 'most-rsvps':
        return filtered.sort((a, b) => b.rsvp_count - a.rsvp_count);
      case 'chronological':
        return filtered.sort((a, b) => new Date(a.startsAt ?? a.date).getTime() - new Date(b.startsAt ?? b.date).getTime());
      case 'category':
        return filtered.sort((a, b) => getTitle(a).toLowerCase().localeCompare(getTitle(b).toLowerCase()));
      default:
        return filtered;
    }
  }, [safeEvents, sortOption, selectedCategory]);

  // Calculate badges for each event
  const eventsWithBadges = useMemo(() => {
    return sortedEvents.map(event => {
      const badges: string[] = [];
      const now = new Date();
             const eventDate = new Date(event.created_at || event.startsAt || event.date);
      const hoursSinceCreated = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60);
      
      // New badge: Listed in last 72 hours
      if (hoursSinceCreated <= 72) {
        badges.push('new');
      }
      
      // Rising badge: 20%+ increase in RSVPs in last 24 hours
      if (event.rsvp_change_24h && event.rsvp_change_24h > 0) {
        const increasePercentage = (event.rsvp_change_24h / Math.max(event.rsvp_count - event.rsvp_change_24h, 1)) * 100;
        if (increasePercentage >= 20) {
          badges.push('rising');
        }
      }
      
      // Trending badge: Top 10% of RSVPs overall
      const sortedByRSVP = [...sortedEvents].sort((a, b) => b.rsvp_count - a.rsvp_count);
      const top10PercentIndex = Math.floor(sortedEvents.length * 0.1);
      const isTop10 = sortedByRSVP.findIndex(e => e.id === event.id) <= top10PercentIndex;
      if (isTop10 && event.rsvp_count > 0) {
        badges.push('trending');
      }
      
      // Popular badge: Over 100 RSVPs
      if (event.rsvp_count >= 100) {
        badges.push('popular');
      }
      
      return {
        ...event,
        badges
      };
    });
  }, [sortedEvents]);

  // Determine tile size based on Fibonacci pattern
  const getTileSize = (index: number) => {
    const pattern = [2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1]; // 221x1, etc.
    const sizeIndex = index % pattern.length;
    return pattern[sizeIndex];
  };

  const getTileClasses = (size: number) => {
    switch (size) {
      case 2: // Large tile (2x2)
        return 'col-span-2 row-span-2';
      case 1: // Small tile (1x1)
        return 'col-span-1 row-span-1';
      default:
        return 'col-span-1 row-span-1';
    }
  };

  const formatDate = (dateString: string) => {
    return fmtDateISO(dateString);
  };

  const formatTime = (timeString: string) => {
    return fmtTime(timeString);
  };

  // NORMALIZE the `events` for fallback grid (do not mutate props)
  const normalized = (events ?? []).map((e:any) => ({
    ...e,
    title: getTitle(e),
    eventTypes: Array.isArray(e?.eventTypes) ? e.eventTypes.map(String) : [],
    startsAt: toISO(e?.startsAt ?? e?.startDate ?? null),
    endsAt:   toISO(e?.endsAt   ?? e?.endDate   ?? null),
    imageUrl: getImageUrl(e),
  }));

  if (dev) {
    console.log("[FestivalFeed] view:", viewKey, "events:", normalized.length);
    if (normalized.length) {
      console.log("[FestivalFeed] first:", {
        id: normalized[0]?.id,
        title: normalized[0]?.title,
        imageUrl: normalized[0]?.imageUrl?.slice?.(0, 80)
      });
    }
  }

  

  if (safeEvents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎪</div>
        <h3 className="text-xl font-semibold text-gray-900">No Events Yet</h3>
        <p className="text-gray-600">Events will appear here once they're added to the festival.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Festival Events</h2>

                     {/* Event Display */}
        {viewKey === 'festival' && (
          <FlowMosaic 
            events={events.map(e => ({
              id: e.id,
              title: getTitle(e),
              imageUrl: getImageUrl(e),
              heroImageUrl: e.heroImageUrl,
              coverImageUrl: e.coverImageUrl,
              rsvpCount: e.rsvp_count,
              viewCount: e.viewCount,
              isSponsored: e.isSponsored,
              eventTypes: e.eventTypes,
              startsAt: toISO(e.startsAt),
              startDate: toISO(e.startDate)
            }))} 
            canEdit={canEdit} 
          />
        )}

      {/* Grid View */}
      {viewKey === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventsWithBadges.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="group block bg-white rounded-lg shadow-sm border border-folio-border overflow-hidden hover:shadow-lg hover:border-folio-accent transition-all duration-300"
            >
              {/* Event Image */}
              <div className="relative overflow-hidden h-48">
                {getImageUrl(event) ? (
                  <img
                    src={getImageUrl(event)}
                    alt={getTitle(event)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-3xl">
                    🎪
                  </div>
                )}
                
                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                  {event.badges?.map((badge, badgeIndex) => (
                    <EventBadge 
                      key={badgeIndex} 
                      type={badge as any} 
                      className="text-xs"
                    />
                  ))}
                </div>
                
                {/* RSVP Badge */}
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium text-gray-700 flex items-center gap-1">
                  <FaHeart className="text-folio-accent" />
                  {event.rsvp_count}
                </div>
                
                {/* Admin Edit Button */}
                <FestivalEditOverlay id={event.id} show={canEdit} />

                {/* Admin-only "needs type" badge */}
                {canEdit && isUntyped(event) && (
                  <div className="absolute left-2 top-2 z-10 pointer-events-none text-[10px] font-medium rounded bg-yellow-400/90 text-black px-2 py-0.5">
                    needs type
                  </div>
                )}
              </div>

              {/* Event Content */}
              <div className="p-4 space-y-3">
                <h3 className="font-semibold text-gray-900 group-hover:text-folio-accent transition-colors text-lg">
                  {getTitle(event)}
                </h3>

                <div className="space-y-2 text-gray-600 text-sm">
                  <div className="flex items-center gap-2">
                    <FaCalendarAlt className="text-folio-accent flex-shrink-0" />
                                               <span>{formatDate(event.startsAt ?? event.date)} at {formatTime(event.time)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <FaMapMarkerAlt className="text-folio-accent flex-shrink-0" />
                    <span className="truncate">{event.city ?? event.venue ?? event.location}</span>
                  </div>

                  {event.description && (
                    <p className="text-gray-600 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>

                {/* Organizer */}
                {(() => {
                  const authorName = getAuthorName(event);
                  if (!authorName) return null;
                  return (
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <FaUsers className="text-folio-accent" />
                      <span className="truncate">{authorName}</span>
                    </div>
                  );
                })()}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* List View */}
      {viewKey === 'list' && (
        <div className="space-y-4">
          {eventsWithBadges.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="group block bg-white rounded-lg shadow-sm border border-folio-border overflow-hidden hover:shadow-lg hover:border-folio-accent transition-all duration-300"
            >
              <div className="flex">
                {/* Event Image */}
                <div className="relative w-32 h-32 flex-shrink-0">
                  {getImageUrl(event) ? (
                    <img
                      src={getImageUrl(event)}
                      alt={getTitle(event)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-2xl">
                      🎪
                    </div>
                  )}
                  
                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {event.badges?.slice(0, 1).map((badge, badgeIndex) => (
                      <EventBadge 
                        key={badgeIndex} 
                        type={badge as any} 
                        className="text-xs"
                      />
                    ))}
                  </div>
                  
                  {/* Admin Edit Button */}
                  <FestivalEditOverlay id={event.id} show={canEdit} />

                  {/* Admin-only "needs type" badge */}
                  {canEdit && isUntyped(event) && (
                    <div className="absolute left-2 top-2 z-10 pointer-events-none text-[10px] font-medium rounded bg-yellow-400/90 text-black px-2 py-0.5">
                      needs type
                    </div>
                  )}
                </div>

                {/* Event Content */}
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 group-hover:text-folio-accent transition-colors text-lg mb-2">
                        {getTitle(event)}
                      </h3>

                      <div className="space-y-2 text-gray-600 text-sm">
                        <div className="flex items-center gap-2">
                          <FaCalendarAlt className="text-folio-accent flex-shrink-0" />
                          <span>{formatDate(event.startsAt ?? event.date)} at {formatTime(event.time)}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <FaMapMarkerAlt className="text-folio-accent flex-shrink-0" />
                          <span>{event.city ?? event.venue ?? event.location}</span>
                        </div>

                        {event.description && (
                          <p className="text-gray-600 line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>

                      {/* Organizer */}
                      {(() => {
                        const authorName = getAuthorName(event);
                        if (!authorName) return null;
                        return (
                          <div className="flex items-center gap-2 text-gray-500 text-sm mt-2">
                            <FaUsers className="text-folio-accent" />
                            <span>{authorName}</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* RSVP Count */}
                    <div className="flex items-center gap-1 text-gray-700 ml-4">
                      <FaHeart className="text-folio-accent" />
                      <span className="font-medium">{event.rsvp_count}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Full Event List Link */}
      <div className="text-center pt-6">
        <Link
          href={`/events?festival=${eventsWithBadges[0]?.id}`}
          className="inline-flex items-center px-6 py-3 bg-folio-accent text-white rounded-lg font-semibold hover:bg-folio-accent/90 transition-colors"
        >
          View All Events
        </Link>
      </div>
    </div>
  );
} 