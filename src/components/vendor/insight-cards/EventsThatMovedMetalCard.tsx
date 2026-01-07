"use client";

import { useState } from "react";
import { mockVendorAnalyticsData } from "@/lib/vendorAnalyticsMock";
import { CreateAppreciationDinnerModal } from "../actions/CreateAppreciationDinnerModal";

interface InsightCardProps {
  title: string;
  children: React.ReactNode;
}

function InsightCard({ title, children }: InsightCardProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-neutral-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function ActionButton({
  onClick,
  variant = "default",
  children,
}: {
  onClick?: () => void;
  variant?: "default" | "outline";
  children: React.ReactNode;
}) {
  const baseClasses =
    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors";
  const classes =
    variant === "outline"
      ? `${baseClasses} border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50`
      : `${baseClasses} bg-neutral-900 text-white hover:bg-neutral-800`;

  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
}

export function EventsThatMovedMetalCard({
  onAskQuestion,
}: {
  onAskQuestion: (question: string) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const data = mockVendorAnalyticsData;

  // Calculate events by impact
  const eventsByImpact = [...data.eventStats].sort(
    (a, b) => b.influencedPipelineBudget - a.influencedPipelineBudget
  );

  const topEvent = eventsByImpact[0];
  const eventName =
    data.events.find((e) => e.eventId === topEvent.eventId)?.name ||
    "Top event";
  const totalPipeline = eventsByImpact.reduce(
    (sum, e) => sum + e.influencedPipelineBudget,
    0
  );

  const handleClick = () => {
    onAskQuestion("Which events actually produced real demand?");
  };

  const handleCreateRecap = () => {
    // TODO: Wire to real action
    console.log("Create event recap highlight");
  };

  const handleCreateGuestList = () => {
    setDrawerOpen(true);
  };

  const handleExportReport = () => {
    // TODO: Wire to real action
    console.log("Export event performance report");
  };

  return (
    <InsightCard title="Which events actually produced real demand?">
      <div className="text-5xl font-light text-neutral-900">
        ${(totalPipeline / 1000000).toFixed(1)}M
      </div>
      <div className="text-sm text-neutral-600 mt-1">
        {eventName} led with ${(topEvent.influencedPipelineBudget / 1000000).toFixed(1)}M
      </div>
      <div className="text-sm text-neutral-600 mt-2">
        {topEvent.designerCheckins} designer check-ins · {topEvent.productSavesAtEvent} saves
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <ActionButton onClick={handleCreateRecap}>
          Create event recap highlight
        </ActionButton>
        <ActionButton variant="outline" onClick={handleCreateGuestList}>
          Create guest list for next event
        </ActionButton>
        <ActionButton variant="outline" onClick={handleExportReport}>
          Export event performance report
        </ActionButton>
      </div>

      <button
        onClick={handleClick}
        className="mt-4 text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
      >
        Dive deeper →
      </button>

      <CreateAppreciationDinnerModal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        vendorId={data.vendor.vendorId}
      />
    </InsightCard>
  );
}

