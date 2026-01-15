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
    <div className="ridge-card p-6">
      <h3 className="folio-ui font-semibold text-[var(--text-primary)] mb-4">{title}</h3>
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
    "rounded-full px-3 py-1.5 folio-meta font-medium transition-colors";
  const classes =
    variant === "outline"
      ? `${baseClasses} border border-[var(--ridge-outer)] bg-[var(--bg-base)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]`
      : `${baseClasses} bg-[var(--text-primary)] text-[var(--bg-base)] hover:opacity-90`;

  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
}

export function TopEngagedDesignersCard({
  onAskQuestion,
}: {
  onAskQuestion: (question: string) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const data = mockVendorAnalyticsData;

  // Calculate top engaged designers
  const topDesigners = [...data.designerEngagement]
    .sort((a, b) => {
      const scoreA = a.totalSaves + a.totalTags * 2 + a.totalSpecIntentEvents * 3;
      const scoreB = b.totalSaves + b.totalTags * 2 + b.totalSpecIntentEvents * 3;
      return scoreB - scoreA;
    })
    .slice(0, 5);

  const highBudgetDesigners = topDesigners.filter(
    (d) => d.influencedProjectBudget > 500000
  ).length;

  const handleClick = () => {
    onAskQuestion("Which designers are most engaged with my products?");
  };

  const handleCreateGuestList = () => {
    setDrawerOpen(true);
  };

  const handleSendHighlightList = () => {
    // TODO: Wire to real action
    console.log("Send highlight list to designers");
  };

  const handleExportSegment = () => {
    // TODO: Wire to real action
    console.log("Export designer segment");
  };

  return (
    <InsightCard title="Which designers are most engaged with my products?">
      <div className="text-5xl font-light text-[var(--text-primary)]">
        {topDesigners.length}
      </div>
      <div className="folio-ui text-[var(--text-secondary)] mt-1">
        {highBudgetDesigners} working on projects over $500k
      </div>
      <div className="folio-ui text-[var(--text-secondary)] mt-2">
        {topDesigners.reduce((sum, d) => sum + d.totalSaves, 0)} total saves .{" "}
        {topDesigners.reduce((sum, d) => sum + d.totalTags, 0)} tags
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <ActionButton onClick={handleCreateGuestList}>
          Create guest list for appreciation dinner
        </ActionButton>
        <ActionButton variant="outline" onClick={handleSendHighlightList}>
          Send highlight list to designers
        </ActionButton>
        <ActionButton variant="outline" onClick={handleExportSegment}>
          Export designer segment
        </ActionButton>
      </div>

      <button
        onClick={handleClick}
        className="mt-4 folio-ui text-[var(--text-secondary)] underline underline-offset-4 hover:text-[var(--text-primary)]"
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

