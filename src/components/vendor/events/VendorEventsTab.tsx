'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Section } from '../shared/Section';
import { AIBadge } from '../shared/AIBadge';
import { computeAIBundle } from '@/lib/vendor-data/ai/engine';
import { useAIUnlocked } from '../ai/useAIAccess';
import { AIInlinePane } from '../ai/AIInlinePane';
import { useDemoState } from '@/lib/vendor-data/demoState';
import { getVendorEvents, type VendorEvent } from '@/lib/mock/eventAnalytics';
import { Skeleton } from '../shared/Skeleton';
import { EmptyState } from '../shared/EmptyState';
import { 
  getPortfolioKpis, 
  getPortfolioEventSummaries, 
  getPortfolioGrowthData, 
  getPortfolioBenchmarks, 
  getPortfolioAverages 
} from '@/lib/mock/eventsPortfolio';
import { PortfolioKpis } from './PortfolioKpis';
import { EventsCompareBar } from './EventsCompareBar';
import { PortfolioGrowthLine } from './PortfolioGrowthLine';
import { BenchmarksStrip } from './BenchmarksStrip';
import { formatCurrency, formatDateRange, formatCompactNumber } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, MapPin, Users, TrendingUp, ExternalLink } from 'lucide-react';

/**
 * Vendor Events Tab - Standard and AI-powered event analytics
 * Consolidated from /vendor/my-events with portfolio insights
 */
export function VendorEventsTab({ vendorId }: { vendorId?: string | null }) {
  const router = useRouter();
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const aiUnlocked = useAIUnlocked();
  const { state } = useDemoState();
  const bundle = aiUnlocked ? computeAIBundle(state) : null;
  const eventRoiInsight = bundle?.insights.find(i => i.id === 'forecast-trending-sku');

  // Portfolio data (using mock for now, can be replaced with real API)
  const portfolioKpis = getPortfolioKpis();
  const eventSummaries = getPortfolioEventSummaries();
  const growthData = getPortfolioGrowthData();
  const benchmarks = getPortfolioBenchmarks();
  const averages = getPortfolioAverages();

  useEffect(() => {
    // In demo mode, read from demo state
    const isDemoMode = typeof window !== 'undefined' && (
      new URLSearchParams(window.location.search).get('demo') === '1'
    );
    
    if (isDemoMode) {
      setEvents(state.events.summaries.map((s: any) => ({
        id: s.id,
        name: s.name,
        location: { city: s.city },
        dates: { start: '', end: '' },
        dateRange: s.dateRange,
        rsvps: s.rsvps ?? 0,
        productsSaved: s.saves ?? 0,
        estProjectValueUsd: s.estValueUsd ?? 0,
        status: s.status,
      })));
      setLoading(false);
      return;
    }
    
    if (!vendorId) {
      // Fallback to mock data if no vendor ID
      setEvents(getVendorEvents());
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const { fetchEventSummaries } = await import('@/lib/vendor-data/eventsAdapter');
        const summaries = await fetchEventSummaries(vendorId);
        // Convert summaries to event format for compatibility
        setEvents(summaries.map(s => ({
          id: s.id,
          name: s.name,
          location: { city: s.city },
          dates: { start: '', end: '' },
          dateRange: s.dateRange,
          rsvps: s.rsvps ?? 0,
          productsSaved: s.saves ?? 0,
          estProjectValueUsd: s.estValueUsd ?? 0,
          status: s.status,
        })));
      } catch (error) {
        console.error('[VendorEventsTab] Failed to fetch events:', error);
        // Fallback to mock data on error
        setEvents(getVendorEvents());
      } finally {
        setLoading(false);
      }
    })();
  }, [vendorId, state]);

  const handleEventClick = useCallback((eventId: string) => {
    router.push(`/vendor/my-events/${eventId}`);
  }, [router]);

  const handleExportCSV = useCallback(() => {
    // Mock CSV export functionality
    console.log('Exporting portfolio data to CSV...');
    // In a real app, this would generate and download CSV files
  }, []);

  return (
    <div className="space-y-6">
      {/* Events Grid - Standard */}
      <Section 
        title="My Events (Standard)" 
        subtitle="Your events with key metrics and quick access to detailed analytics."
      >
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <EventCard 
                key={event.id} 
                event={event} 
                isHovered={hoveredEventId === event.id}
                onHover={setHoveredEventId}
              />
            ))}
          </div>
        ) : (
          <EmptyState 
            title="No events yet" 
            subtitle="Add or connect events to start measuring exposure."
          />
        )}
      </Section>

      {/* Portfolio Insights - Standard */}
      {!loading && events.length > 0 && (
        <Section 
          title="Portfolio Insights (Standard)" 
          subtitle="Cross-event analytics and performance benchmarks across your portfolio."
        >
          {/* KPI Strip */}
          <div className="rounded-2xl p-4 ridge-card">
            <PortfolioKpis data={portfolioKpis} />
          </div>

          {/* Comparative Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl p-4 ridge-card">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-[var(--text-primary)]">Event Performance vs Average</h4>
                <button 
                  onClick={handleExportCSV}
                  className="text-xs px-3 py-1 rounded-lg border border-[var(--ridge-outer)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] transition"
                >
                  Compare events
                </button>
              </div>
              <EventsCompareBar 
                events={eventSummaries}
                averages={averages}
                onEventClick={handleEventClick}
                onHover={setHoveredEventId}
              />
              <p className="text-xs text-[var(--text-secondary)] mt-2">How each event compares to portfolio average</p>
            </div>

            <div className="rounded-2xl p-4 ridge-card">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-[var(--text-primary)]">Portfolio Momentum</h4>
                <button 
                  onClick={handleExportCSV}
                  className="text-xs px-3 py-1 rounded-lg border border-[var(--ridge-outer)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] transition"
                >
                  Export growth data
                </button>
              </div>
              <PortfolioGrowthLine data={growthData} />
              <p className="text-xs text-[var(--text-secondary)] mt-2">Growth over time across all events</p>
            </div>
          </div>

          {/* Benchmarks */}
          <div className="rounded-2xl p-4 ridge-card">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-[var(--text-primary)]">Benchmarks</h4>
              <button 
                onClick={handleExportCSV}
                className="text-xs px-3 py-1 rounded-lg border border-[var(--ridge-outer)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] transition"
              >
                Document tactics
              </button>
            </div>
            <BenchmarksStrip 
              benchmarks={benchmarks} 
              events={eventSummaries} 
            />
            <p className="text-xs text-[var(--text-secondary)] mt-2">Key performance highlights and standouts</p>
            {/* Inline AI Pane for Events Portfolio Insights */}
            <AIInlinePane sectionId="events" />
          </div>
        </Section>
      )}

    </div>
  );
}

