"use client";

import { mockVendorAnalyticsData } from "@/lib/vendorAnalyticsMock";

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

export function InfluenceValueCard({
  onAskQuestion,
}: {
  onAskQuestion: (question: string) => void;
}) {
  const data = mockVendorAnalyticsData;

  // Calculate influence value
  const activeProjects = data.projects.filter((p) => p.status === "active");
  const totalInfluence = data.projectInfluenceStats
    .filter((stat) =>
      activeProjects.some((p) => p.projectId === stat.projectId)
    )
    .reduce((sum, stat) => sum + stat.vendorInfluenceValue, 0);

  const totalBudget = activeProjects.reduce(
    (sum, p) => sum + p.estimatedBudgetTotal,
    0
  );
  const influencePercentage =
    totalBudget > 0 ? (totalInfluence / totalBudget) * 100 : 0;

  // Mock change vs last 30 days (would come from real data)
  const change = 12; // percentage

  const handleClick = () => {
    onAskQuestion("What is my current influence value across active projects?");
  };

  const handleBoostTopProjects = () => {
    // TODO: Wire to real action
    console.log("Boost top 3 performing projects");
  };

  const handleExportReport = () => {
    // TODO: Wire to real action
    console.log("Export influence report");
  };

  const handleNotifySales = () => {
    // TODO: Wire to real action
    console.log("Notify sales team");
  };

  return (
    <InsightCard title="What is my current influence value across active projects?">
      <div className="text-5xl font-light text-[var(--text-primary)]">
        ${(totalInfluence / 1000000).toFixed(2)}M
      </div>
      <div className="folio-ui text-green-600 mt-1">↑{change}% vs last 30 days</div>
      <div className="folio-ui text-[var(--text-secondary)] mt-2">
        across {activeProjects.length} active projects . {influencePercentage.toFixed(1)}% of total budget
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <ActionButton onClick={handleBoostTopProjects}>
          Boost top 3 performing projects
        </ActionButton>
        <ActionButton variant="outline" onClick={handleExportReport}>
          Export influence report
        </ActionButton>
        <ActionButton variant="outline" onClick={handleNotifySales}>
          Notify sales team
        </ActionButton>
      </div>

      <button
        onClick={handleClick}
        className="mt-4 folio-ui text-[var(--text-secondary)] underline underline-offset-4 hover:text-[var(--text-primary)]"
      >
        Dive deeper →
      </button>
    </InsightCard>
  );
}

