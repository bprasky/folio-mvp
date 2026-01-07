'use client';

import { useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAnalyticsDrawer } from "./useAnalyticsDrawer";
import type { EventPostReport } from "@/lib/mock/eventPost";

// Import existing components
import { RoomPhaseMatrix } from "@/components/vendor/events/post/RoomPhaseMatrix";
import { SavesOverTime } from "@/components/vendor/events/SavesOverTime";
import { GeoPopularity } from "@/components/vendor/events/GeoPopularity";
import { TopDesignersTable } from "@/components/vendor/events/TopDesignersTable";
import { TopProductsPost } from "@/components/vendor/events/post/TopProductsPost";

interface AnalyticsDrawerProps {
  data: EventPostReport;
}

export function AnalyticsDrawer({ data }: AnalyticsDrawerProps) {
  const { state, closeDrawer } = useAnalyticsDrawer();

  // Handle scrolling to anchor when drawer opens
  useEffect(() => {
    if (state.open && state.section) {
      setTimeout(() => {
        const element = document.getElementById(state.section!);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100); // Small delay to ensure drawer is rendered
    }
  }, [state.open, state.section]);

  // Convert data to match component expectations
  const timelineData = [
    { date: data.dates.start, saves: Math.floor(data.outcome.productsSaved * 0.1) },
    { date: data.dates.end, saves: data.outcome.productsSaved }
  ];

  const geoData = data.markets.map(market => ({
    city: market.city,
    count: market.saves
  }));

  const designersData = data.firms.map(firm => ({
    id: `d-${firm.firm.toLowerCase().replace(/\s+/g, '-')}`,
    name: firm.firm,
    firm: firm.firm,
    saves: Math.floor(firm.valueUsd / 10000), // Rough conversion
    estProjectValueUsd: firm.valueUsd
  }));

  return (
    <Sheet open={state.open} onOpenChange={closeDrawer}>
      <SheetContent side="right" className="w-[720px] bg-[#F7F4F1] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[#2B2B2B] font-serif">
            More Analytics
          </SheetTitle>
        </SheetHeader>

        {/* Simple anchor routing */}
        {(!state.section || state.section === "roomPhase") && (
          <div id="roomPhase" className="scroll-mt-6">
            <h3 className="mt-6 mb-2 text-[#2B2B2B] font-medium">Room × Phase Matrix</h3>
            <RoomPhaseMatrix 
              data={data.roomPhase} 
              onHover={() => {}} // Disable hover in drawer
            />
          </div>
        )}

        {(!state.section || state.section === "timeline") && (
          <div id="timeline" className="scroll-mt-6">
            <h3 className="mt-8 mb-2 text-[#2B2B2B] font-medium">Save → Tag Over Time</h3>
            <SavesOverTime 
              data={timelineData} 
              onHover={() => {}} // Disable hover in drawer
            />
          </div>
        )}

        {(!state.section || state.section === "geo") && (
          <div id="geo" className="scroll-mt-6">
            <h3 className="mt-8 mb-2 text-[#2B2B2B] font-medium">Geography</h3>
            <GeoPopularity 
              data={geoData} 
              onHover={() => {}} // Disable hover in drawer
            />
          </div>
        )}

        {(!state.section || state.section === "designers") && (
          <div id="designers" className="scroll-mt-6">
            <h3 className="mt-8 mb-2 text-[#2B2B2B] font-medium">Top Designers/Firms</h3>
            <TopDesignersTable 
              designers={designersData} 
              onHover={() => {}} // Disable hover in drawer
            />
          </div>
        )}

        {(!state.section || state.section === "products") && (
          <div id="products" className="scroll-mt-6">
            <h3 className="mt-8 mb-2 text-[#2B2B2B] font-medium">Top Products</h3>
            <TopProductsPost 
              products={data.products}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