function PlaceholderCard({ label }: { label: string }) {
  return (
    <div className="rounded-2xl p-4 ridge-card">
      <div className="text-sm text-[var(--text-secondary)]">{label}</div>
      <div className="text-2xl font-semibold text-[var(--text-primary)]">—</div>
    </div>
  );
}

interface EventCardProps {
  event: VendorEvent;
  isHovered?: boolean;
  onHover?: (eventId: string | null) => void;
}

function EventCard({ event, isHovered = false, onHover }: EventCardProps) {
  const statusColors = {
    upcoming: "bg-yellow-100/50 text-yellow-800 border-yellow-200",
    active: "bg-green-100/50 text-green-800 border-green-200", 
    completed: "bg-stone-100/50 text-stone-800 border-stone-200"
  };

  return (
    <div 
      className={`rounded-2xl ridge-card p-4 transition-all duration-200 ${
        isHovered 
          ? 'ring-2 ring-[var(--ridge-outer)] shadow-md' 
          : 'hover:shadow-md'
      }`}
      onMouseEnter={() => onHover?.(event.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-lg font-semibold line-clamp-2 flex-1 text-[var(--text-primary)]">{event.name}</h4>
        <Badge className={`${statusColors[event.status]} border text-xs`}>
          {event.status}
        </Badge>
      </div>
      
      <div className="flex items-center space-x-4 text-sm text-[var(--text-secondary)] mb-4">
        <div className="flex items-center space-x-1">
          <CalendarDays className="w-4 h-4" />
          <span>
            {(event as any).dateRange 
              ? (event as any).dateRange 
              : formatDateRange(event.dates?.start, event.dates?.end)
            }
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <MapPin className="w-4 h-4" />
          <span>{event.location.city}</span>
        </div>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center w-8 h-8 bg-[var(--bg-elevated)] rounded-full mb-1 mx-auto">
            <Users className="w-4 h-4 text-[var(--text-primary)]" />
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-1">RSVPs</p>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{formatCompactNumber(event.rsvps)}</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center w-8 h-8 bg-[var(--bg-elevated)] rounded-full mb-1 mx-auto">
            <TrendingUp className="w-4 h-4 text-[var(--text-primary)]" />
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-1">Products</p>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{formatCompactNumber(event.productsSaved)}</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center w-8 h-8 bg-[var(--bg-elevated)] rounded-full mb-1 mx-auto">
            <span className="text-xs font-semibold text-[var(--text-primary)]">$</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-1">Est. Value</p>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {formatCurrency(event.estProjectValueUsd, 'USD', true)}
          </p>
        </div>
      </div>

      {/* Action Button */}
      <Link href={`/vendor/my-events/${event.id}`}>
        <Button className="w-full bg-[var(--bg-base)] border border-[var(--ridge-outer)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] transition">
          View Analytics
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      </Link>
    </div>
  );
}


